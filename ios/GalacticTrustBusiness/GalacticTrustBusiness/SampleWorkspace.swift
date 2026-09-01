import Foundation

@MainActor
extension FinancialStore {
    func loadBundledSampleWorkspace() {
        clearFinancialData()
        updateProfile(name: "Nova Enterprises")

        let calendar = Calendar.current
        let now = Date()
        let currentDay = max(1, calendar.component(.day, from: now))

        func sampleDate(monthOffset: Int, preferredDay: Int) -> Date {
            let shifted = calendar.date(byAdding: .month, value: monthOffset, to: now) ?? now
            var components = calendar.dateComponents([.year, .month], from: shifted)
            components.day = monthOffset == 0 ? min(preferredDay, currentDay) : preferredDay
            return calendar.date(from: components) ?? shifted
        }

        for monthOffset in -5 ... 0 {
            let incomeScale = 1.0 + Double(monthOffset) * 0.04

            addTransaction(BusinessTransaction(
                date: sampleDate(monthOffset: monthOffset, preferredDay: 3),
                merchant: "Northstar Client",
                memo: "Monthly client services",
                amount: 50_000 * incomeScale,
                kind: .income,
                category: .services,
                source: "Sample"
            ))
            addTransaction(BusinessTransaction(
                date: sampleDate(monthOffset: monthOffset, preferredDay: 9),
                merchant: "Orbit Retail",
                memo: "Monthly product revenue",
                amount: 20_000 * incomeScale,
                kind: .income,
                category: .sales,
                source: "Sample"
            ))
            addTransaction(BusinessTransaction(
                date: sampleDate(monthOffset: monthOffset, preferredDay: 12),
                merchant: "Team Payroll",
                memo: "Employee and contractor payroll",
                amount: 18_000,
                kind: .expense,
                category: .payroll,
                isRecurring: true,
                source: "Sample"
            ))
            addTransaction(BusinessTransaction(
                date: sampleDate(monthOffset: monthOffset, preferredDay: 16),
                merchant: "Cloud & Software",
                memo: "Business software services",
                amount: 5_000,
                kind: .expense,
                category: .software,
                isRecurring: true,
                source: "Sample"
            ))
            addTransaction(BusinessTransaction(
                date: sampleDate(monthOffset: monthOffset, preferredDay: 20),
                merchant: "Growth Marketing",
                memo: "Business marketing spend",
                amount: 5_000,
                kind: .expense,
                category: .marketing,
                source: "Sample"
            ))
            addTransaction(BusinessTransaction(
                date: sampleDate(monthOffset: monthOffset, preferredDay: 24),
                merchant: "Office Lease",
                memo: "Office rent and utilities",
                amount: 4_000,
                kind: .expense,
                category: .rentUtilities,
                isRecurring: true,
                source: "Sample"
            ))
        }

        addInvoice(BusinessInvoice(
            client: "Acme Corp",
            invoiceNumber: "INV-1004",
            amount: 3_250,
            dueDate: calendar.date(byAdding: .day, value: -4, to: now) ?? now,
            status: .overdue
        ))
        addInvoice(BusinessInvoice(
            client: "Stellar LLC",
            invoiceNumber: "INV-1007",
            amount: 2_600,
            dueDate: calendar.date(byAdding: .day, value: 8, to: now) ?? now,
            status: .sent
        ))
        addInvoice(BusinessInvoice(
            client: "Orbit Technologies",
            invoiceNumber: "INV-1009",
            amount: 1_000,
            dueDate: calendar.date(byAdding: .day, value: 15, to: now) ?? now,
            status: .draft
        ))
    }
}
