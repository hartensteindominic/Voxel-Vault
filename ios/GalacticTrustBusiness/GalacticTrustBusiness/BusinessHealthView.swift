import SwiftUI

struct BusinessHealthView: View {
    @EnvironmentObject private var store: FinancialStore

    private var recurringTotal: Double {
        store.currentMonthTransactions
            .filter { $0.kind == .expense && $0.isRecurring }
            .reduce(0) { $0 + $1.amount }
    }

    private var overdueTotal: Double {
        store.overdueInvoices.reduce(0) { $0 + $1.amount }
    }

    private var runwayMonths: Double {
        guard store.currentMonthExpenses > 0 else { return store.balance > 0 ? 12 : 0 }
        return max(store.balance, 0) / store.currentMonthExpenses
    }

    private var recurringShare: Double {
        guard store.currentMonthExpenses > 0 else { return 0 }
        return recurringTotal / store.currentMonthExpenses
    }

    private var healthScore: Int {
        var score = 45
        if store.currentMonthNet > 0 { score += 20 }
        else if store.currentMonthNet < 0 { score -= 12 }

        if runwayMonths >= 6 { score += 18 }
        else if runwayMonths >= 3 { score += 12 }
        else if runwayMonths >= 1 { score += 4 }
        else { score -= 10 }

        if overdueTotal == 0 { score += 10 }
        else if overdueTotal < max(store.currentMonthIncome * 0.10, 1) { score += 4 }
        else { score -= 8 }

        if recurringShare <= 0.45 { score += 7 }
        else if recurringShare > 0.70 { score -= 5 }

        return min(100, max(0, score))
    }

    private var healthLabel: String {
        switch healthScore {
        case 80...: "Strong"
        case 65..<80: "Healthy"
        case 50..<65: "Watch"
        default: "Needs attention"
        }
    }

    private var healthTint: Color {
        switch healthScore {
        case 80...: GalacticTheme.green
        case 65..<80: GalacticTheme.blue
        case 50..<65: GalacticTheme.orange
        default: GalacticTheme.pink
        }
    }

    private var unusualExpenses: [BusinessTransaction] {
        let expenses = store.currentMonthTransactions.filter { $0.kind == .expense }
        guard !expenses.isEmpty else { return [] }
        let average = expenses.reduce(0) { $0 + $1.amount } / Double(expenses.count)
        let threshold = max(1_000, average * 1.75)
        return expenses.filter { $0.amount >= threshold }.sorted { $0.amount > $1.amount }
    }

    var body: some View {
        ScrollView {
            LazyVStack(spacing: 16) {
                healthHero
                metrics
                attentionCard
                methodology
            }
            .padding(16)
            .padding(.bottom, 28)
        }
        .background(GalacticTheme.page.ignoresSafeArea())
        .navigationTitle("Business Health")
        .navigationBarTitleDisplayMode(.inline)
    }

    private var healthHero: some View {
        ZStack {
            GalacticTheme.spaceGradient
            GalacticTheme.backgroundGlow

            HStack(spacing: 18) {
                ZStack {
                    Circle()
                        .stroke(Color.white.opacity(0.16), lineWidth: 12)
                    Circle()
                        .trim(from: 0, to: Double(healthScore) / 100)
                        .stroke(healthTint, style: StrokeStyle(lineWidth: 12, lineCap: .round))
                        .rotationEffect(.degrees(-90))
                    VStack(spacing: 0) {
                        Text("\(healthScore)")
                            .font(.system(size: 36, weight: .bold, design: .rounded))
                        Text("/ 100")
                            .font(.caption2.bold())
                            .opacity(0.7)
                    }
                    .foregroundStyle(.white)
                }
                .frame(width: 126, height: 126)

                VStack(alignment: .leading, spacing: 7) {
                    Text("BUSINESS HEALTH")
                        .font(.caption2.bold())
                        .tracking(1.1)
                        .foregroundStyle(.white.opacity(0.66))
                    Text(healthLabel)
                        .font(.title.bold())
                        .foregroundStyle(.white)
                    Text(summaryText)
                        .font(.caption)
                        .foregroundStyle(.white.opacity(0.76))
                        .fixedSize(horizontal: false, vertical: true)
                }
                Spacer(minLength: 0)
            }
            .padding(20)
        }
        .clipShape(RoundedRectangle(cornerRadius: 22, style: .continuous))
        .shadow(color: GalacticTheme.deepBlue.opacity(0.18), radius: 18, y: 9)
    }

