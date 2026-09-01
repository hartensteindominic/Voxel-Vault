import Foundation
import Combine

@MainActor
final class FinancialStore: ObservableObject {
    @Published var profile: BusinessProfile
    @Published var transactions: [BusinessTransaction]
    @Published var invoices: [BusinessInvoice]
    @Published var openingBalance: Double

    private let vault = LocalVault()
    private let calendar = Calendar.current

    init() {
        if let state = try? vault.load() {
            profile = state.profile
            transactions = state.transactions
            invoices = state.invoices
            openingBalance = state.openingBalance
        } else {
            profile = BusinessProfile(name: "My Business", currencyCode: "USD", fiscalYearStartMonth: 1)
            transactions = []
            invoices = []
            openingBalance = 0
            save()
        }
    }

    var balance: Double {
        openingBalance + transactions.reduce(0) { $0 + $1.signedAmount }
    }

    var currentMonthTransactions: [BusinessTransaction] {
        transactions.filter { calendar.isDate($0.date, equalTo: Date(), toGranularity: .month) }
    }

    var currentMonthIncome: Double {
        currentMonthTransactions.filter { $0.kind == .income }.reduce(0) { $0 + $1.amount }
    }

    var currentMonthExpenses: Double {
        currentMonthTransactions.filter { $0.kind == .expense }.reduce(0) { $0 + $1.amount }
    }

    var currentMonthNet: Double { currentMonthIncome - currentMonthExpenses }

    var outstandingInvoices: Double {
        invoices
            .filter { $0.status == .sent || $0.status == .overdue }
            .reduce(0) { $0 + $1.amount }
    }

    var overdueInvoices: [BusinessInvoice] {
        invoices.filter {
            $0.status == .overdue || ($0.status == .sent && $0.dueDate < Date())
        }
    }

    var expenseByCategory: [CategoryTotal] {
        let expenses = currentMonthTransactions.filter { $0.kind == .expense }
        let grouped = Dictionary(grouping: expenses, by: \.category)
        return grouped.map { key, value in
            CategoryTotal(category: key, amount: value.reduce(0) { $0 + $1.amount })
        }.sorted { $0.amount > $1.amount }
    }

    var monthlyPoints: [MonthlyPoint] {
        (0..<6).reversed().compactMap { offset in
            guard let month = calendar.date(byAdding: .month, value: -offset, to: Date()) else { return nil }
            let items = transactions.filter { calendar.isDate($0.date, equalTo: month, toGranularity: .month) }
            let income = items.filter { $0.kind == .income }.reduce(0) { $0 + $1.amount }
            let expense = items.filter { $0.kind == .expense }.reduce(0) { $0 + $1.amount }
            let formatter = DateFormatter()
            formatter.dateFormat = "MMM"
            return MonthlyPoint(label: formatter.string(from: month), income: income, expense: expense)
        }
    }

    var insights: [FinancialInsight] {
        var output: [FinancialInsight] = []
        let previous = totalsForMonth(offset: -1)
        let incomeChange = percentChange(current: currentMonthIncome, previous: previous.income)
        let expenseChange = percentChange(current: currentMonthExpenses, previous: previous.expense)

        if incomeChange > 4 {
            output.append(FinancialInsight(
                title: "Revenue is up \(incomeChange.formatted(.number.precision(.fractionLength(0))))%",
                detail: "Income is higher than last month. Open the evidence to see the transactions driving the change.",
                severity: .positive,
                amountImpact: currentMonthIncome - previous.income,
                evidenceTransactionIDs: currentMonthTransactions.filter { $0.kind == .income }.map(\.id)
            ))
        } else if incomeChange < -4 {
            output.append(FinancialInsight(
                title: "Revenue is down \(abs(incomeChange).formatted(.number.precision(.fractionLength(0))))%",
                detail: "Income is lower than last month. Review customers and receivables before changing spending.",
                severity: .warning,
                amountImpact: currentMonthIncome - previous.income,
                evidenceTransactionIDs: currentMonthTransactions.filter { $0.kind == .income }.map(\.id)
            ))
        }

        if let top = expenseByCategory.first {
            let share = currentMonthExpenses > 0 ? top.amount / currentMonthExpenses * 100 : 0
            output.append(FinancialInsight(
                title: "\(top.category.rawValue) is the largest expense",
                detail: "\(top.category.rawValue) represents \(share.formatted(.number.precision(.fractionLength(0))))% of this month’s spending.",
                severity: share > 40 ? .warning : .information,
                amountImpact: -top.amount,
                evidenceTransactionIDs: currentMonthTransactions.filter { $0.kind == .expense && $0.category == top.category }.map(\.id)
            ))
        }

        if !overdueInvoices.isEmpty {
            output.append(FinancialInsight(
                title: "\(overdueInvoices.count) overdue invoice\(overdueInvoices.count == 1 ? "" : "s")",
                detail: "\(currency(overdueInvoices.reduce(0) { $0 + $1.amount })) is currently overdue.",
                severity: .critical,
                amountImpact: overdueInvoices.reduce(0) { $0 + $1.amount }
            ))
        }

        if expenseChange > 15 {
            output.append(FinancialInsight(
                title: "Spending increased quickly",
                detail: "Expenses are \(expenseChange.formatted(.number.precision(.fractionLength(0))))% higher than last month. Review large and recurring charges.",
                severity: .warning,
                amountImpact: -(currentMonthExpenses - previous.expense),
                evidenceTransactionIDs: currentMonthTransactions.filter { $0.kind == .expense }.map(\.id)
            ))
        }

        let recurring = currentMonthTransactions.filter { $0.kind == .expense && $0.isRecurring }
        if !recurring.isEmpty {
            output.append(FinancialInsight(
                title: "Recurring costs: \(currency(recurring.reduce(0) { $0 + $1.amount }))",
                detail: "These recurring charges are worth reviewing for unused services or renegotiation opportunities.",
                severity: .information,
                amountImpact: -recurring.reduce(0) { $0 + $1.amount },
                evidenceTransactionIDs: recurring.map(\.id)
            ))
        }

        return Array(output.prefix(6))
    }

