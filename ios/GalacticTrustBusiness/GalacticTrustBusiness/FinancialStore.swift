import Foundation
import Combine

@MainActor
final class FinancialStore: ObservableObject {
    @Published var profile: BusinessProfile
    @Published var transactions: [BusinessTransaction]
    @Published var invoices: [BusinessInvoice]
    @Published var openingBalance: Double
    @Published private(set) var requiresStorageRecovery: Bool
    @Published private(set) var storageNotice: String?

    private let vault: LocalVault
    private let calendar = Calendar.current

    init() {
        let localVault = LocalVault()
        vault = localVault

        if localVault.exists {
            do {
                let state = try localVault.load()
                profile = state.profile
                transactions = state.transactions
                invoices = state.invoices
                openingBalance = state.openingBalance
                requiresStorageRecovery = false
                storageNotice = nil
            } catch {
                profile = Self.emptyProfile
                transactions = []
                invoices = []
                openingBalance = 0
                requiresStorageRecovery = true
                storageNotice = "Your saved financial workspace could not be opened. Galactic Trust Business has not overwritten that file. Reset the local workspace only if you want to discard the unreadable copy and start over."
            }
        } else {
            profile = Self.emptyProfile
            transactions = []
            invoices = []
            openingBalance = 0
            requiresStorageRecovery = false
            storageNotice = nil

            do {
                try localVault.save(currentState)
            } catch {
                storageNotice = "The local financial workspace could not be created. Check available device storage and try again before entering business data."
            }
        }
    }

    var balance: Double {
        let now = Date()
        return openingBalance + transactions
            .filter { $0.date <= now }
            .reduce(0) { $0 + $1.signedAmount }
    }

