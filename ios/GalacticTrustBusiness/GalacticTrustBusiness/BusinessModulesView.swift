import SwiftUI
import Charts

struct BusinessModuleView: View {
    enum Kind {
        case accounts, expenses, customers, vendors, payroll, reports, budgets, alerts, help
    }

    @EnvironmentObject private var store: FinancialStore
    let kind: Kind

    var body: some View {
        ScrollView {
            LazyVStack(spacing: 16) {
                header
                content
            }
            .padding(18)
            .padding(.bottom, 28)
        }
        .background(GalacticTheme.page.ignoresSafeArea())
        .navigationTitle(title)
        .navigationBarTitleDisplayMode(.inline)
    }

    @ViewBuilder
    private var content: some View {
        switch kind {
        case .accounts:
            accounts
        case .expenses:
            expenses
        case .customers:
            counterparties(kind: .income, empty: "No customer receipts yet")
        case .vendors:
            counterparties(kind: .expense, empty: "No vendor expenses yet")
        case .payroll:
            filteredTransactions(category: .payroll, empty: "No payroll records yet")
        case .reports:
            reports
        case .budgets:
            budgets
        case .alerts:
            alerts
        case .help:
            help
        }
    }

    private var title: String {
        switch kind {
        case .accounts: "Accounts"
        case .expenses: "Expenses"
        case .customers: "Customers"
        case .vendors: "Vendors"
        case .payroll: "Payroll"
        case .reports: "Reports"
        case .budgets: "Budgets"
        case .alerts: "Alerts & Insights"
        case .help: "Help Center"
        }
    }

    private var subtitle: String {
        switch kind {
        case .accounts: "Your recorded business cash position and activity."
        case .expenses: "Understand where operating money is going."
        case .customers: "See customers and clients who have paid your business."
        case .vendors: "Track vendors receiving the most business spend."
        case .payroll: "Review payroll transactions and monthly payroll spend."
        case .reports: "A six-month operating view of income and expenses."
        case .budgets: "Compare current category spend with simple planning targets."
        case .alerts: "Explainable financial signals generated from your records."
        case .help: "Quick guidance for using Galactic Trust Business."
        }
    }

    private var header: some View {
        HStack(alignment: .center, spacing: 14) {
            Image(systemName: headerIcon)
                .font(.title2.bold())
                .foregroundStyle(.white)
                .frame(width: 50, height: 50)
                .background(GalacticTheme.heroGradient)
                .clipShape(RoundedRectangle(cornerRadius: 15, style: .continuous))

            VStack(alignment: .leading, spacing: 3) {
                Text(title)
                    .font(.title2.bold())
                    .foregroundStyle(GalacticTheme.navy)
                Text(subtitle)
                    .font(.subheadline)
                    .foregroundStyle(GalacticTheme.mutedText)
            }
            Spacer()
        }
    }

    private var headerIcon: String {
        switch kind {
        case .accounts: "creditcard.fill"
        case .expenses: "receipt.fill"
        case .customers: "person.2.fill"
        case .vendors: "building.2.fill"
        case .payroll: "banknote.fill"
        case .reports: "chart.bar.doc.horizontal.fill"
        case .budgets: "chart.pie.fill"
        case .alerts: "bell.badge.fill"
        case .help: "questionmark.circle.fill"
        }
    }

    private var accounts: some View {
        VStack(spacing: 16) {
            HStack(spacing: 12) {
                MetricTile(title: "Recorded cash", value: store.currency(store.balance), subtitle: "Current app balance", systemImage: "building.columns.fill", tint: GalacticTheme.violet)
                MetricTile(title: "Net cash flow", value: store.currency(store.currentMonthNet), subtitle: "This month", systemImage: "arrow.up.arrow.down", tint: GalacticTheme.blue)
            }

            GalacticCard {
                VStack(alignment: .leading, spacing: 12) {
                    SectionHeader(title: "Recent account activity")
                    ForEach(store.transactions.prefix(10)) { transaction in
                        transactionRow(transaction)
                    }
                }
            }
        }
    }

    private var expenses: some View {
        VStack(spacing: 16) {
            GalacticCard {
                VStack(alignment: .leading, spacing: 14) {
                    SectionHeader(title: "Expense categories")
                    ForEach(store.expenseByCategory) { item in
                        VStack(spacing: 6) {
                            HStack {
                                Text(item.category.rawValue)
                                    .font(.subheadline.weight(.semibold))
                                Spacer()
                                Text(store.currency(item.amount))
                                    .font(.subheadline.bold())
                            }
                            GeometryReader { proxy in
                                let ratio = store.currentMonthExpenses > 0 ? item.amount / store.currentMonthExpenses : 0
                                ZStack(alignment: .leading) {
                                    Capsule().fill(GalacticTheme.divider)
                                    Capsule()
                                        .fill(GalacticTheme.heroGradient)
                                        .frame(width: max(5, proxy.size.width * ratio))
                                }
                            }
                            .frame(height: 7)
                        }
                    }
                }
            }

            filteredTransactions(kind: .expense, empty: "No expenses yet")
        }
    }

