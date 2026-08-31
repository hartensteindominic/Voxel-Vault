import SwiftUI
import Charts

struct CashFlowView: View {
    @EnvironmentObject private var store: FinancialStore

    private var projectedThirtyDayBalance: Double {
        store.balance + store.currentMonthNet
    }

    private var burnMultiple: Double {
        guard store.currentMonthExpenses > 0 else { return 0 }
        return max(store.balance, 0) / store.currentMonthExpenses
    }

    var body: some View {
        ScrollView {
            LazyVStack(spacing: 16) {
                cashFlowHero
                trendCard
                categoryCard
                forecastCard
                assumptionsCard
            }
            .padding(16)
            .padding(.bottom, 24)
        }
        .background(GalacticTheme.page.ignoresSafeArea())
        .navigationTitle("Cash Flow")
        .navigationBarTitleDisplayMode(.inline)
    }

    private var cashFlowHero: some View {
        GalacticCard {
            VStack(alignment: .leading, spacing: 14) {
                Label("This month", systemImage: "chart.xyaxis.line")
                    .font(.headline)
                    .foregroundStyle(GalacticTheme.navy)

                HStack(alignment: .firstTextBaseline) {
                    Text(store.currency(store.currentMonthNet))
                        .font(.system(size: 34, weight: .bold, design: .rounded))
                        .foregroundStyle(store.currentMonthNet >= 0 ? GalacticTheme.green : GalacticTheme.pink)
                    Spacer()
                    Text(store.currentMonthNet >= 0 ? "Positive" : "Negative")
                        .font(.caption.bold())
                        .foregroundStyle(store.currentMonthNet >= 0 ? GalacticTheme.green : GalacticTheme.pink)
                        .padding(.horizontal, 10)
                        .padding(.vertical, 6)
                        .background((store.currentMonthNet >= 0 ? GalacticTheme.green : GalacticTheme.pink).opacity(0.1))
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
            Text(title).font(.caption).foregroundStyle(.secondary)
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
                        .font(.headline)
                        .foregroundStyle(GalacticTheme.navy)
                    Spacer()
                    Text("6 months")
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(.secondary)
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
                                    .font(.caption2)
                            }
                        }
                    }
                }
                .chartXAxis { AxisMarks { AxisValueLabel().font(.caption2) } }
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
            Text(title).font(.caption).foregroundStyle(.secondary)
        }
    }

    private var categoryCard: some View {
        GalacticCard {
            VStack(alignment: .leading, spacing: 14) {
                SectionHeader(title: "Expense categories")
                if store.expenseByCategory.isEmpty {
                    Text("No expenses recorded for this month.")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
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
                        .font(.headline)
                    Spacer()
                    Text("AI assist")
                        .font(.caption2.bold())
                        .foregroundStyle(GalacticTheme.indigo)
                }

                Text(store.currency(projectedThirtyDayBalance))
                    .font(.title.bold())
                    .foregroundStyle(GalacticTheme.navy)
                Text("Projected recorded cash if this month’s net cash flow repeats once more.")
                    .font(.caption)
                    .foregroundStyle(.secondary)

                Divider()

                HStack {
                    VStack(alignment: .leading, spacing: 3) {
                        Text("Expense coverage")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                        Text("\(burnMultiple.formatted(.number.precision(.fractionLength(1)))) months")
                            .font(.headline)
                    }
                    Spacer()
                    Image(systemName: burnMultiple >= 3 ? "checkmark.shield.fill" : "exclamationmark.triangle.fill")
                        .font(.title2)
                        .foregroundStyle(burnMultiple >= 3 ? GalacticTheme.green : GalacticTheme.orange)
                }
            }
        }
    }

    private var assumptionsCard: some View {
        HStack(alignment: .top, spacing: 10) {
            Image(systemName: "info.circle.fill")
                .foregroundStyle(GalacticTheme.indigo)
            Text("Forecasts use only the transactions recorded in this app. They are planning estimates, not accounting, tax, lending, or investment advice.")
                .font(.caption)
                .foregroundStyle(.secondary)
        }
        .padding(.horizontal, 6)
    }
}