    func addTransaction(_ transaction: BusinessTransaction) {
        transactions.append(transaction)
        transactions.sort { $0.date > $1.date }
        save()
    }

    func addTransactions(_ imported: [BusinessTransaction]) {
        let existing = Set(transactions.map { "\($0.date.timeIntervalSince1970)|\($0.merchant)|\($0.amount)|\($0.kind.rawValue)" })
        let unique = imported.filter {
            !existing.contains("\($0.date.timeIntervalSince1970)|\($0.merchant)|\($0.amount)|\($0.kind.rawValue)")
        }
        transactions.append(contentsOf: unique)
        transactions.sort { $0.date > $1.date }
        save()
    }

    func deleteTransactions(at offsets: IndexSet, from items: [BusinessTransaction]) {
        for offset in offsets {
            guard items.indices.contains(offset) else { continue }
            let id = items[offset].id
            transactions.removeAll { $0.id == id }
        }
        save()
    }

    func addInvoice(_ invoice: BusinessInvoice) {
        invoices.append(invoice)
        invoices.sort { $0.dueDate < $1.dueDate }
        save()
    }

    func updateInvoiceStatus(id: UUID, status: BusinessInvoice.Status) {
        guard let index = invoices.firstIndex(where: { $0.id == id }) else { return }
        invoices[index].status = status
        save()
    }

    func deleteInvoice(id: UUID) {
        invoices.removeAll { $0.id == id }
        save()
    }

    func updateProfile(name: String) {
        let clean = name.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !clean.isEmpty else { return }
        profile.name = clean
        save()
    }

    func updateOpeningBalance(_ value: Double) {
        guard value.isFinite else { return }
        openingBalance = max(0, value)
        save()
    }

    func resetToDemo() {
        loadBundledSampleWorkspace()
    }

    func clearFinancialData() {
        transactions = []
        invoices = []
        openingBalance = 0
        save()
    }

    func evidence(for insight: FinancialInsight) -> [BusinessTransaction] {
        let ids = Set(insight.evidenceTransactionIDs)
        return transactions.filter { ids.contains($0.id) }
    }

    func currency(_ value: Double) -> String {
        value.formatted(.currency(code: profile.currencyCode).precision(.fractionLength(2)))
    }

    private func totalsForMonth(offset: Int) -> (income: Double, expense: Double) {
        guard let month = calendar.date(byAdding: .month, value: offset, to: Date()) else { return (0, 0) }
        let items = transactions.filter { calendar.isDate($0.date, equalTo: month, toGranularity: .month) }
        return (
            items.filter { $0.kind == .income }.reduce(0) { $0 + $1.amount },
            items.filter { $0.kind == .expense }.reduce(0) { $0 + $1.amount }
        )
    }

    private func percentChange(current: Double, previous: Double) -> Double {
        guard previous > 0 else { return 0 }
        return ((current - previous) / previous) * 100
    }

    private func save() {
        try? vault.save(AppState(profile: profile, transactions: transactions, invoices: invoices, openingBalance: openingBalance))
    }
}

private struct AppState: Codable {
    var profile: BusinessProfile
    var transactions: [BusinessTransaction]
    var invoices: [BusinessInvoice]
    var openingBalance: Double
}

private struct LocalVault {
    private var url: URL {
        let base = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first!
        let folder = base.appendingPathComponent("GalacticTrustBusiness", isDirectory: true)
        try? FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
        return folder.appendingPathComponent("finance-v1.json")
    }

    func load() throws -> AppState {
        let data = try Data(contentsOf: url)
        return try JSONDecoder().decode(AppState.self, from: data)
    }

    func save(_ state: AppState) throws {
        let data = try JSONEncoder().encode(state)
        try data.write(to: url, options: .atomic)
        try? FileManager.default.setAttributes([.protectionKey: FileProtectionType.complete], ofItemAtPath: url.path)
    }
}