    private func counterparties(kind: TransactionKind, empty: String) -> some View {
        let items = store.currentMonthTransactions.filter { $0.kind == kind }
        let groups = Dictionary(grouping: items, by: \.merchant)
            .map { name, transactions in
                CounterpartyTotal(name: name, amount: transactions.reduce(0) { $0 + $1.amount }, count: transactions.count)
            }
            .sorted { $0.amount > $1.amount }

        return GalacticCard {
            VStack(alignment: .leading, spacing: 10) {
                SectionHeader(title: kind == .income ? "Top customers" : "Top vendors")
                if groups.isEmpty {
                    Text(empty)
                        .font(.subheadline)
                        .foregroundStyle(GalacticTheme.mutedText)
                        .padding(.vertical, 18)
                } else {
                    ForEach(groups) { item in
                        HStack(spacing: 12) {
                            Text(String(item.name.prefix(1)).uppercased())
                                .font(.caption.bold())
                                .foregroundStyle(.white)
                                .frame(width: 36, height: 36)
                                .background(kind == .income ? GalacticTheme.green.gradient : GalacticTheme.indigo.gradient)
                                .clipShape(RoundedRectangle(cornerRadius: 11, style: .continuous))
                            VStack(alignment: .leading, spacing: 2) {
                                Text(item.name).font(.subheadline.bold())
                                Text("\(item.count) transaction\(item.count == 1 ? "" : "s")")
                                    .font(.caption)
                                    .foregroundStyle(GalacticTheme.mutedText)
                            }
                            Spacer()
                            Text(store.currency(item.amount))
                                .font(.subheadline.bold())
                                .foregroundStyle(GalacticTheme.navy)
                        }
                        .padding(.vertical, 4)
                    }
                }
            }
        }
    }

    private func filteredTransactions(kind: TransactionKind, empty: String) -> some View {
        let items = store.transactions.filter { $0.kind == kind }
        return GalacticCard {
            VStack(alignment: .leading, spacing: 10) {
                SectionHeader(title: kind == .expense ? "Recent expenses" : "Recent income")
                if items.isEmpty {
                    Text(empty).font(.subheadline).foregroundStyle(GalacticTheme.mutedText)
                } else {
                    ForEach(items.prefix(12)) { transaction in transactionRow(transaction) }
                }
            }
        }
    }

    private func filteredTransactions(category: FinanceCategory, empty: String) -> some View {
        let items = store.transactions.filter { $0.category == category }
        return VStack(spacing: 16) {
            MetricTile(
                title: "Payroll this month",
                value: store.currency(store.currentMonthTransactions.filter { $0.category == category && $0.kind == .expense }.reduce(0) { $0 + $1.amount }),
                subtitle: "Recorded payroll expenses",
                systemImage: "banknote.fill",
                tint: GalacticTheme.pink
            )
            GalacticCard {
                VStack(alignment: .leading, spacing: 10) {
                    SectionHeader(title: "Payroll activity")
                    if items.isEmpty {
                        Text(empty).font(.subheadline).foregroundStyle(GalacticTheme.mutedText)
                    } else {
                        ForEach(items.prefix(12)) { transaction in transactionRow(transaction) }
                    }
                }
            }
        }
    }

    private var reports: some View {
        GalacticCard {
            VStack(alignment: .leading, spacing: 16) {
                SectionHeader(title: "Six-month operating report")
                Chart(store.monthlyPoints) { point in
                    BarMark(x: .value("Month", point.label), y: .value("Income", point.income))
                        .foregroundStyle(GalacticTheme.green.gradient)
                        .position(by: .value("Series", "Income"))
                    BarMark(x: .value("Month", point.label), y: .value("Expense", point.expense))
                        .foregroundStyle(GalacticTheme.indigo.gradient)
                        .position(by: .value("Series", "Expense"))
                }
                .frame(height: 300)

                HStack(spacing: 18) {
                    Label("Income", systemImage: "circle.fill").foregroundStyle(GalacticTheme.green)
                    Label("Expenses", systemImage: "circle.fill").foregroundStyle(GalacticTheme.indigo)
                }
                .font(.caption)
            }
        }
    }

