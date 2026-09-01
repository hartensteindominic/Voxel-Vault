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

    func testCSVImportRequiresDateColumn() {
        let csv = "Description,Amount\nClient Payment,1000\n"

        XCTAssertThrowsError(try CSVImportService.parse(csv)) { error in
            guard case CSVImportError.missingDate = error else {
                return XCTFail("Expected missingDate, got \(error)")
            }
        }
    }

    func testCSVImportRejectsUnclosedQuotedField() {
        let csv = "Date,Description,Amount\n2026-08-31,\"Broken field,1000\n"

        XCTAssertThrowsError(try CSVImportService.parse(csv)) { error in
            guard case CSVImportError.malformedCSV = error else {
                return XCTFail("Expected malformedCSV, got \(error)")
            }
        }
    }

    func testCSVImportRejectsNonFiniteAmounts() {
        let csv = "Date,Description,Amount\n2026-08-31,Invalid Amount,NaN\n"

        XCTAssertThrowsError(try CSVImportService.parse(csv)) { error in
            guard case CSVImportError.noValidRows = error else {
                return XCTFail("Expected noValidRows, got \(error)")
            }
        }
    }

    func testCSVImportRejectsFutureDatedRows() {
        let future = Calendar.current.date(byAdding: .day, value: 3, to: Date()) ?? Date().addingTimeInterval(259_200)
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.dateFormat = "yyyy-MM-dd"
        let csv = "Date,Description,Amount\n\(formatter.string(from: future)),Future Charge,-100\n"

        XCTAssertThrowsError(try CSVImportService.parse(csv)) { error in
            guard case CSVImportError.noValidRows = error else {
                return XCTFail("Expected noValidRows, got \(error)")
            }
        }
    }

    func testCSVImportPreservesLegitimateIdenticalRows() throws {
        let csv = """
        Date,Description,Amount
        2026-08-31,Same Vendor,-25
        2026-08-31,Same Vendor,-25
        """

        let rows = try CSVImportService.parse(csv)
        XCTAssertEqual(rows.count, 2)
        XCTAssertNotEqual(rows[0].sourceRecordID, rows[1].sourceRecordID)
    }

    func testCSVImportKeepsSourceIDsStableWhenExportAddsAnotherIdenticalRow() throws {
        let original = """
        Date,Description,Amount
        2026-08-31,Same Vendor,-25
        2026-08-31,Same Vendor,-25
        """
        let extended = """
        Date,Description,Amount
        2026-08-31,Same Vendor,-25
        2026-08-31,Same Vendor,-25
        2026-08-31,Same Vendor,-25
        """

        let first = try CSVImportService.parse(original)
        let second = try CSVImportService.parse(extended)
        XCTAssertEqual(first.map(\.sourceRecordID), Array(second.prefix(2)).map(\.sourceRecordID))
        XCTAssertNotEqual(second[1].sourceRecordID, second[2].sourceRecordID)
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
    func testInvalidInvoiceAmountIsRejected() {
        let store = FinancialStore()
        store.clearFinancialData()
        store.addInvoice(BusinessInvoice(
            client: "Invalid Client",
            invoiceNumber: "BAD-1",
            amount: .infinity,
            dueDate: Date(),
            status: .sent
        ))

        XCTAssertTrue(store.invoices.isEmpty)
        store.clearFinancialData()
    }

    @MainActor
    func testFutureDatedTransactionIsRejected() {
        let store = FinancialStore()
        store.clearFinancialData()
        let future = Calendar.current.date(byAdding: .day, value: 2, to: Date()) ?? Date().addingTimeInterval(172_800)
        store.addTransaction(BusinessTransaction(
            date: future,
            merchant: "Future Vendor",
            memo: "Should not affect actual cash activity",
            amount: 100,
            kind: .expense,
            category: .other
        ))

        XCTAssertTrue(store.transactions.isEmpty)
        XCTAssertEqual(store.balance, 0, accuracy: 0.001)
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
    func testWorkspaceDuplicateImportReportsOnlyNewRows() throws {
        let store = FinancialStore()
        store.clearFinancialData()
        let csv = """
        Date,Description,Amount
        2026-08-31,Duplicate Vendor,-42
        2026-08-31,Duplicate Vendor,-42
        """
        let rows = try CSVImportService.parse(csv)

        XCTAssertEqual(rows.count, 2)
        XCTAssertEqual(store.addTransactions(rows), 2)
        XCTAssertEqual(store.addTransactions(rows), 0)
        XCTAssertEqual(store.transactions.count, 2)

        store.clearFinancialData()
    }

    @MainActor
    func testExtendedCSVImportAddsOnlyNewRepeatedOccurrence() throws {
        let store = FinancialStore()
        store.clearFinancialData()
        let original = """
        Date,Description,Amount
        2026-08-31,Duplicate Vendor,-42
        2026-08-31,Duplicate Vendor,-42
        """
        let extended = """
        Date,Description,Amount
        2026-08-31,Duplicate Vendor,-42
        2026-08-31,Duplicate Vendor,-42
        2026-08-31,Duplicate Vendor,-42
        """

        XCTAssertEqual(store.addTransactions(try CSVImportService.parse(original)), 2)
        XCTAssertEqual(store.addTransactions(try CSVImportService.parse(extended)), 1)
        XCTAssertEqual(store.transactions.count, 3)

        store.clearFinancialData()
    }
}
