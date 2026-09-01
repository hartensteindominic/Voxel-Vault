import SwiftUI
import Charts

struct CashFlowView: View {
    @EnvironmentObject private var store: FinancialStore
    @State private var revenueAdjustment: Double = 0
    @State private var expenseAdjustment: Double = 0

    private var projectedThirtyDayBalance: Double {
        store.balance + store.currentMonthNet
    }

    private var burnMultiple: Double {
        store.expenseCoverageMonths
    }

    private var scenarioIncome: Double {
        max(0, store.currentMonthIncome * (1 + revenueAdjustment / 100))
    }

    private var scenarioExpenses: Double {
        max(0, store.currentMonthExpenses * (1 + expenseAdjustment / 100))
    }

    private var scenarioNet: Double {
        scenarioIncome - scenarioExpenses
    }

    private var scenarioBalance: Double {
        store.balance + scenarioNet
    }

    var body: some View {
        ScrollView {
            LazyVStack(spacing: 16) {
                cashFlowHero
                trendCard
                categoryCard
                forecastCard
                scenarioCard
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

    private var scenarioCard: some View {
        GalacticCard {
            VStack(alignment: .leading, spacing: 16) {
                HStack {
                    Label("Scenario Lab", systemImage: "slider.horizontal.3")
                        .font(.headline)
                        .foregroundStyle(GalacticTheme.navy)
                    Spacer()
                    Text("Interactive")
                        .font(.caption2.bold())
                        .foregroundStyle(GalacticTheme.violet)
                        .padding(.horizontal, 9)
                        .padding(.vertical, 5)
                        .background(GalacticTheme.violet.opacity(0.09))
                        .clipShape(Capsule())
                }

                Text("Stress-test the next month without changing your real records.")
                    .font(.caption)
                    .foregroundStyle(.secondary)

                scenarioSlider(
                    title: "Revenue change",
                    adjustment: $revenueAdjustment,
                    tint: GalacticTheme.green
                )
                scenarioSlider(
                    title: "Expense change",
                    adjustment: $expenseAdjustment,
                    tint: GalacticTheme.pink
                )

                Divider()

                HStack(spacing: 10) {
                    scenarioMetric("Projected cash", value: store.currency(scenarioBalance), tint: GalacticTheme.violet)
                    scenarioMetric("Scenario net", value: store.currency(scenarioNet), tint: scenarioNet >= 0 ? GalacticTheme.green : GalacticTheme.pink)
                }

                HStack(spacing: 10) {
                    scenarioMetric("Revenue", value: store.currency(scenarioIncome), tint: GalacticTheme.green)
                    scenarioMetric("Expenses", value: store.currency(scenarioExpenses), tint: GalacticTheme.pink)
                }

                if revenueAdjustment != 0 || expenseAdjustment != 0 {
                    Button("Reset scenario") {
                        withAnimation(.snappy) {
                            revenueAdjustment = 0
                            expenseAdjustment = 0
                        }
                    }
                    .font(.caption.bold())
                    .foregroundStyle(GalacticTheme.indigo)
                }
            }
        }
    }

    private func scenarioSlider(title: String, adjustment: Binding<Double>, tint: Color) -> some View {
        VStack(alignment: .leading, spacing: 7) {
            HStack {
                Text(title)
                    .font(.subheadline.weight(.semibold))
                Spacer()
                Text(signedPercent(adjustment.wrappedValue))
                    .font(.caption.bold())
                    .foregroundStyle(tint)
                    .monospacedDigit()
            }
            Slider(value: adjustment, in: -30...30, step: 5)
                .tint(tint)
                .accessibilityLabel(title)
                .accessibilityValue(signedPercent(adjustment.wrappedValue))
        }
    }

    private func scenarioMetric(_ title: String, value: String, tint: Color) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(title)
                .font(.caption2)
                .foregroundStyle(.secondary)
            Text(value)
                .font(.subheadline.bold())
                .foregroundStyle(tint)
                .lineLimit(1)
                .minimumScaleFactor(0.68)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(12)
        .background(tint.opacity(0.07))
        .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
    }

    private func signedPercent(_ value: Double) -> String {
        let amount = Int(value)
        return amount > 0 ? "+\(amount)%" : "\(amount)%"
    }

    private var assumptionsCard: some View {
        HStack(alignment: .top, spacing: 10) {
            Image(systemName: "info.circle.fill")
                .foregroundStyle(GalacticTheme.indigo)
            Text("Forecasts and scenarios use only the transactions recorded in this app. They are planning estimates, not accounting, tax, lending, credit, or investment advice.")
                .font(.caption)
                .foregroundStyle(.secondary)
        }
        .padding(.horizontal, 6)
    }
}