    private var budgets: some View {
        GalacticCard {
            VStack(alignment: .leading, spacing: 16) {
                SectionHeader(title: "Planning targets")
                Text("Targets are calculated as 15% above the current recorded monthly category spend, giving you a simple editable-budget starting point for a future release.")
                    .font(.caption)
                    .foregroundStyle(GalacticTheme.mutedText)

                ForEach(store.expenseByCategory) { item in
                    let target = max(item.amount * 1.15, 1)
                    VStack(spacing: 6) {
                        HStack {
                            Text(item.category.rawValue).font(.subheadline.weight(.semibold))
                            Spacer()
                            Text("\(store.currency(item.amount)) / \(store.currency(target))")
                                .font(.caption.weight(.semibold))
                                .foregroundStyle(GalacticTheme.mutedText)
                        }
                        ProgressView(value: item.amount, total: target)
                            .tint(item.amount > target ? GalacticTheme.pink : GalacticTheme.indigo)
                    }
                }
            }
        }
    }

    private var alerts: some View {
        GalacticCard {
            VStack(alignment: .leading, spacing: 10) {
                SectionHeader(title: "AI insights & alerts")
                if store.insights.isEmpty {
                    Text("No alerts yet. Add or import transactions to generate financial insights.")
                        .font(.subheadline)
                        .foregroundStyle(GalacticTheme.mutedText)
                } else {
                    ForEach(store.insights) { insight in
                        HStack(alignment: .top, spacing: 12) {
                            Image(systemName: insight.icon)
                                .foregroundStyle(insight.color)
                                .frame(width: 36, height: 36)
                                .background(insight.color.opacity(0.11))
                                .clipShape(RoundedRectangle(cornerRadius: 11, style: .continuous))
                            VStack(alignment: .leading, spacing: 3) {
                                Text(insight.title).font(.subheadline.bold())
                                Text(insight.detail).font(.caption).foregroundStyle(GalacticTheme.mutedText)
                            }
                            Spacer()
                        }
                        .padding(.vertical, 5)
                    }
                }
            }
        }
    }

    private var help: some View {
        VStack(spacing: 12) {
            helpCard("Import business data", icon: "square.and.arrow.down.fill", text: "Open Transactions and use Import to select a CSV exported from a bank or bookkeeping tool.")
            helpCard("Ask Galactic AI", icon: "sparkles", text: "Ask about revenue, spending, invoices, recurring costs, cash balance, or runway. The assistant is read-only.")
            helpCard("Review the evidence", icon: "checklist", text: "Open an AI insight from the dashboard to inspect the transactions behind the conclusion.")
            helpCard("Protect credentials", icon: "lock.shield.fill", text: "Never enter bank passwords, card PINs, CVVs, recovery secrets, or one-time codes into transaction notes.")
        }
    }

    private func helpCard(_ title: String, icon: String, text: String) -> some View {
        GalacticCard {
            HStack(alignment: .top, spacing: 14) {
                Image(systemName: icon)
                    .font(.headline)
                    .foregroundStyle(GalacticTheme.indigo)
                    .frame(width: 42, height: 42)
                    .background(GalacticTheme.indigo.opacity(0.09))
                    .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                VStack(alignment: .leading, spacing: 5) {
                    Text(title).font(.headline)
                    Text(text).font(.subheadline).foregroundStyle(GalacticTheme.mutedText)
                }
                Spacer()
            }
        }
    }

    private func transactionRow(_ transaction: BusinessTransaction) -> some View {
        HStack(spacing: 12) {
            Image(systemName: transaction.kind == .income ? "arrow.down.left" : "arrow.up.right")
                .font(.caption.bold())
                .foregroundStyle(transaction.kind == .income ? GalacticTheme.green : GalacticTheme.indigo)
                .frame(width: 34, height: 34)
                .background((transaction.kind == .income ? GalacticTheme.green : GalacticTheme.indigo).opacity(0.10))
                .clipShape(Circle())
            VStack(alignment: .leading, spacing: 2) {
                Text(transaction.merchant).font(.subheadline.bold())
                Text(transaction.category.rawValue).font(.caption).foregroundStyle(GalacticTheme.mutedText)
            }
            Spacer()
            VStack(alignment: .trailing, spacing: 2) {
                Text((transaction.kind == .income ? "+" : "−") + store.currency(transaction.amount))
                    .font(.subheadline.bold())
                    .foregroundStyle(transaction.kind == .income ? GalacticTheme.green : GalacticTheme.navy)
                Text(transaction.date, style: .date).font(.caption2).foregroundStyle(GalacticTheme.mutedText)
            }
        }
        .padding(.vertical, 4)
    }
}

private struct CounterpartyTotal: Identifiable {
    var id: String { name }
    let name: String
    let amount: Double
    let count: Int
}
