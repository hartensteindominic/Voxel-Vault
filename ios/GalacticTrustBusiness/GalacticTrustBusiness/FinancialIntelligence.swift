import Foundation

@MainActor
extension FinancialStore {
    func smartAnswer(_ question: String) -> String {
        let q = question
            .lowercased()
            .replacingOccurrences(of: "’", with: "'")
            .trimmingCharacters(in: .whitespacesAndNewlines)

        let previous = totalsForRelativeMonth(-1)
        let incomeChange = percentDelta(current: currentMonthIncome, previous: previous.income)
        let expenseChange = percentDelta(current: currentMonthExpenses, previous: previous.expense)

        if containsAny(q, ["what changed", "change this month", "different this month", "summary", "overview"]) {
            var parts: [String] = []
            parts.append("This month you received \(currency(currentMonthIncome)) and spent \(currency(currentMonthExpenses)), for \(currency(currentMonthNet)) in net cash flow.")

            if previous.income > 0 {
                parts.append("Revenue is \(directionText(incomeChange)) versus last month.")
            }
            if previous.expense > 0 {
                parts.append("Spending is \(directionText(expenseChange)) versus last month.")
            }
            if !overdueInvoices.isEmpty {
                let overdue = overdueInvoices.reduce(0) { $0 + $1.amount }
                parts.append("\(currency(overdue)) in receivables is overdue.")
            }
            return parts.joined(separator: " ")
        }

        if containsAny(q, ["why did spending", "why spending", "spending change", "expenses change", "why did expenses"]) {
            guard currentMonthExpenses > 0 else {
                return "No expenses are recorded for this month yet, so I do not have enough current activity to explain a spending change."
            }

            let top = expenseByCategory.first
            let largest = currentMonthTransactions
                .filter { $0.kind == .expense }
                .max { $0.amount < $1.amount }

            var answer = "You spent \(currency(currentMonthExpenses)) this month"
            if previous.expense > 0 {
                answer += ", \(directionText(expenseChange)) versus last month"
            }
            answer += "."

            if let top {
                let share = currentMonthExpenses > 0 ? top.amount / currentMonthExpenses * 100 : 0
                answer += " \(top.category.rawValue) is the largest category at \(currency(top.amount)) (\(share.formatted(.number.precision(.fractionLength(0))))% of spending)."
            }
            if let largest {
                answer += " The largest recorded charge is \(currency(largest.amount)) to \(largest.merchant)."
            }
            return answer
        }

        if containsAny(q, ["biggest expense", "largest expense", "largest charge", "biggest charge"]) {
            guard let item = currentMonthTransactions
                .filter({ $0.kind == .expense })
                .max(by: { $0.amount < $1.amount }) else {
                return "No expenses are recorded for this month yet."
            }
            return "Your largest recorded expense this month is \(currency(item.amount)) to \(item.merchant), categorized as \(item.category.rawValue)."
        }

        if containsAny(q, ["vendor", "supplier", "who am i paying", "who do i pay"]) {
            let expenses = currentMonthTransactions.filter { $0.kind == .expense }
            guard !expenses.isEmpty else { return "No vendor expenses are recorded for this month yet." }

            let ranked = Dictionary(grouping: expenses, by: \.merchant)
                .map { merchant, items in
                    (merchant: merchant, amount: items.reduce(0) { $0 + $1.amount })
                }
                .sorted { $0.amount > $1.amount }
                .prefix(3)

            let text = ranked.map { "\($0.merchant) \(currency($0.amount))" }.joined(separator: ", ")
            return "Your top recorded payees this month are \(text)."
        }

        if containsAny(q, ["attention", "focus", "risk", "worry", "problem", "warning"]) {
            guard !insights.isEmpty else {
                return "I do not see a major alert in the records currently loaded. Keep transaction and invoice data current so the analysis has a stronger baseline."
            }
            let priorities = insights.prefix(3).map(\.title).joined(separator: "; ")
            return "The main items I would review are: \(priorities). These are planning signals from the records in this app, not accounting or investment advice."
        }

        if containsAny(q, ["afford", "can i spend", "what if i spend", "purchase"]) && firstMoneyAmount(in: q) != nil {
            let amount = firstMoneyAmount(in: q) ?? 0
            let after = balance - amount
            let coverage = currentMonthExpenses > 0 ? max(after, 0) / currentMonthExpenses : 0
            return "If you recorded a \(currency(amount)) cash expense now, your modeled cash balance would be about \(currency(after)). At this month's recorded expense pace, that would leave about \(coverage.formatted(.number.precision(.fractionLength(1)))) months of expense coverage. This is a simple scenario, not a recommendation or guarantee."
        }

        if containsAny(q, ["revenue trend", "income trend", "sales trend", "revenue change", "income change"]) {
            if previous.income <= 0 {
                return "You received \(currency(currentMonthIncome)) this month. I do not have a non-zero prior-month revenue baseline for a meaningful percentage comparison."
            }
            return "You received \(currency(currentMonthIncome)) this month versus \(currency(previous.income)) last month, so revenue is \(directionText(incomeChange))."
        }

        if containsAny(q, ["recurring", "subscription", "subscriptions", "fixed cost", "fixed costs"]) {
            let recurring = currentMonthTransactions.filter { $0.kind == .expense && $0.isRecurring }
            let total = recurring.reduce(0) { $0 + $1.amount }
            guard !recurring.isEmpty else { return "No expenses are marked recurring this month." }

            let names = recurring
                .sorted { $0.amount > $1.amount }
                .prefix(4)
                .map { "\($0.merchant) \(currency($0.amount))" }
                .joined(separator: ", ")
            return "Recurring expenses total \(currency(total)) this month across \(recurring.count) recorded charge\(recurring.count == 1 ? "" : "s"). The largest are \(names)."
        }

        if containsAny(q, ["invoice", "invoices", "receivable", "receivables", "who owes", "overdue"]) {
            let overdue = overdueInvoices.reduce(0) { $0 + $1.amount }
            if overdueInvoices.isEmpty {
                return "You have \(currency(outstandingInvoices)) in unpaid invoices and none are currently marked overdue."
            }
            let clients = overdueInvoices.prefix(3).map { "\($0.client) \(currency($0.amount))" }.joined(separator: ", ")
            return "You have \(currency(outstandingInvoices)) in unpaid invoices. \(currency(overdue)) is overdue, including \(clients)."
        }

        if containsAny(q, ["runway", "cash coverage", "how long", "cash last"]) {
            guard currentMonthExpenses > 0 else {
                return "Your recorded cash balance is \(currency(balance)). I need at least one month of recorded expenses to estimate cash coverage."
            }
            let runway = max(balance, 0) / currentMonthExpenses
            return "Your recorded cash balance is \(currency(balance)). At this month's expense pace of \(currency(currentMonthExpenses)), that is about \(runway.formatted(.number.precision(.fractionLength(1)))) months of coverage. This is a planning estimate, not a liquidity guarantee."
        }

        if containsAny(q, ["revenue", "income", "received", "sales"]) {
            return "You received \(currency(currentMonthIncome)) this month. After \(currency(currentMonthExpenses)) in recorded expenses, net cash flow is \(currency(currentMonthNet))."
        }

        if containsAny(q, ["spend", "spending", "expense", "expenses", "cost", "costs"]) {
            if let top = expenseByCategory.first {
                return "You spent \(currency(currentMonthExpenses)) this month. Your largest category is \(top.category.rawValue) at \(currency(top.amount)). Ask why spending changed or what your largest charge was for a deeper breakdown."
            }
            return "No expenses are recorded for this month yet."
        }

        if containsAny(q, ["cash", "balance"]) {
            return "Your recorded cash balance is \(currency(balance)). This is the balance modeled from the opening balance plus transactions stored in this app; it is not a live bank balance."
        }

        return "This month you received \(currency(currentMonthIncome)), spent \(currency(currentMonthExpenses)), and recorded \(currency(currentMonthNet)) in net cash flow. I can dig into spending changes, top vendors, largest expenses, invoices, recurring costs, cash coverage, or a what-if purchase amount."
    }

