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

    @MainActor
    func testDemoWorkspaceAlwaysHasCurrentMonthActivity() {
        let store = FinancialStore()
        store.resetToDemo()

        XCTAssertGreaterThan(store.currentMonthIncome, 0)
        XCTAssertGreaterThan(store.currentMonthExpenses, 0)
        XCTAssertGreaterThan(store.currentMonthNet, 0)
    }
}
