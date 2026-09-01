import SwiftUI
import Charts

struct CashFlowView: View {
    @EnvironmentObject private var store: FinancialStore
    @EnvironmentObject private var subscription: SubscriptionManager
    @State private var showingPro = false

    private let calendar = Calendar.current

    private var forecastWindow: ForecastWindow? {
        let now = Date()
        let eligible = store.transactions.filter { $0.date <= now }
        guard let earliestDate = eligible.map(\.date).min() else { return nil }

        let today = calendar.startOfDay(for: now)
        let thirtyDayStart = calendar.date(byAdding: .day, value: -29, to: today) ?? today
        let earliestDay = calendar.startOfDay(for: earliestDate)
        let start = max(earliestDay, thirtyDayStart)
        let items = eligible.filter { $0.date >= start }
        guard !items.isEmpty else { return nil }

        let elapsedDays = (calendar.dateComponents([.day], from: start, to: today).day ?? 0) + 1
        let daysObserved = max(1, elapsedDays)
        let net = items.reduce(0) { $0 + $1.signedAmount }
        let expenses = items.filter { $0.kind == .expense }.reduce(0) { $0 + $1.amount }

        return ForecastWindow(daysObserved: daysObserved, net: net, expenses: expenses)
    }

    private var projectedThirtyDayBalance: Double? {
        guard let forecastWindow else { return nil }
        return store.balance + (forecastWindow.net / Double(forecastWindow.daysObserved)) * 30
    }

    private var estimatedThirtyDayExpenses: Double? {
        guard let forecastWindow, forecastWindow.expenses > 0 else { return nil }
        return (forecastWindow.expenses / Double(forecastWindow.daysObserved)) * 30
    }

    private var burnMultiple: Double? {
        guard let estimatedThirtyDayExpenses, estimatedThirtyDayExpenses > 0 else { return nil }
        return max(store.balance, 0) / estimatedThirtyDayExpenses
    }

    private var cashFlowStatus: (label: String, color: Color) {
        if store.currentMonthNet > 0.005 {
            return ("Positive", GalacticTheme.green)
        }
        if store.currentMonthNet < -0.005 {
            return ("Negative", GalacticTheme.pink)
        }
        return ("No activity", GalacticTheme.mutedText)
    }

    var body: some View {
        ScrollView {
            LazyVStack(spacing: 16) {
                cashFlowHero
                trendCard
                categoryCard
                if subscription.isPro {
                    forecastCard
                    advancedReportsLink
                } else {
                    ProLockedCard(
                        title: "Unlock 30-day forecasting",
                        detail: "Galactic Pro adds cash-flow projection and runway analysis using your recorded business activity.",
                        buttonTitle: "Unlock Galactic Pro"
                    ) {
                        showingPro = true
                    }
                }
                startingCashLink
                assumptionsCard
            }
            .padding(16)
            .padding(.bottom, 24)
        }
        .background(GalacticTheme.page.ignoresSafeArea())
        .navigationTitle("Cash Flow")
        .navigationBarTitleDisplayMode(.inline)
        .sheet(isPresented: $showingPro) {
            GalacticProPaywallView()
                .environmentObject(subscription)
        }
    }

    private var cashFlowHero: some View {
        GalacticCard {
            VStack(alignment: .leading, spacing: 14) {
                Label("This month", systemImage: "chart.xyaxis.line")
                    .font(.headline.bold())
                    .foregroundStyle(GalacticTheme.navy)

                HStack(alignment: .firstTextBaseline) {
                    Text(store.currency(store.currentMonthNet))
                        .font(.system(size: 34, weight: .bold, design: .rounded))
                        .foregroundStyle(cashFlowStatus.color)
                    Spacer()
                    Text(cashFlowStatus.label)
                        .font(.caption.bold())
                        .foregroundStyle(cashFlowStatus.color)
                        .padding(.horizontal, 10)
                        .padding(.vertical, 6)
                        .background(cashFlowStatus.color.opacity(0.1))
                        .clipShape(Capsule())
                }

                HStack(spacing: 10) {
                    flowPill("Inflows", value: store.currentMonthIncome, color: GalacticTheme.green)
                    flowPill("Outflows", value: store.currentMonthExpenses, color: GalacticTheme.pink)
                }
            }
        }
    }