    private func totalsForRelativeMonth(_ offset: Int) -> (income: Double, expense: Double) {
        let calendar = Calendar.current
        guard let month = calendar.date(byAdding: .month, value: offset, to: Date()) else { return (0, 0) }
        let items = transactions.filter { calendar.isDate($0.date, equalTo: month, toGranularity: .month) }
        return (
            items.filter { $0.kind == .income }.reduce(0) { $0 + $1.amount },
            items.filter { $0.kind == .expense }.reduce(0) { $0 + $1.amount }
        )
    }

    private func percentDelta(current: Double, previous: Double) -> Double {
        guard abs(previous) > 0.001 else { return current == 0 ? 0 : 100 }
        return ((current - previous) / abs(previous)) * 100
    }

    private func directionText(_ change: Double) -> String {
        if abs(change) < 0.5 { return "about flat" }
        let amount = abs(change).formatted(.number.precision(.fractionLength(0)))
        return change > 0 ? "up \(amount)%" : "down \(amount)%"
    }

    private func containsAny(_ text: String, _ phrases: [String]) -> Bool {
        phrases.contains { text.contains($0) }
    }

    private func firstMoneyAmount(in text: String) -> Double? {
        let pattern = #"(?:\$\s*)?([0-9]+(?:,[0-9]{3})*(?:\.[0-9]{1,2})?)"#
        guard let regex = try? NSRegularExpression(pattern: pattern),
              let match = regex.firstMatch(in: text, range: NSRange(text.startIndex..., in: text)),
              match.numberOfRanges > 1,
              let range = Range(match.range(at: 1), in: text)
        else { return nil }

        let normalized = String(text[range]).replacingOccurrences(of: ",", with: "")
        return Double(normalized)
    }
}
