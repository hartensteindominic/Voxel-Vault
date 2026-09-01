import Foundation

@MainActor
extension FinancialStore {
    func financialAnswer(_ question: String) -> String {
        let normalized = question
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .lowercased()

        if transactions.isEmpty && invoices.isEmpty {
            return "There isn’t enough financial activity recorded yet. Add a transaction or import a CSV, and I can explain revenue, spending, recurring costs, invoices, cash flow, and cash coverage from those records."
        }

        let calendar = Calendar.current
        let now = Date()
        let previousMonthDate = calendar.date(byAdding: .month, value: -1, to: now) ?? now
        let previousMonthItems = transactions.filter {
            $0.date <= now && calendar.isDate($0.date, equalTo: previousMonthDate, toGranularity: .month)
        }
        let previousIncome = previousMonthItems
            .filter { $0.kind == .income }
            .reduce(0) { $0 + $1.amount }
        let previousExpenses = previousMonthItems
            .filter { $0.kind == .expense }
            .reduce(0) { $0 + $1.amount }

        if containsAny(normalized, ["why did spending change", "spending change", "expenses change", "expense change", "spending increase", "spending decrease"]) {
            let top = expenseByCategory.first
            if previousExpenses <= 0 {
                if currentMonthExpenses <= 0 {
                    return "No expenses are recorded this month, so there isn’t a spending change to explain yet."
                }
                let topText = top.map { " The largest current category is \($0.category.rawValue) at \(currency($0.amount))." } ?? ""
                return "You recorded \(currency(currentMonthExpenses)) of expenses this month, but there isn’t a prior-month expense baseline to calculate a meaningful percentage change.\(topText)"
            }

            let difference = currentMonthExpenses - previousExpenses
            let percent = difference / previousExpenses * 100
            let direction = difference > 0 ? "up" : (difference < 0 ? "down" : "unchanged")
            let topText = top.map { " Your largest current category is \($0.category.rawValue) at \(currency($0.amount))." } ?? ""
            return "Spending is \(direction) \(abs(percent).formatted(.number.precision(.fractionLength(1))))% from last month: \(currency(previousExpenses)) then versus \(currency(currentMonthExpenses)) now.\(topText)"
        }

        if containsAny(normalized, ["revenue change", "income change", "revenue trend", "income trend", "revenue up", "revenue down"]) {
            if previousIncome <= 0 {
                return "You recorded \(currency(currentMonthIncome)) of income this month, but there isn’t a prior-month income baseline to calculate a meaningful percentage change."
            }
            let difference = currentMonthIncome - previousIncome
            let percent = difference / previousIncome * 100
            let direction = difference > 0 ? "up" : (difference < 0 ? "down" : "unchanged")
            return "Revenue is \(direction) \(abs(percent).formatted(.number.precision(.fractionLength(1))))% from last month: \(currency(previousIncome)) then versus \(currency(currentMonthIncome)) now."
        }

        if containsAny(normalized, ["subscription", "recurring", "repeat charge", "monthly cost"]) {
            let recurring = currentMonthTransactions
                .filter { $0.kind == .expense && $0.isRecurring }
                .sorted { $0.amount > $1.amount }
            let total = recurring.reduce(0) { $0 + $1.amount }
            if recurring.isEmpty {
                return "No expenses are marked recurring this month. You can mark recurring charges when adding transactions."
            }
            let names = recurring.prefix(3).map(\.merchant).joined(separator: ", ")
            return "Recurring expenses total \(currency(total)) this month across \(recurring.count) recorded charge\(recurring.count == 1 ? "" : "s"). The largest recorded recurring items include \(names)."
        }

        if containsAny(normalized, ["invoice", "owe", "receivable", "overdue", "customer owe"]) {
            let overdueTotal = overdueInvoices.reduce(0) { $0 + $1.amount }
            if invoices.isEmpty {
                return "No invoices are recorded yet. Add an invoice from More → Invoices & receivables to monitor amounts due and overdue."
            }
            return "You have \(currency(outstandingInvoices)) in sent or overdue invoices. \(overdueInvoices.count) invoice\(overdueInvoices.count == 1 ? " is" : "s are") overdue, totaling \(currency(overdueTotal)). Draft invoices are not included in the outstanding total."
        }

        if containsAny(normalized, ["largest vendor", "top vendor", "vendor spend", "biggest vendor", "top payee"]) {
            let vendors = Dictionary(grouping: currentMonthTransactions.filter { $0.kind == .expense }, by: \.merchant)
                .map { name, items in (name, items.reduce(0) { $0 + $1.amount }) }
                .sorted { $0.1 > $1.1 }
            if let top = vendors.first {
                return "Your largest recorded vendor or payee this month is \(top.0) at \(currency(top.1))."
            }
            return "No vendor expenses are recorded this month yet."
        }

        if containsAny(normalized, ["profit", "net income", "gross profit", "operating profit"]) {
            return "This version does not calculate accounting profit or net income because it does not track accrual adjustments, cost of goods sold, depreciation, or other accounting entries. It can report recorded cash flow: this month you received \(currency(currentMonthIncome)), spent \(currency(currentMonthExpenses)), and recorded \(currency(currentMonthNet)) of net cash flow."
        }

        if containsAny(normalized, ["net cash", "cash flow", "cashflow"]) {
            let direction = currentMonthNet > 0 ? "positive" : (currentMonthNet < 0 ? "negative" : "flat")
            return "Net cash flow is \(currency(currentMonthNet)) this month, which is \(direction): \(currency(currentMonthIncome)) received minus \(currency(currentMonthExpenses)) spent."
        }

        if containsAny(normalized, ["runway", "cash balance", "balance", "coverage", "how long", "cash on hand"]) {
            guard let pace = rollingExpensePace(calendar: calendar, now: now) else {
                return "Your recorded cash balance is \(currency(balance)). There isn’t enough recent expense activity to estimate cash coverage yet."
            }
            let coverageMonths = max(balance, 0) / pace.estimatedThirtyDayExpenses
            return "Your recorded cash balance is \(currency(balance)). Based on an estimated 30-day expense pace of \(currency(pace.estimatedThirtyDayExpenses)) from the last \(pace.daysObserved) recorded calendar day\(pace.daysObserved == 1 ? "" : "s"), that is about \(coverageMonths.formatted(.number.precision(.fractionLength(1)))) months of simple expense coverage. This is a planning estimate, not a liquidity guarantee."
        }

        if containsAny(normalized, ["revenue", "income", "received", "sales came in", "money came in"]) {
            return "You received \(currency(currentMonthIncome)) this month. After \(currency(currentMonthExpenses)) of recorded expenses, net cash flow is \(currency(currentMonthNet))."
        }

        if containsAny(normalized, ["spend", "spent", "expense", "cost", "money went out"]) {
            if let top = expenseByCategory.first {
                let share = currentMonthExpenses > 0 ? top.amount / currentMonthExpenses * 100 : 0
                return "You spent \(currency(currentMonthExpenses)) this month. The largest category is \(top.category.rawValue) at \(currency(top.amount)), about \(share.formatted(.number.precision(.fractionLength(0))))% of recorded spending."
            }
            return "No expenses are recorded for this month yet."
        }

        return "This month, you recorded \(currency(currentMonthIncome)) received, \(currency(currentMonthExpenses)) spent, and \(currency(currentMonthNet)) net cash flow. You can ask me about spending changes, revenue trends, invoices, recurring costs, cash coverage, or your largest vendor."
    }

    private func rollingExpensePace(calendar: Calendar, now: Date) -> (daysObserved: Int, estimatedThirtyDayExpenses: Double)? {
        let eligible = transactions.filter { $0.date <= now }
        guard let earliestDate = eligible.map(\.date).min() else { return nil }

        let today = calendar.startOfDay(for: now)
        let thirtyDayStart = calendar.date(byAdding: .day, value: -29, to: today) ?? today
        let earliestDay = calendar.startOfDay(for: earliestDate)
        let start = max(earliestDay, thirtyDayStart)
        let items = eligible.filter { $0.date >= start && $0.kind == .expense }
        let expenses = items.reduce(0) { $0 + $1.amount }
        guard expenses > 0 else { return nil }

        let daysObserved = max(1, (calendar.dateComponents([.day], from: start, to: today).day ?? 0) + 1)
        let estimatedThirtyDayExpenses = expenses / Double(daysObserved) * 30
        guard estimatedThirtyDayExpenses.isFinite, estimatedThirtyDayExpenses > 0 else { return nil }
        return (daysObserved, estimatedThirtyDayExpenses)
    }

    private func containsAny(_ text: String, _ phrases: [String]) -> Bool {
        phrases.contains { text.contains($0) }
    }
}