    private var summaryText: String {
        if store.currentMonthNet >= 0 && runwayMonths >= 3 && overdueTotal == 0 {
            return "Positive cash flow, useful cash coverage, and no overdue receivables are supporting the score."
        }
        if store.currentMonthNet < 0 {
            return "Recorded spending is above recorded income this month. Review expenses and receivables before committing more cash."
        }
        if overdueTotal > 0 {
            return "Cash flow is positive, but overdue receivables are creating avoidable collection risk."
        }
        return "The score summarizes cash flow, expense coverage, recurring spend, and overdue receivables from records on this device."
    }

    private var metrics: some View {
        VStack(spacing: 12) {
            HStack(spacing: 12) {
                MetricTile(
                    title: "Cash coverage",
                    value: "\(runwayMonths.formatted(.number.precision(.fractionLength(1)))) mo",
                    subtitle: "At this month's expense pace",
                    systemImage: "shield.checkered",
                    tint: runwayMonths >= 3 ? GalacticTheme.green : GalacticTheme.orange
                )
                MetricTile(
                    title: "Net cash flow",
                    value: store.currency(store.currentMonthNet),
                    subtitle: "Income minus expenses",
                    systemImage: "arrow.up.arrow.down",
                    tint: store.currentMonthNet >= 0 ? GalacticTheme.blue : GalacticTheme.pink
                )
            }

            HStack(spacing: 12) {
                MetricTile(
                    title: "Recurring costs",
                    value: store.currency(recurringTotal),
                    subtitle: "Marked recurring this month",
                    systemImage: "repeat",
                    tint: GalacticTheme.violet
                )
                MetricTile(
                    title: "Overdue",
                    value: store.currency(overdueTotal),
                    subtitle: "Outstanding past due",
                    systemImage: "clock.badge.exclamationmark",
                    tint: overdueTotal > 0 ? GalacticTheme.pink : GalacticTheme.green
                )
            }
        }
    }

    private var attentionCard: some View {
        GalacticCard {
            VStack(alignment: .leading, spacing: 12) {
                SectionHeader(title: "Needs attention")

                if unusualExpenses.isEmpty && overdueTotal == 0 && store.currentMonthNet >= 0 {
                    Label("No major risk signals detected in the current records.", systemImage: "checkmark.seal.fill")
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(GalacticTheme.green)
                } else {
                    if store.currentMonthNet < 0 {
                        signalRow(
                            icon: "arrow.down.right.circle.fill",
                            title: "Negative monthly cash flow",
                            detail: "Expenses exceed income by \(store.currency(abs(store.currentMonthNet))).",
                            tint: GalacticTheme.pink
                        )
                    }

                    if overdueTotal > 0 {
                        signalRow(
                            icon: "doc.badge.clock.fill",
                            title: "Overdue receivables",
                            detail: "\(store.currency(overdueTotal)) is currently overdue.",
                            tint: GalacticTheme.orange
                        )
                    }

                    ForEach(unusualExpenses.prefix(3)) { item in
                        signalRow(
                            icon: "exclamationmark.triangle.fill",
                            title: "Large expense: \(item.merchant)",
                            detail: "\(store.currency(item.amount)) • \(item.category.rawValue)",
                            tint: GalacticTheme.indigo
                        )
                    }
                }
            }
        }
    }

    private func signalRow(icon: String, title: String, detail: String, tint: Color) -> some View {
        HStack(alignment: .top, spacing: 12) {
            Image(systemName: icon)
                .foregroundStyle(tint)
                .frame(width: 34, height: 34)
                .background(tint.opacity(0.10))
                .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
            VStack(alignment: .leading, spacing: 3) {
                Text(title).font(.subheadline.bold()).foregroundStyle(GalacticTheme.navy)
                Text(detail).font(.caption).foregroundStyle(GalacticTheme.mutedText)
            }
            Spacer(minLength: 0)
        }
    }

    private var methodology: some View {
        HStack(alignment: .top, spacing: 10) {
            Image(systemName: "info.circle.fill")
                .foregroundStyle(GalacticTheme.indigo)
            Text("The health score is an explainable planning indicator calculated only from records in this app. It is not a credit score, accounting opinion, lending decision, or investment recommendation.")
                .font(.caption)
                .foregroundStyle(.secondary)
        }
        .padding(.horizontal, 6)
    }
}

struct ScenarioPlannerView: View {
    @EnvironmentObject private var store: FinancialStore
    @State private var revenueChange = 10.0
    @State private var expenseChange = -5.0

    private var projectedIncome: Double {
        max(0, store.currentMonthIncome * (1 + revenueChange / 100))
    }

    private var projectedExpenses: Double {
        max(0, store.currentMonthExpenses * (1 + expenseChange / 100))
    }

    private var projectedNet: Double {
        projectedIncome - projectedExpenses
    }

    private var projectedBalance: Double {
        store.balance + projectedNet
    }

    private var projectedCoverage: Double {
        guard projectedExpenses > 0 else { return projectedBalance > 0 ? 12 : 0 }
        return max(projectedBalance, 0) / projectedExpenses
    }

