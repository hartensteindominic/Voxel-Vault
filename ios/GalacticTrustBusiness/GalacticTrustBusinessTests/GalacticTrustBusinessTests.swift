import XCTest
@testable import GalacticTrustBusiness

final class GalacticTrustBusinessTests: XCTestCase {
    func testSignedTransactionAmount() {
        let income = BusinessTransaction(date: .now, merchant: "Client", memo: "", amount: 125, kind: .income, category: .services)
        let expense = BusinessTransaction(date: .now, merchant: "Vendor", memo: "", amount: 80, kind: .expense, category: .software)
        XCTAssertEqual(income.signedAmount, 125)
        XCTAssertEqual(expense.signedAmount, -80)
    }

    func testCSVImportHandlesSignedAmountsAndQuotes() throws {
        let csv = """
        Date,Description,Amount
        08/31/2026,"Client, Inc.",4500
        08/30/2026,AWS,-638.25
        """

        let rows = try CSVImportService.parse(csv)
        XCTAssertEqual(rows.count, 2)
        XCTAssertEqual(rows[0].merchant, "Client, Inc.")
        XCTAssertEqual(rows[0].kind, .income)
        XCTAssertEqual(rows[1].kind, .expense)
        XCTAssertEqual(rows[1].category, .software)
        XCTAssertEqual(rows[1].amount, 638.25, accuracy: 0.001)
    }

    func testCSVImportSupportsDebitAndCreditColumns() throws {
        let csv = """
        Date,Description,Debit,Credit
        2026-08-31,Office Supply,120.50,
        2026-08-31,Customer Payment,,900
        """

        let rows = try CSVImportService.parse(csv)
        XCTAssertEqual(rows.count, 2)
        XCTAssertEqual(rows[0].kind, .expense)
        XCTAssertEqual(rows[1].kind, .income)
    }

    func testCSVImportDoesNotTreatDebitAmountAsGenericAmount() throws {
        let csv = """
        Date,Description,Debit Amount,Credit Amount
        2026-08-31,Payroll,1200,
        2026-08-31,Client Payment,,2400
        """

        let rows = try CSVImportService.parse(csv)
        XCTAssertEqual(rows.count, 2)
        XCTAssertEqual(rows[0].kind, .expense)
        XCTAssertEqual(rows[0].amount, 1200, accuracy: 0.001)
        XCTAssertEqual(rows[1].kind, .income)
        XCTAssertEqual(rows[1].amount, 2400, accuracy: 0.001)
    }

    func testCSVImportSkipsRowsWithInvalidExplicitDates() throws {
        let csv = """
        Date,Description,Amount
        2026-08-31,Valid Client,1000
        definitely-not-a-date,Bad Row,-400
        """

        let rows = try CSVImportService.parse(csv)
        XCTAssertEqual(rows.count, 1)
        XCTAssertEqual(rows[0].merchant, "Valid Client")
    }

    func testCSVImportDeduplicatesRepeatedRowsWithinFile() throws {
        let csv = """
        Date,Description,Amount
        2026-08-31,Same Client,1000
        2026-08-31,Same Client,1000
        """

        let rows = try CSVImportService.parse(csv)
        XCTAssertEqual(rows.count, 1)
    }

    func testCSVImportAcceptsUTF8BOMHeader() throws {
        let csv = "\u{FEFF}Date,Description,Amount\n2026-08-31,BOM Client,1250\n"
        let rows = try CSVImportService.parse(csv)

        XCTAssertEqual(rows.count, 1)
        XCTAssertEqual(rows[0].merchant, "BOM Client")
        XCTAssertEqual(rows[0].kind, .income)

        let expected = Calendar.current.date(from: DateComponents(year: 2026, month: 8, day: 31))
        XCTAssertNotNil(expected)
        if let expected {
            XCTAssertTrue(Calendar.current.isDate(rows[0].date, inSameDayAs: expected))
        }
    }

    @MainActor
    func testStartingCashDoesNotCountAsRevenueOrExpense() {
        let store = FinancialStore()
        store.clearFinancialData()
        store.updateOpeningBalance(5_000)

        XCTAssertEqual(store.openingBalance, 5_000, accuracy: 0.001)
        XCTAssertEqual(store.balance, 5_000, accuracy: 0.001)
        XCTAssertEqual(store.currentMonthIncome, 0, accuracy: 0.001)
        XCTAssertEqual(store.currentMonthExpenses, 0, accuracy: 0.001)
        XCTAssertEqual(store.currentMonthNet, 0, accuracy: 0.001)

        store.clearFinancialData()
    }

    @MainActor
    func testDraftInvoiceIsNotOutstandingOrOverdue() {
        let store = FinancialStore()
        store.clearFinancialData()
        let yesterday = Calendar.current.date(byAdding: .day, value: -1, to: Date()) ?? Date()
        store.addInvoice(BusinessInvoice(
            client: "Draft Client",
            invoiceNumber: "DRAFT-1",
            amount: 900,
            dueDate: yesterday,
            status: .draft
        ))

        XCTAssertEqual(store.outstandingInvoices, 0, accuracy: 0.001)
        XCTAssertTrue(store.overdueInvoices.isEmpty)

        store.clearFinancialData()
    }

    @MainActor
    func testTrendAlertsRequirePriorMonthBaseline() {
        let store = FinancialStore()
        store.clearFinancialData()
        store.addTransaction(BusinessTransaction(
            date: Date(),
            merchant: "First Client",
            memo: "First recorded revenue",
            amount: 2_000,
            kind: .income,
            category: .services
        ))
        store.addTransaction(BusinessTransaction(
            date: Date(),
            merchant: "First Vendor",
            memo: "First recorded expense",
            amount: 500,
            kind: .expense,
            category: .software
        ))

        XCTAssertFalse(store.insights.contains { $0.title.hasPrefix("Revenue is up") })
        XCTAssertFalse(store.insights.contains { $0.title == "Spending increased quickly" })

        store.clearFinancialData()
    }

    @MainActor
    func testWorkspaceDuplicateImportReportsOnlyNewRows() {
        let store = FinancialStore()
        store.clearFinancialData()
        let row = BusinessTransaction(
            date: Date(timeIntervalSince1970: 1_800_000_000),
            merchant: "Duplicate Vendor",
            memo: "Imported from CSV",
            amount: 42,
            kind: .expense,
            category: .other,
            source: "CSV"
        )

        XCTAssertEqual(store.addTransactions([row]), 1)
        XCTAssertEqual(store.addTransactions([row]), 0)
        XCTAssertEqual(store.transactions.count, 1)

        store.clearFinancialData()
    }
}
