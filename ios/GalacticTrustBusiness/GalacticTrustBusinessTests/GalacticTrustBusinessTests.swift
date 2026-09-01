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
}
