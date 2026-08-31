import Foundation

struct BusinessProfile: Codable, Equatable {
    var name: String = "Nova Enterprises"
    var currencyCode: String = "USD"
    var fiscalYearStartMonth: Int = 1
}

enum TransactionKind: String, Codable, CaseIterable, Identifiable {
    case income = "Income"
    case expense = "Expense"

    var id: String { rawValue }
}

enum FinanceCategory: String, Codable, CaseIterable, Identifiable {
    case sales = "Sales"
    case services = "Services"
    case payroll = "Payroll"
    case software = "Software"
    case marketing = "Marketing"
    case office = "Office"
    case rentUtilities = "Rent & Utilities"
    case travel = "Travel"
    case taxes = "Taxes"
    case fees = "Fees"
    case other = "Other"

    var id: String { rawValue }
}

struct BusinessTransaction: Identifiable, Codable, Equatable {
    var id = UUID()
    var date: Date
    var merchant: String
    var memo: String
    var amount: Double
    var kind: TransactionKind
    var category: FinanceCategory
    var isRecurring: Bool = false
    var source: String = "Manual"

    var signedAmount: Double {
        kind == .income ? amount : -amount
    }
}

struct BusinessInvoice: Identifiable, Codable, Equatable {
    enum Status: String, Codable, CaseIterable {
        case draft = "Draft"
        case sent = "Sent"
        case paid = "Paid"
        case overdue = "Overdue"
    }

    var id = UUID()
    var client: String
    var invoiceNumber: String
    var amount: Double
    var dueDate: Date
    var status: Status
}

enum InsightSeverity: String, Codable {
    case positive, information, warning, critical
}

struct FinancialInsight: Identifiable, Codable, Equatable {
    var id = UUID()
    var title: String
    var detail: String
    var severity: InsightSeverity
    var amountImpact: Double? = nil
    var evidenceTransactionIDs: [UUID] = []
}

struct MonthlyPoint: Identifiable, Equatable {
    var id: String { label }
    let label: String
    let income: Double
    let expense: Double
}

struct CategoryTotal: Identifiable, Equatable {
    var id: FinanceCategory { category }
    let category: FinanceCategory
    let amount: Double
}
