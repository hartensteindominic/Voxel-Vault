import Foundation

@MainActor
extension FinancialStore {
    var expenseCoverageMonths: Double {
        guard currentMonthExpenses > 0 else { return balance > 0 ? 6 : 0 }
        return max(balance, 0) / currentMonthExpenses
    }

    var businessHealthScore: Int {
        var score = 60

        if currentMonthNet > 0 {
            score += 15
        } else if currentMonthNet < 0 {
            score -= 15
        }

        switch expenseCoverageMonths {
        case 3...:
            score += 15
        case 1..<3:
            score += 7
        default:
            score -= 12
        }

        let overdueTotal = overdueInvoices.reduce(0) { $0 + $1.amount }
        if overdueTotal == 0 {
            score += 8
        } else if overdueTotal > max(currentMonthIncome * 0.20, 1_000) {
            score -= 12
        } else {
            score -= 5
        }

        let previousExpense = previousMonthTransactions
            .filter { $0.kind == .expense }
            .reduce(0) { $0 + $1.amount }
        if previousExpense > 0 {
            let growth = (currentMonthExpenses - previousExpense) / previousExpense
            if growth > 0.25 {
                score -= 10
            } else if growth <= 0 {
                score += 5
            }
        }

        return min(100, max(0, score))
    }

    var businessHealthLabel: String {
        switch businessHealthScore {
        case 80...: "Strong"
        case 65..<80: "Healthy"
        case 50..<65: "Watch"
        default: "Needs attention"
        }
    }

    func smartAnswer(_ question: String) -> String {
        let q = question.lowercased()

        if q.contains("health") || q.contains("healthy") {
            let overdueTotal = overdueInvoices.reduce(0) { $0 + $1.amount }
            let cashFlowText = currentMonthNet >= 0 ? "positive" : "negative"
            return "Your business health score is \(businessHealthScore)/100 (\(businessHealthLabel)). Recorded cash flow is \(cashFlowText) at \(currency(currentMonthNet)), expense coverage is about \(expenseCoverageMonths.formatted(.number.precision(.fractionLength(1)))) months, and \(currency(overdueTotal)) of invoices are overdue. This is a planning signal based only on records in this app."
        }

        if (q.contains("why") || q.contains("change") || q.contains("changed")) &&
            (q.contains("spend") || q.contains("expense") || q.contains("cost")) {
            return spendingChangeExplanation()
        }

        if q.contains("forecast") || q.contains("project") || q.contains("scenario") {
            let projected = balance + currentMonthNet
            return "If this month’s recorded net cash flow repeated for one more month, your projected recorded cash balance would be about \(currency(projected)). Use the Scenario Lab in Cash Flow to test higher or lower revenue and expenses. This is a planning estimate, not a guarantee."
        }

        if q.contains("risk") || q.contains("attention") || q.contains("worry") {
            let important = insights.filter { $0.severity == .critical || $0.severity == .warning }
            if important.isEmpty {
                return "I do not see a high-priority warning in the current records. Your business health score is \(businessHealthScore)/100, but you should still review cash flow, overdue invoices, and recurring costs regularly."
            }
            let summary = important.prefix(3).map(\.title).joined(separator: "; ")
            return "The main items that need attention are: \(summary). Open the insight cards to review the underlying evidence before making a business decision."
        }

        return answer(question)
    }

    private var previousMonthTransactions: [BusinessTransaction] {
        let calendar = Calendar.current
        guard let previousMonth = calendar.date(byAdding: .month, value: -1, to: Date()) else { return [] }
        return transactions.filter { calendar.isDate($0.date, equalTo: previousMonth, toGranularity: .month) }
    }

    private func spendingChangeExplanation() -> String {
        let previousExpenses = previousMonthTransactions.filter { $0.kind == .expense }
        let previousTotal = previousExpenses.reduce(0) { $0 + $1.amount }

        guard previousTotal > 0 else {
            if let top = expenseByCategory.first {
                return "There is not enough previous-month expense data for a reliable comparison yet. This month you have recorded \(currency(currentMonthExpenses)) in expenses, led by \(top.category.rawValue) at \(currency(top.amount))."
            }
            return "There is not enough expense history yet to explain a spending change. Add or import more transactions to build a comparison baseline."
        }

        let delta = currentMonthExpenses - previousTotal
        let percent = abs(delta / previousTotal * 100)
        let direction = delta >= 0 ? "up" : "down"

        let currentByCategory = Dictionary(grouping: currentMonthTransactions.filter { $0.kind == .expense }, by: \.category)
            .mapValues { $0.reduce(0) { $0 + $1.amount } }
        let previousByCategory = Dictionary(grouping: previousExpenses, by: \.category)
            .mapValues { $0.reduce(0) { $0 + $1.amount } }

        let categories = Set(currentByCategory.keys).union(previousByCategory.keys)
        let largestIncrease = categories
            .map { category in
                (category: category, change: (currentByCategory[category] ?? 0) - (previousByCategory[category] ?? 0))
            }
            .max { $0.change < $1.change }

        var explanation = "Expenses are \(direction) \(percent.formatted(.number.precision(.fractionLength(0))))% versus last month (\(currency(abs(delta))) \(delta >= 0 ? "more" : "less"))."

        if let largestIncrease, largestIncrease.change > 0 {
            explanation += " The largest category increase is \(largestIncrease.category.rawValue), up \(currency(largestIncrease.change))."
        } else if let top = expenseByCategory.first {
            explanation += " Your largest current expense category is \(top.category.rawValue) at \(currency(top.amount))."
        }

        explanation += " Open the evidence-backed insights to inspect the underlying transactions."
        return explanation
    }
}
