import Foundation

@MainActor
extension FinancialStore {
    /// Keeps the bundled review/demo workspace useful when a new calendar month
    /// begins. This only runs once per install and only when the untouched sample
    /// workspace still has historical data but no activity in the current month.
    func ensureDemoPreviewIsCurrent() {
        let marker = "galacticTrustBusiness.didRefreshDemoPreview.v1"
        guard !UserDefaults.standard.bool(forKey: marker) else { return }
        defer { UserDefaults.standard.set(true, forKey: marker) }

        guard profile.name == "Nova Enterprises",
              openingBalance == 42_000,
              !transactions.isEmpty,
              currentMonthTransactions.isEmpty
        else { return }

        let now = Date()
        let samples: [BusinessTransaction] = [
            .init(date: now, merchant: "Northstar Client", memo: "Project milestone", amount: 24_900, kind: .income, category: .services, source: "Sample"),
            .init(date: now, merchant: "Stellar Labs", memo: "Client payment", amount: 12_500, kind: .income, category: .services, source: "Sample"),
            .init(date: now, merchant: "Payroll", memo: "Employee salaries", amount: 9_800, kind: .expense, category: .payroll, isRecurring: true, source: "Sample"),
            .init(date: now, merchant: "Office Lease", memo: "Monthly rent", amount: 3_400, kind: .expense, category: .rentUtilities, isRecurring: true, source: "Sample"),
            .init(date: now, merchant: "Cloud Hosting", memo: "Infrastructure", amount: 2_140, kind: .expense, category: .software, isRecurring: true, source: "Sample"),
            .init(date: now, merchant: "Growth Campaigns", memo: "Advertising", amount: 1_250.75, kind: .expense, category: .marketing, source: "Sample"),
            .init(date: now, merchant: "Team Software", memo: "Collaboration tools", amount: 420, kind: .expense, category: .software, isRecurring: true, source: "Sample")
        ]

        addTransactions(samples)
    }
}