    private func flowPill(_ title: String, value: Double, color: Color) -> some View {
        VStack(alignment: .leading, spacing: 3) {
            Text(title).font(.caption.weight(.medium)).foregroundStyle(GalacticTheme.mutedText)
            Text(store.currency(value)).font(.subheadline.bold()).foregroundStyle(color)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(12)
        .background(color.opacity(0.08))
        .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
    }

    private var trendCard: some View {
        GalacticCard {
            VStack(alignment: .leading, spacing: 14) {
                HStack {
                    Text("Income vs expenses")
                        .font(.headline.bold())
                        .foregroundStyle(GalacticTheme.navy)
                    Spacer()
                    Text("6 months")
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(GalacticTheme.mutedText)
                }

                Chart(store.monthlyPoints) { point in
                    BarMark(
                        x: .value("Month", point.label),
                        y: .value("Income", point.income)
                    )
                    .foregroundStyle(GalacticTheme.green.gradient)
                    .position(by: .value("Series", "Income"))

                    BarMark(
                        x: .value("Month", point.label),
                        y: .value("Expenses", point.expense)
                    )
                    .foregroundStyle(GalacticTheme.indigo.gradient)
                    .position(by: .value("Series", "Expenses"))
                }
                .chartYAxis {
                    AxisMarks(position: .leading) { value in
                        AxisGridLine().foregroundStyle(Color.secondary.opacity(0.15))
                        AxisValueLabel {
                            if let number = value.as(Double.self) {
                                Text(number.formatted(.currency(code: store.profile.currencyCode).precision(.fractionLength(0))))
                                    .font(.caption2.weight(.medium))
                            }
                        }
                    }
                }
                .chartXAxis { AxisMarks { AxisValueLabel().font(.caption2.weight(.medium)) } }
                .frame(height: 230)

                HStack(spacing: 18) {
                    legendDot("Income", color: GalacticTheme.green)
                    legendDot("Expenses", color: GalacticTheme.indigo)
                }
            }
        }
    }

    private func legendDot(_ title: String, color: Color) -> some View {
        HStack(spacing: 6) {
            Circle().fill(color).frame(width: 8, height: 8)
            Text(title).font(.caption.weight(.medium)).foregroundStyle(GalacticTheme.mutedText)
        }
    }

    private var categoryCard: some View {
        GalacticCard {
            VStack(alignment: .leading, spacing: 14) {
                SectionHeader(title: "Expense categories")
                if store.expenseByCategory.isEmpty {
                    Text("No expenses recorded for this month.")
                        .font(.subheadline)
                        .foregroundStyle(GalacticTheme.mutedText)
                } else {
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
                                    Capsule().fill(Color.secondary.opacity(0.10))
                                    Capsule()
                                        .fill(GalacticTheme.heroGradient)
                                        .frame(width: max(4, proxy.size.width * ratio))
                                }
                            }
                            .frame(height: 7)
                        }
                    }
                }
            }
        }
    }

    private var forecastCard: some View {
        GalacticCard {
            VStack(alignment: .leading, spacing: 14) {
                HStack {
                    Label("Simple 30-day forecast", systemImage: "sparkles")
                        .font(.headline.bold())
                    Spacer()
                    Text("PRO")
                        .font(.caption2.bold())
                        .foregroundStyle(.white)
                        .padding(.horizontal, 8)
                        .padding(.vertical, 5)
                        .background(GalacticTheme.heroGradient)
                        .clipShape(Capsule())
                }

                if let projectedThirtyDayBalance, let forecastWindow {
                    Text(store.currency(projectedThirtyDayBalance))
                        .font(.title.bold())
                        .foregroundStyle(GalacticTheme.navy)
                    Text("Projected recorded cash in 30 days if the average daily net cash flow from the last \(forecastWindow.daysObserved) recorded calendar day\(forecastWindow.daysObserved == 1 ? "" : "s") continues.")
                        .font(.caption.weight(.medium))
                        .foregroundStyle(GalacticTheme.mutedText)

                    Divider()

                    if let burnMultiple {
                        HStack {
                            VStack(alignment: .leading, spacing: 3) {
                                Text("Estimated expense coverage")
                                    .font(.caption.weight(.medium))
                                    .foregroundStyle(GalacticTheme.mutedText)
                                Text("\(burnMultiple.formatted(.number.precision(.fractionLength(1)))) months")
                                    .font(.headline.bold())
                            }
                            Spacer()
                            Image(systemName: burnMultiple >= 3 ? "checkmark.shield.fill" : "exclamationmark.triangle.fill")
                                .font(.title2)
                                .foregroundStyle(burnMultiple >= 3 ? GalacticTheme.green : GalacticTheme.orange)
                        }
                    } else {
                        Label("Add expense history to estimate cash runway.", systemImage: "info.circle.fill")
                            .font(.subheadline.weight(.medium))
                            .foregroundStyle(GalacticTheme.mutedText)
                    }
                } else {
                    ContentUnavailableView(
                        "Not enough activity yet",
                        systemImage: "chart.line.uptrend.xyaxis",
                        description: Text("Add or import dated transactions to generate a 30-day cash-flow estimate.")
                    )
                }
            }
        }
    }

    private var advancedReportsLink: some View {
        NavigationLink {
            BusinessModuleView(kind: .reports)
        } label: {
            GalacticCard {
                HStack(spacing: 13) {
                    Image(systemName: "chart.bar.doc.horizontal.fill")
                        .font(.headline.bold())
                        .foregroundStyle(.white)
                        .frame(width: 42, height: 42)
                        .background(GalacticTheme.heroGradient)
                        .clipShape(RoundedRectangle(cornerRadius: 13, style: .continuous))
                    VStack(alignment: .leading, spacing: 3) {
                        Text("Advanced Reports")
                            .font(.headline.bold())
                            .foregroundStyle(GalacticTheme.navy)
                        Text("Open your six-month Pro operating report")
                            .font(.caption.weight(.medium))
                            .foregroundStyle(GalacticTheme.mutedText)
                    }
                    Spacer()
                    Image(systemName: "chevron.right")
                        .font(.caption.bold())
                        .foregroundStyle(GalacticTheme.mutedText)
                }
            }
        }
        .buttonStyle(.plain)
    }

    private var startingCashLink: some View {
        NavigationLink {
            StartingCashView()
        } label: {
            GalacticCard {
                HStack(spacing: 13) {
                    Image(systemName: "dollarsign.circle.fill")
                        .font(.headline.bold())
                        .foregroundStyle(.white)
                        .frame(width: 42, height: 42)
                        .background(GalacticTheme.green.gradient)
                        .clipShape(RoundedRectangle(cornerRadius: 13, style: .continuous))
                    VStack(alignment: .leading, spacing: 3) {
                        Text("Starting Cash")
                            .font(.headline.bold())
                            .foregroundStyle(GalacticTheme.navy)
                        Text(store.openingBalance == 0 ? "Set existing business cash without counting it as revenue" : "Currently \(store.currency(store.openingBalance))")
                            .font(.caption.weight(.medium))
                            .foregroundStyle(GalacticTheme.mutedText)
                            .multilineTextAlignment(.leading)
                    }
                    Spacer()
                    Image(systemName: "chevron.right")
                        .font(.caption.bold())
                        .foregroundStyle(GalacticTheme.mutedText)
                }
            }
        }
        .buttonStyle(.plain)
    }

    private var assumptionsCard: some View {
        HStack(alignment: .top, spacing: 10) {
            Image(systemName: "info.circle.fill")
                .foregroundStyle(GalacticTheme.indigo)
            Text("Forecasts use a rolling daily average from up to the most recent 30 calendar days of transactions recorded in this app. They are planning estimates, not accounting, tax, lending, or investment advice.")
                .font(.caption.weight(.medium))
                .foregroundStyle(GalacticTheme.mutedText)
        }
        .padding(.horizontal, 6)
    }
}

private struct ForecastWindow {
    let daysObserved: Int
    let net: Double
    let expenses: Double
}