    var currentMonthTransactions: [BusinessTransaction] {
        let now = Date()
        return transactions.filter {
            $0.date <= now && calendar.isDate($0.date, equalTo: now, toGranularity: .month)
        }
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
        let now = Date()
        return (0..<6).reversed().compactMap { offset in
            guard let month = calendar.date(byAdding: .month, value: -offset, to: now) else { return nil }
            let items = transactions.filter {
                $0.date <= now && calendar.isDate($0.date, equalTo: month, toGranularity: .month)
            }
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
        guard transaction.amount.isFinite, transaction.amount > 0, transaction.date <= Date() else { return }
        _ = commitChanges {
            transactions.append(transaction)
            transactions.sort { $0.date > $1.date }
        }
    }

    @discardableResult
    func addTransactions(_ imported: [BusinessTransaction]) -> Int {
        let now = Date()
        let validImported = imported.filter {
            $0.amount.isFinite && $0.amount > 0 && $0.date <= now
        }

        var knownSourceRecordIDs = Set(transactions.compactMap(\.sourceRecordID))
        var fallbackKeys = Set(transactions.filter { $0.sourceRecordID == nil }.map(Self.fallbackDuplicateKey))
        var unique: [BusinessTransaction] = []

        for transaction in validImported {
            if let sourceRecordID = transaction.sourceRecordID {
                guard knownSourceRecordIDs.insert(sourceRecordID).inserted else { continue }
            } else {
                let key = Self.fallbackDuplicateKey(transaction)
                guard fallbackKeys.insert(key).inserted else { continue }
            }
            unique.append(transaction)
        }

        guard !unique.isEmpty else { return 0 }
        let saved = commitChanges {
            transactions.append(contentsOf: unique)
            transactions.sort { $0.date > $1.date }
        }
        return saved ? unique.count : 0
    }

    func deleteTransactions(at offsets: IndexSet, from items: [BusinessTransaction]) {
        let ids = offsets.compactMap { offset in
            items.indices.contains(offset) ? items[offset].id : nil
        }
        guard !ids.isEmpty else { return }
        let idSet = Set(ids)
        _ = commitChanges {
            transactions.removeAll { idSet.contains($0.id) }
        }
    }

    func addInvoice(_ invoice: BusinessInvoice) {
        guard invoice.amount.isFinite, invoice.amount > 0 else { return }
        _ = commitChanges {
            invoices.append(invoice)
            invoices.sort { $0.dueDate < $1.dueDate }
        }
    }

    func updateInvoiceStatus(id: UUID, status: BusinessInvoice.Status) {
        guard invoices.contains(where: { $0.id == id }) else { return }
        _ = commitChanges {
            guard let index = invoices.firstIndex(where: { $0.id == id }) else { return }
            invoices[index].status = status
        }
    }

    func deleteInvoice(id: UUID) {
        guard invoices.contains(where: { $0.id == id }) else { return }
        _ = commitChanges {
            invoices.removeAll { $0.id == id }
        }
    }

    func updateProfile(name: String) {
        let clean = name.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !clean.isEmpty else { return }
        _ = commitChanges {
            profile.name = clean
        }
    }

    func updateOpeningBalance(_ value: Double) {
        guard value.isFinite, value >= 0 else { return }
        _ = commitChanges {
            openingBalance = value
        }
    }

    @discardableResult
    func replaceWorkspace(
        profile newProfile: BusinessProfile,
        transactions newTransactions: [BusinessTransaction],
        invoices newInvoices: [BusinessInvoice],
        openingBalance newOpeningBalance: Double
    ) -> Bool {
        let now = Date()
        let cleanName = newProfile.name.trimmingCharacters(in: .whitespacesAndNewlines)
        let transactionsAreValid = newTransactions.allSatisfy {
            $0.amount.isFinite && $0.amount > 0 && $0.date <= now
        }
        let invoicesAreValid = newInvoices.allSatisfy {
            $0.amount.isFinite && $0.amount > 0
        }

        guard !cleanName.isEmpty,
              newOpeningBalance.isFinite,
              newOpeningBalance >= 0,
              transactionsAreValid,
              invoicesAreValid else {
            storageNotice = "The replacement workspace contains invalid financial values and was not loaded. Your existing workspace is unchanged."
            return false
        }

        var normalizedProfile = newProfile
        normalizedProfile.name = cleanName
        return commitChanges {
            profile = normalizedProfile
            transactions = newTransactions.sorted { $0.date > $1.date }
            invoices = newInvoices.sorted { $0.dueDate < $1.dueDate }
            openingBalance = newOpeningBalance
        }
    }

    func resetToDemo() {
        guard !requiresStorageRecovery else { return }
        loadBundledSampleWorkspace()
    }

    func clearFinancialData() {
        _ = commitChanges {
            transactions = []
            invoices = []
            openingBalance = 0
        }
    }

    func resetUnreadableWorkspace() {
        guard requiresStorageRecovery else { return }
        let replacement = AppState(
            profile: Self.emptyProfile,
            transactions: [],
            invoices: [],
            openingBalance: 0
        )

        do {
            // Data.write(.atomic) replaces the unreadable file only after the new file
            // has been written successfully, so a failed reset does not first delete it.
            try vault.save(replacement)
            apply(replacement)
            requiresStorageRecovery = false
            storageNotice = nil
        } catch {
            storageNotice = "The unreadable workspace could not be reset. Your existing local file has not been replaced. Check available device storage or contact support."
        }
    }

    func dismissStorageNotice() {
        guard !requiresStorageRecovery else { return }
        storageNotice = nil
    }

    func evidence(for insight: FinancialInsight) -> [BusinessTransaction] {
        let ids = Set(insight.evidenceTransactionIDs)
        return transactions.filter { ids.contains($0.id) }
    }

    func currency(_ value: Double) -> String {
        value.formatted(.currency(code: profile.currencyCode).precision(.fractionLength(2)))
    }

    private var currentState: AppState {
        AppState(profile: profile, transactions: transactions, invoices: invoices, openingBalance: openingBalance)
    }

    private func apply(_ state: AppState) {
        profile = state.profile
        transactions = state.transactions
        invoices = state.invoices
        openingBalance = state.openingBalance
    }

    @discardableResult
    private func commitChanges(_ mutation: () -> Void) -> Bool {
        guard !requiresStorageRecovery else { return false }
        let previous = currentState
        mutation()

        do {
            try vault.save(currentState)
            storageNotice = nil
            return true
        } catch {
            apply(previous)
            storageNotice = "That change could not be saved, so Galactic Trust Business rolled it back to protect your local financial data. Check available device storage and try again."
            return false
        }
    }

    private func totalsForMonth(offset: Int) -> (income: Double, expense: Double) {
        let now = Date()
        guard let month = calendar.date(byAdding: .month, value: offset, to: now) else { return (0, 0) }
        let items = transactions.filter {
            $0.date <= now && calendar.isDate($0.date, equalTo: month, toGranularity: .month)
        }
        return (
            items.filter { $0.kind == .income }.reduce(0) { $0 + $1.amount },
            items.filter { $0.kind == .expense }.reduce(0) { $0 + $1.amount }
        )
    }

    private func percentChange(current: Double, previous: Double) -> Double {
        guard previous > 0 else { return 0 }
        return ((current - previous) / previous) * 100
    }

    private static func fallbackDuplicateKey(_ transaction: BusinessTransaction) -> String {
        "\(transaction.date.timeIntervalSince1970)|\(transaction.merchant)|\(transaction.amount)|\(transaction.kind.rawValue)"
    }

    private static var emptyProfile: BusinessProfile {
        BusinessProfile(name: "My Business", currencyCode: "USD", fiscalYearStartMonth: 1)
    }
}

private struct AppState: Codable {
    var profile: BusinessProfile
    var transactions: [BusinessTransaction]
    var invoices: [BusinessInvoice]
    var openingBalance: Double
}

private struct LocalVault {
    private var folder: URL {
        let base = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first!
        return base.appendingPathComponent("GalacticTrustBusiness", isDirectory: true)
    }

    private var url: URL {
        folder.appendingPathComponent("finance-v1.json")
    }

    var exists: Bool {
        FileManager.default.fileExists(atPath: url.path)
    }

    func load() throws -> AppState {
        let data = try Data(contentsOf: url)
        return try JSONDecoder().decode(AppState.self, from: data)
    }

    func save(_ state: AppState) throws {
        try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
        let data = try JSONEncoder().encode(state)
        try data.write(to: url, options: [.atomic, .completeFileProtection])
    }
}
