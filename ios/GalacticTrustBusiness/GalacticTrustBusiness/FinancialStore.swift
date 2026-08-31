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
            let demo = Self.demoState()
            profile = demo.profile
            transactions = demo.transactions
            invoices = demo.invoices
            openingBalance = demo.openingBalance
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
        invoices.filter { $0.status != .paid }.reduce(0) { $0 + $1.amount }
    }

    var overdueInvoices: [BusinessInvoice] {
        invoices.filter { $0.status == .overdue || ($0.status != .paid && $0.dueDate < Date()) }
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

    func resetToDemo() {
        let demo = Self.demoState()
        profile = demo.profile
        transactions = demo.transactions
        invoices = demo.invoices
        openingBalance = demo.openingBalance
        save()
    }

    func clearFinancialData() {
        transactions = []
        invoices = []
        openingBalance = 0
        save()
    }

    func answer(_ question: String) -> String {
        let q = question.lowercased()
        if q.contains("revenue") || q.contains("income") || q.contains("received") {
            return "You received \(currency(currentMonthIncome)) this month. Net cash flow after recorded expenses is \(currency(currentMonthNet))."
        }
        if q.contains("spend") || q.contains("expense") || q.contains("cost") {
            let top = expenseByCategory.first
            if let top {
                return "You spent \(currency(currentMonthExpenses)) this month. Your largest category is \(top.category.rawValue) at \(currency(top.amount))."
            }
            return "No expenses are recorded for this month yet."
        }
        if q.contains("invoice") || q.contains("owe") || q.contains("receivable") {
            return "You have \(currency(outstandingInvoices)) in unpaid invoices. \(currency(overdueInvoices.reduce(0) { $0 + $1.amount })) is overdue."
        }
        if q.contains("cash") || q.contains("balance") || q.contains("runway") {
            let monthlyBurn = max(currentMonthExpenses, 1)
            let runway = max(balance, 0) / monthlyBurn
            return "Your recorded cash balance is \(currency(balance)). At this month’s expense pace, that is about \(runway.formatted(.number.precision(.fractionLength(1)))) months of coverage. This is a simple estimate, not a liquidity guarantee."
        }
        if q.contains("subscription") || q.contains("recurring") {
            let recurring = currentMonthTransactions.filter { $0.kind == .expense && $0.isRecurring }
            return "Recurring expenses total \(currency(recurring.reduce(0) { $0 + $1.amount })) this month across \(recurring.count) recorded charge\(recurring.count == 1 ? "" : "s")."
        }
        return "This month: \(currency(currentMonthIncome)) received, \(currency(currentMonthExpenses)) spent, and \(currency(currentMonthNet)) net cash flow. Ask me about revenue, spending, invoices, recurring costs, cash balance, or runway."
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
        guard previous > 0 else { return current > 0 ? 100 : 0 }
        return ((current - previous) / previous) * 100
    }

    private func save() {
        try? vault.save(AppState(profile: profile, transactions: transactions, invoices: invoices, openingBalance: openingBalance))
    }

    private static func demoState() -> AppState {
        let cal = Calendar.current
        let now = Date()
        func day(_ n: Int) -> Date { cal.date(byAdding: .day, value: n, to: now) ?? now }
        func month(_ n: Int, day d: Int) -> Date {
            let base = cal.date(byAdding: .month, value: n, to: now) ?? now
            var comps = cal.dateComponents([.year, .month], from: base)
            comps.day = d
            return cal.date(from: comps) ?? base
        }

        var tx: [BusinessTransaction] = [
            .init(date: day(-1), merchant: "Stellar Labs", memo: "Client payment", amount: 12_500, kind: .income, category: .services),
            .init(date: day(-2), merchant: "Payroll", memo: "Employee salaries", amount: 9_800, kind: .expense, category: .payroll, isRecurring: true),
            .init(date: day(-3), merchant: "Amazon Business", memo: "Office supplies", amount: 312.45, kind: .expense, category: .office),
            .init(date: day(-4), merchant: "Notion", memo: "Team subscription", amount: 240, kind: .expense, category: .software, isRecurring: true),
            .init(date: day(-5), merchant: "Google Ads", memo: "Growth campaign", amount: 1_250.75, kind: .expense, category: .marketing),
            .init(date: day(-6), merchant: "Bright Agency", memo: "Customer refund", amount: 480, kind: .income, category: .services),
            .init(date: day(-7), merchant: "Acme Corp", memo: "Invoice payment", amount: 18_950, kind: .income, category: .sales),
            .init(date: day(-8), merchant: "AWS", memo: "Cloud infrastructure", amount: 2_140, kind: .expense, category: .software, isRecurring: true),
            .init(date: day(-10), merchant: "Office Lease", memo: "Monthly rent", amount: 3_400, kind: .expense, category: .rentUtilities, isRecurring: true),
            .init(date: day(-12), merchant: "Northstar Client", memo: "Project milestone", amount: 24_900, kind: .income, category: .services),
            .init(date: day(-14), merchant: "Figma", memo: "Design subscription", amount: 180, kind: .expense, category: .software, isRecurring: true),
            .init(date: day(-16), merchant: "City Electric", memo: "Utilities", amount: 620, kind: .expense, category: .rentUtilities, isRecurring: true),
            .init(date: day(-19), merchant: "Orbit Retail", memo: "Product revenue", amount: 15_200, kind: .income, category: .sales),
            .init(date: day(-21), merchant: "Meta Ads", memo: "Paid social", amount: 2_870, kind: .expense, category: .marketing),
            .init(date: day(-23), merchant: "Payroll", memo: "Contractor payouts", amount: 6_200, kind: .expense, category: .payroll)
        ]

        for offset in -5 ... -1 {
            let scale = Double(6 + offset) * 0.06 + 0.72
            tx.append(.init(date: month(offset, day: 4), merchant: "Monthly Clients", memo: "Client revenue", amount: 51_000 * scale, kind: .income, category: .services))
            tx.append(.init(date: month(offset, day: 9), merchant: "Product Sales", memo: "Monthly sales", amount: 19_000 * scale, kind: .income, category: .sales))
            tx.append(.init(date: month(offset, day: 12), merchant: "Payroll", memo: "Payroll", amount: 18_000 * scale, kind: .expense, category: .payroll, isRecurring: true))
            tx.append(.init(date: month(offset, day: 16), merchant: "Cloud & Software", memo: "Software services", amount: 5_200 * scale, kind: .expense, category: .software, isRecurring: true))
            tx.append(.init(date: month(offset, day: 21), merchant: "Marketing", memo: "Marketing spend", amount: 6_600 * scale, kind: .expense, category: .marketing))
            tx.append(.init(date: month(offset, day: 25), merchant: "Operations", memo: "Office and utilities", amount: 4_100 * scale, kind: .expense, category: .rentUtilities, isRecurring: true))
        }

        tx.sort { $0.date > $1.date }

        return AppState(
            profile: BusinessProfile(),
            transactions: tx,
            invoices: [
                .init(client: "Acme Corp", invoiceNumber: "INV-1004", amount: 3_250, dueDate: day(-4), status: .overdue),
                .init(client: "Stellar LLC", invoiceNumber: "INV-1007", amount: 2_600, dueDate: day(-1), status: .overdue),
                .init(client: "Orbit Technologies", invoiceNumber: "INV-1009", amount: 1_000, dueDate: day(6), status: .sent)
            ],
            openingBalance: 42_000
        )
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