    var body: some View {
        ScrollView {
            LazyVStack(spacing: 16) {
                header
                controls
                resultCard
                assumptions
            }
            .padding(16)
            .padding(.bottom, 28)
        }
        .background(GalacticTheme.page.ignoresSafeArea())
        .navigationTitle("Scenario Planner")
        .navigationBarTitleDisplayMode(.inline)
    }

    private var header: some View {
        GalacticCard {
            HStack(alignment: .top, spacing: 14) {
                Image(systemName: "slider.horizontal.3")
                    .font(.title2.bold())
                    .foregroundStyle(.white)
                    .frame(width: 52, height: 52)
                    .background(GalacticTheme.heroGradient)
                    .clipShape(RoundedRectangle(cornerRadius: 15, style: .continuous))
                VStack(alignment: .leading, spacing: 4) {
                    Text("Model a business decision")
                        .font(.title3.bold())
                        .foregroundStyle(GalacticTheme.navy)
                    Text("Adjust revenue and spending assumptions to see the estimated effect on monthly cash flow and cash coverage.")
                        .font(.subheadline)
                        .foregroundStyle(GalacticTheme.mutedText)
                }
                Spacer(minLength: 0)
            }
        }
    }

    private var controls: some View {
        GalacticCard {
            VStack(alignment: .leading, spacing: 22) {
                scenarioSlider(
                    title: "Revenue change",
                    value: $revenueChange,
                    range: -40...60,
                    tint: GalacticTheme.green
                )
                scenarioSlider(
                    title: "Expense change",
                    value: $expenseChange,
                    range: -40...40,
                    tint: GalacticTheme.indigo
                )

                Button("Reset assumptions") {
                    withAnimation(.easeInOut(duration: 0.2)) {
                        revenueChange = 0
                        expenseChange = 0
                    }
                }
                .font(.caption.bold())
                .foregroundStyle(GalacticTheme.indigo)
            }
        }
    }

    private func scenarioSlider(title: String, value: Binding<Double>, range: ClosedRange<Double>, tint: Color) -> some View {
        VStack(alignment: .leading, spacing: 9) {
            HStack {
                Text(title).font(.headline).foregroundStyle(GalacticTheme.navy)
                Spacer()
                Text("\(value.wrappedValue >= 0 ? "+" : "")\(value.wrappedValue.formatted(.number.precision(.fractionLength(0))))%")
                    .font(.headline.monospacedDigit())
                    .foregroundStyle(tint)
            }
            Slider(value: value, in: range, step: 1)
                .tint(tint)
        }
    }

    private var resultCard: some View {
        ZStack {
            GalacticTheme.spaceGradient
            VStack(alignment: .leading, spacing: 16) {
                Label("Projected next month", systemImage: "sparkles")
                    .font(.headline)
                    .foregroundStyle(.white.opacity(0.86))

                HStack(alignment: .firstTextBaseline) {
                    Text(store.currency(projectedNet))
                        .font(.system(size: 36, weight: .bold, design: .rounded))
                        .foregroundStyle(.white)
                    Spacer()
                    Text(projectedNet >= 0 ? "Positive" : "Negative")
                        .font(.caption.bold())
                        .foregroundStyle(projectedNet >= 0 ? Color.mint : Color.pink)
                }

                Text("Estimated net cash flow")
                    .font(.caption)
                    .foregroundStyle(.white.opacity(0.66))

                Divider().overlay(Color.white.opacity(0.14))

                HStack(spacing: 18) {
                    resultMetric("Income", store.currency(projectedIncome))
                    resultMetric("Expenses", store.currency(projectedExpenses))
                    resultMetric("Coverage", "\(projectedCoverage.formatted(.number.precision(.fractionLength(1)))) mo")
                }
            }
            .padding(20)
        }
        .clipShape(RoundedRectangle(cornerRadius: 22, style: .continuous))
    }

    private func resultMetric(_ title: String, _ value: String) -> some View {
        VStack(alignment: .leading, spacing: 3) {
            Text(title).font(.caption2).foregroundStyle(.white.opacity(0.58))
            Text(value)
                .font(.caption.bold())
                .foregroundStyle(.white)
                .minimumScaleFactor(0.65)
                .lineLimit(1)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private var assumptions: some View {
        HStack(alignment: .top, spacing: 10) {
            Image(systemName: "info.circle.fill").foregroundStyle(GalacticTheme.indigo)
            Text("This scenario repeats the current month's recorded activity with your percentage adjustments. It does not predict customers, taxes, financing, seasonality, or unexpected expenses.")
                .font(.caption)
                .foregroundStyle(.secondary)
        }
        .padding(.horizontal, 6)
    }
}
