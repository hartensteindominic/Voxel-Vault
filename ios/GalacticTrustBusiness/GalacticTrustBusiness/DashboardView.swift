import SwiftUI
import Charts

struct DashboardView: View {
    @EnvironmentObject private var store: FinancialStore
    @Binding var selection: AppTab

    @State private var searchText = ""
    @State private var rangeMonths = 1
    @State private var filter: DashboardFilter = .all
    @State private var showingInvoices = false
    @State private var selectedInsight: FinancialInsight?

    private let calendar = Calendar.current

    var body: some View {
        GeometryReader { proxy in
            ScrollView {
                LazyVStack(spacing: proxy.size.width <= 560 ? 12 : 14) {
                    topHeader(width: proxy.size.width)

                    if !searchText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                        searchResults
                    }

                    if proxy.size.width <= 560 {
                        compactDashboard(width: proxy.size.width)
                    } else {
                        metricGrid(width: proxy.size.width)
                        heroGrid(width: proxy.size.width)
                        analyticsGrid(width: proxy.size.width)
                        activityGrid(width: proxy.size.width)
                    }
                }
                .padding(.horizontal, proxy.size.width > 700 ? 24 : 14)
                .padding(.top, proxy.size.width <= 560 ? 10 : 18)
                .padding(.bottom, 28)
            }
            .background {
                ZStack {
                    GalacticTheme.page
                    GalacticTheme.backgroundGlow
                }
                .ignoresSafeArea()
            }
        }
        .toolbar(.hidden, for: .navigationBar)
        .sheet(isPresented: $showingInvoices) {
            NavigationStack { InvoicesView() }
                .environmentObject(store)
        }
        .sheet(item: $selectedInsight) { insight in
            InsightEvidenceView(insight: insight)
                .environmentObject(store)
        }
    }

    // MARK: - Header

    private func topHeader(width: CGFloat) -> some View {
        VStack(spacing: 12) {
            HStack(alignment: .center, spacing: 14) {
                VStack(alignment: .leading, spacing: 4) {
                    if width <= 560 {
                        Text("GALACTIC TRUST • BUSINESS")
                            .font(.system(size: 9, weight: .bold))
                            .tracking(1.25)
                            .foregroundStyle(GalacticTheme.indigo)
                    }
                    Text("Welcome back, \(store.profile.name)")
                        .font(width > 760 ? .system(size: 25, weight: .bold) : .system(size: 21, weight: .bold, design: .rounded))
                        .foregroundStyle(GalacticTheme.navy)
                        .lineLimit(1)
                        .minimumScaleFactor(0.70)
                    Text(width <= 560 ? "Your business money, made clear." : "Here’s your business financial overview.")
                        .font(width <= 560 ? .caption : .subheadline)
                        .foregroundStyle(GalacticTheme.mutedText)
                }

                Spacer(minLength: 8)

                if width > 760 {
                    HStack(spacing: 8) {
                        Image(systemName: "magnifyingglass")
                            .foregroundStyle(GalacticTheme.mutedText)
                        TextField("Search anything…", text: $searchText)
                            .textInputAutocapitalization(.never)
                            .submitLabel(.search)
                    }
                    .padding(.horizontal, 14)
                    .frame(width: min(280, width * 0.27), height: 42)
                    .background(Color.white.opacity(0.74))
                    .clipShape(Capsule())
                    .overlay { Capsule().stroke(GalacticTheme.divider, lineWidth: 1) }

                    Button {
                        selection = .alerts
                    } label: {
                        ZStack(alignment: .topTrailing) {
                            Image(systemName: "bell.fill")
                                .font(.subheadline)
                                .foregroundStyle(GalacticTheme.navy)
                                .frame(width: 42, height: 42)
                                .background(.white)
                                .clipShape(Circle())
                            if !store.insights.isEmpty {
                                Text("\(min(store.insights.count, 9))")
                                    .font(.system(size: 9, weight: .bold))
                                    .foregroundStyle(.white)
                                    .frame(width: 16, height: 16)
                                    .background(GalacticTheme.pink)
                                    .clipShape(Circle())
                                    .offset(x: 3, y: -3)
                            }
                        }
                    }
                    .buttonStyle(.plain)
                }

                Button {
                    selection = .settings
                } label: {
                    HStack(spacing: 9) {
                        GalacticBrandMark(size: 35)
                        if width > 920 {
                            VStack(alignment: .leading, spacing: 1) {
                                Text(store.profile.name)
                                    .font(.caption.bold())
                                    .foregroundStyle(GalacticTheme.navy)
                                Text("Business Account")
                                    .font(.caption2)
                                    .foregroundStyle(GalacticTheme.mutedText)
                            }
                            Image(systemName: "chevron.down")
                                .font(.caption2.bold())
                                .foregroundStyle(GalacticTheme.mutedText)
                        }
                    }
                }
                .buttonStyle(.plain)
            }

            HStack(spacing: 10) {
                if width <= 760 {
                    HStack(spacing: 8) {
                        Image(systemName: "magnifyingglass")
                            .foregroundStyle(GalacticTheme.mutedText)
                        TextField("Search transactions…", text: $searchText)
                            .textInputAutocapitalization(.never)
                    }
                    .padding(.horizontal, 13)
                    .frame(maxWidth: .infinity)
                    .frame(height: 40)
                    .background(.white)
                    .clipShape(Capsule())
                    .overlay { Capsule().stroke(GalacticTheme.divider, lineWidth: 1) }
                }

                if width > 760 {
                    Spacer(minLength: 0)
                }

                Menu {
                    Button("This month") { rangeMonths = 1 }
                    Button("Last 3 months") { rangeMonths = 3 }
                    Button("Last 6 months") { rangeMonths = 6 }
                } label: {
                    HStack(spacing: 8) {
                        if width > 760 {
                            Text(rangeLabel)
                        }
                        Image(systemName: "calendar")
                    }
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(GalacticTheme.navy)
                    .padding(.horizontal, width > 760 ? 13 : 12)
                    .frame(height: 40)
                    .background(.white)
                    .clipShape(RoundedRectangle(cornerRadius: width > 760 ? 12 : 20, style: .continuous))
                    .overlay { RoundedRectangle(cornerRadius: width > 760 ? 12 : 20, style: .continuous).stroke(GalacticTheme.divider, lineWidth: 1) }
                }
                .accessibilityLabel("Choose reporting period, currently \(rangeLabel)")

                Menu {
                    ForEach(DashboardFilter.allCases) { option in
                        Button(option.rawValue) { filter = option }
                    }
                } label: {
                    HStack(spacing: 7) {
                        Image(systemName: "line.3.horizontal.decrease")
                        if width > 760 {
                            Text(filter == .all ? "Filters" : filter.rawValue)
                        }
                    }
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(GalacticTheme.navy)
                    .padding(.horizontal, width > 760 ? 13 : 12)
                    .frame(height: 40)
                    .background(.white)
                    .clipShape(RoundedRectangle(cornerRadius: width > 760 ? 12 : 20, style: .continuous))
                    .overlay { RoundedRectangle(cornerRadius: width > 760 ? 12 : 20, style: .continuous).stroke(GalacticTheme.divider, lineWidth: 1) }
                }
                .accessibilityLabel("Filter activity, currently \(filter.rawValue)")
            }
        }
    }

    // MARK: - Compact dashboard

    private func compactDashboard(width: CGFloat) -> some View {
        VStack(spacing: 12) {
            compactCashHero(width: width)
            compactQuickActions
            compactMetricGrid
            compactAIBriefCard
            analyticsGrid(width: width)
            activityGrid(width: width)
        }
    }

    private func compactCashHero(width: CGFloat) -> some View {
        Button {
            selection = .cashFlow
        } label: {
            ZStack(alignment: .leading) {
                Image("CosmicHeroBackground")
                    .resizable()
                    .scaledToFill()
                    .frame(width: max(width - 28, 0), height: 194)

                LinearGradient(
                    colors: [GalacticTheme.navy.opacity(0.98), GalacticTheme.deepBlue.opacity(0.72), Color.clear],
                    startPoint: .leading,
                    endPoint: .trailing
                )

                VStack(alignment: .leading, spacing: 8) {
                    HStack(spacing: 7) {
                        Text("RECORDED CASH")
                            .font(.system(size: 10, weight: .bold))
                            .tracking(1.05)
                        Spacer()
                        Label("PRIVATE", systemImage: "checkmark.shield.fill")
                            .font(.system(size: 9, weight: .bold))
                    }
                    .foregroundStyle(.white.opacity(0.82))

                    Text(store.currency(store.balance))
                        .font(.system(size: 34, weight: .bold, design: .rounded))
                        .foregroundStyle(.white)
                        .minimumScaleFactor(0.60)
                        .lineLimit(1)
                        .contentTransition(.numericText())

                    Text("Your current balance from recorded activity")
                        .font(.caption2.weight(.medium))
                        .foregroundStyle(.white.opacity(0.68))

                    Spacer(minLength: 2)

                    HStack(spacing: 20) {
                        compactHeroAmount("Money in", value: "+\(store.currency(rangeIncome))", color: Color.mint)
                        compactHeroAmount("Money out", value: "−\(store.currency(rangeExpenses))", color: Color(red: 1, green: 0.48, blue: 0.66))
                        Spacer(minLength: 0)
                        Image(systemName: "arrow.up.right")
                            .font(.caption.bold())
                            .foregroundStyle(.white)
                            .frame(width: 30, height: 30)
                            .background(.white.opacity(0.14))
                            .clipShape(Circle())
                    }
                }
                .padding(18)
            }
            .frame(height: 194)
            .clipShape(RoundedRectangle(cornerRadius: 24, style: .continuous))
            .overlay {
                RoundedRectangle(cornerRadius: 24, style: .continuous)
                    .stroke(Color.white.opacity(0.13), lineWidth: 1)
            }
            .shadow(color: GalacticTheme.deepBlue.opacity(0.30), radius: 22, y: 12)
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Recorded cash \(store.currency(store.balance)). Open cash flow.")
    }

    private func compactHeroAmount(_ title: String, value: String, color: Color) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(value)
                .font(.caption.bold())
                .foregroundStyle(color)
                .lineLimit(1)
                .minimumScaleFactor(0.72)
            Text(title)
                .font(.system(size: 9, weight: .medium))
                .foregroundStyle(.white.opacity(0.62))
        }
    }

    private var compactQuickActions: some View {
        HStack(spacing: 8) {
            compactQuickAction(title: "Add", icon: "plus", tint: GalacticTheme.blue) {
                selection = .transactions
            }
            compactQuickAction(title: "Invoices", icon: "doc.text.fill", tint: GalacticTheme.teal) {
                showingInvoices = true
            }
            compactQuickAction(title: "Cash Flow", icon: "chart.line.uptrend.xyaxis", tint: GalacticTheme.violet) {
                selection = .cashFlow
            }
            compactQuickAction(title: "Ask AI", icon: "sparkles", tint: GalacticTheme.pink) {
                selection = .ai
            }
        }
    }

    private func compactQuickAction(
        title: String,
        icon: String,
        tint: Color,
        action: @escaping () -> Void
    ) -> some View {
        Button(action: action) {
            VStack(spacing: 6) {
                Image(systemName: icon)
                    .font(.system(size: 15, weight: .bold))
                    .foregroundStyle(.white)
                    .frame(width: 38, height: 38)
                    .background(tint.gradient)
                    .clipShape(RoundedRectangle(cornerRadius: 13, style: .continuous))
                    .shadow(color: tint.opacity(0.28), radius: 8, y: 4)
                Text(title)
                    .font(.system(size: 10, weight: .bold, design: .rounded))
                    .foregroundStyle(GalacticTheme.navy)
                    .lineLimit(1)
                    .minimumScaleFactor(0.72)
            }
            .padding(.vertical, 10)
            .frame(maxWidth: .infinity)
            .background(.white)
            .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
            .overlay {
                RoundedRectangle(cornerRadius: 18, style: .continuous)
                    .stroke(GalacticTheme.divider.opacity(0.78), lineWidth: 1)
            }
        }
        .buttonStyle(.plain)
    }

    private var compactMetricGrid: some View {
        LazyVGrid(
            columns: [GridItem(.flexible(), spacing: 10), GridItem(.flexible(), spacing: 10)],
            spacing: 10
        ) {
            CompactDashboardMetricCard(
                title: "Revenue",
                value: store.currency(rangeIncome),
                status: changeLabel(revenueChange),
                statusIsPositive: revenueChange >= 0,
                icon: "arrow.down.left",
                tint: GalacticTheme.green,
                values: store.monthlyPoints.map(\.income)
            )
            CompactDashboardMetricCard(
                title: "Expenses",
                value: store.currency(rangeExpenses),
                status: changeLabel(expenseChange),
                statusIsPositive: expenseChange <= 0,
                icon: "arrow.up.right",
                tint: GalacticTheme.pink,
                values: store.monthlyPoints.map(\.expense)
            )
            CompactDashboardMetricCard(
                title: "Net profit",
                value: store.currency(rangeNet),
                status: changeLabel(netChange),
                statusIsPositive: netChange >= 0,
                icon: "chart.line.uptrend.xyaxis",
                tint: GalacticTheme.blue,
                values: store.monthlyPoints.map { $0.income - $0.expense }
            )
            CompactDashboardMetricCard(
                title: "Outstanding",
                value: store.currency(store.outstandingInvoices),
                status: store.overdueInvoices.isEmpty ? "All on track" : "\(store.overdueInvoices.count) overdue",
                statusIsPositive: store.overdueInvoices.isEmpty,
                icon: "doc.text.fill",
                tint: GalacticTheme.violet,
                values: cumulativeBalancePoints
            )
        }
    }

    private var compactAIBriefCard: some View {
        Button {
            selection = .ai
        } label: {
            HStack(spacing: 8) {
                VStack(alignment: .leading, spacing: 6) {
                    Label("GALACTIC AI BRIEF", systemImage: "sparkles")
                        .font(.system(size: 10, weight: .bold))
                        .tracking(0.85)
                        .foregroundStyle(GalacticTheme.violet)

                    Text(store.insights.first?.title ?? "Your financial brief is ready")
                        .font(.system(size: 16, weight: .bold, design: .rounded))
                        .foregroundStyle(GalacticTheme.navy)
                        .multilineTextAlignment(.leading)
                        .lineLimit(2)

                    HStack(spacing: 4) {
                        Text("Review the numbers")
                        Image(systemName: "arrow.right")
                    }
                    .font(.caption.bold())
                    .foregroundStyle(GalacticTheme.indigo)
                }
                .frame(maxWidth: .infinity, alignment: .leading)

                GalacticRobot()
                    .frame(width: 92, height: 92)
            }
            .padding(.leading, 16)
            .padding(.trailing, 10)
            .padding(.vertical, 10)
            .background {
                LinearGradient(
                    colors: [Color.white, GalacticTheme.violet.opacity(0.08)],
                    startPoint: .leading,
                    endPoint: .trailing
                )
            }
            .clipShape(RoundedRectangle(cornerRadius: 22, style: .continuous))
            .overlay {
                RoundedRectangle(cornerRadius: 22, style: .continuous)
                    .stroke(GalacticTheme.violet.opacity(0.16), lineWidth: 1)
            }
            .shadow(color: GalacticTheme.violet.opacity(0.10), radius: 18, y: 8)
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Galactic AI brief. \(store.insights.first?.title ?? "Your financial brief is ready")")
    }

    private var searchResults: some View {
        GalacticCard(padding: 14, radius: 16) {
            VStack(alignment: .leading, spacing: 8) {
                HStack {
                    Text("Search results")
                        .font(.subheadline.bold())
                        .foregroundStyle(GalacticTheme.navy)
                    Spacer()
                    Button("Clear") { searchText = "" }
                        .font(.caption.weight(.semibold))
                }

                let results = matchingTransactions
                if results.isEmpty {
                    Text("No matching transactions found.")
                        .font(.caption)
                        .foregroundStyle(GalacticTheme.mutedText)
                        .padding(.vertical, 8)
                } else {
                    ForEach(results.prefix(5)) { transaction in
                        transactionRow(transaction)
                    }
                }
            }
        }
    }

    // MARK: - KPI cards

    private func metricGrid(width: CGFloat) -> some View {
        let columns = Array(repeating: GridItem(.flexible(), spacing: 12), count: width > 1000 ? 4 : (width > 560 ? 2 : 1))
        return LazyVGrid(columns: columns, spacing: 12) {
            DashboardMetricCard(
                title: "Total Revenue",
                value: store.currency(rangeIncome),
                change: revenueChange,
                icon: "banknote.fill",
                tint: GalacticTheme.green,
                values: store.monthlyPoints.map(\.income)
            )
            DashboardMetricCard(
                title: "Total Expenses",
                value: store.currency(rangeExpenses),
                change: expenseChange,
                icon: "bag.fill",
                tint: GalacticTheme.pink,
                values: store.monthlyPoints.map(\.expense)
            )
            DashboardMetricCard(
                title: "Net Profit",
                value: store.currency(rangeNet),
                change: netChange,
                icon: "chart.line.uptrend.xyaxis",
                tint: GalacticTheme.blue,
                values: store.monthlyPoints.map { $0.income - $0.expense }
            )
            DashboardMetricCard(
                title: "Cash Balance",
                value: store.currency(store.balance),
                change: netChange,
                icon: "wallet.pass.fill",
                tint: GalacticTheme.violet,
                values: cumulativeBalancePoints
            )
        }
    }

    // MARK: - Hero row

    @ViewBuilder
    private func heroGrid(width: CGFloat) -> some View {
        if width > 880 {
            HStack(alignment: .stretch, spacing: 12) {
                cashFlowHero
                    .frame(maxWidth: .infinity)
                aiBriefCard
                    .frame(maxWidth: .infinity)
            }
            .frame(minHeight: 220)
        } else {
            VStack(spacing: 12) {
                cashFlowHero
                aiBriefCard
            }
        }
    }

    private var cashFlowHero: some View {
        ZStack(alignment: .leading) {
            GalacticTheme.spaceGradient

            GalacticPlanetScene()
                .opacity(0.98)

            LinearGradient(
                colors: [GalacticTheme.navy.opacity(0.92), GalacticTheme.navy.opacity(0.22), Color.clear],
                startPoint: .leading,
                endPoint: .trailing
            )

            VStack(alignment: .leading, spacing: 9) {
                Text("Cash Flow Overview")
                    .font(.subheadline.bold())
                    .foregroundStyle(.white.opacity(0.92))
                Text(store.currency(rangeNet))
                    .font(.system(size: 34, weight: .bold, design: .rounded))
                    .foregroundStyle(.white)
                    .minimumScaleFactor(0.72)
                    .lineLimit(1)
                Text("Net Cash Flow for \(rangeLabel.lowercased())")
                    .font(.caption)
                    .foregroundStyle(.white.opacity(0.76))

                Spacer(minLength: 10)

                HStack(spacing: 28) {
                    VStack(alignment: .leading, spacing: 3) {
                        Text("+\(store.currency(rangeIncome))")
                            .font(.subheadline.bold())
                            .foregroundStyle(Color.mint)
                        Text("Inflows")
                            .font(.caption2)
                            .foregroundStyle(.white.opacity(0.65))
                    }
                    VStack(alignment: .leading, spacing: 3) {
                        Text("−\(store.currency(rangeExpenses))")
                            .font(.subheadline.bold())
                            .foregroundStyle(Color(red: 1, green: 0.44, blue: 0.58))
                        Text("Outflows")
                            .font(.caption2)
                            .foregroundStyle(.white.opacity(0.65))
                    }
                }
            }
            .padding(20)
        }
        .frame(minHeight: 220)
        .clipShape(RoundedRectangle(cornerRadius: 20, style: .continuous))
        .shadow(color: GalacticTheme.deepBlue.opacity(0.20), radius: 16, y: 8)
    }

    private var aiBriefCard: some View {
        GalacticCard(padding: 18, radius: 20) {
            HStack(alignment: .center, spacing: 8) {
                VStack(alignment: .leading, spacing: 10) {
                    HStack(spacing: 7) {
                        Image(systemName: "sparkles")
                            .foregroundStyle(GalacticTheme.violet)
                        Text("AI Financial Brief")
                            .font(.headline)
                            .foregroundStyle(GalacticTheme.navy)
                    }
                    Text("Generated from your recorded business activity")
                        .font(.caption2)
                        .foregroundStyle(GalacticTheme.mutedText)

                    if let first = store.insights.first {
                        Text(first.detail)
                            .font(.caption)
                            .foregroundStyle(GalacticTheme.mutedText)
                            .lineLimit(3)
                    } else {
                        Text("Add or import transactions and Galactic AI will surface meaningful financial changes here.")
                            .font(.caption)
                            .foregroundStyle(GalacticTheme.mutedText)
                    }

                    ForEach(store.insights.prefix(3)) { insight in
                        Button {
                            selectedInsight = insight
                        } label: {
                            HStack(alignment: .top, spacing: 8) {
                                Image(systemName: insight.icon)
                                    .font(.caption)
                                    .foregroundStyle(insight.color)
                                    .frame(width: 16)
                                Text(insight.title)
                                    .font(.caption.weight(.medium))
                                    .foregroundStyle(GalacticTheme.navy)
                                    .multilineTextAlignment(.leading)
                                    .lineLimit(2)
                            }
                        }
                        .buttonStyle(.plain)
                    }

                    Button("View Full Report") {
                        selection = .alerts
                    }
                    .font(.caption.bold())
                    .foregroundStyle(GalacticTheme.indigo)
                    .padding(.horizontal, 12)
                    .padding(.vertical, 7)
                    .background(GalacticTheme.indigo.opacity(0.08))
                    .clipShape(Capsule())
                }
                .frame(maxWidth: .infinity, alignment: .leading)

                GalacticRobot()
                    .frame(width: 150, height: 150)
                    .frame(maxWidth: 160)
            }
        }
    }

    // MARK: - Analytics row

    @ViewBuilder
    private func analyticsGrid(width: CGFloat) -> some View {
        if width > 1040 {
            HStack(alignment: .stretch, spacing: 12) {
                incomeExpenseCard.frame(maxWidth: .infinity)
                expenseBreakdownCard.frame(maxWidth: .infinity)
                topVendorsCard.frame(maxWidth: .infinity)
            }
            .frame(minHeight: 250)
        } else if width > 650 {
            HStack(alignment: .stretch, spacing: 12) {
                incomeExpenseCard.frame(maxWidth: .infinity)
                expenseBreakdownCard.frame(maxWidth: .infinity)
            }
            topVendorsCard
        } else {
            VStack(spacing: 12) {
                incomeExpenseCard
                expenseBreakdownCard
                topVendorsCard
            }
        }
    }

    private var incomeExpenseCard: some View {
        GalacticCard(padding: 16, radius: 18) {
            VStack(alignment: .leading, spacing: 12) {
                HStack {
                    Text("Income vs Expense")
                        .font(.subheadline.bold())
                        .foregroundStyle(GalacticTheme.navy)
                    Spacer()
                    HStack(spacing: 10) {
                        legend("Income", GalacticTheme.green)
                        legend("Expense", GalacticTheme.violet)
                    }
                }

                Chart(store.monthlyPoints) { point in
                    BarMark(
                        x: .value("Month", point.label),
                        y: .value("Income", point.income)
                    )
                    .foregroundStyle(GalacticTheme.green.gradient)
                    .position(by: .value("Series", "Income"))
                    .cornerRadius(3)

                    BarMark(
                        x: .value("Month", point.label),
                        y: .value("Expense", point.expense)
                    )
                    .foregroundStyle(GalacticTheme.violet.gradient)
                    .position(by: .value("Series", "Expense"))
                    .cornerRadius(3)
                }
                .chartYAxis {
                    AxisMarks(position: .leading) { _ in
                        AxisGridLine().foregroundStyle(GalacticTheme.divider)
                        AxisValueLabel().font(.caption2)
                    }
                }
                .chartXAxis { AxisMarks { AxisValueLabel().font(.caption2) } }
                .frame(height: 185)
            }
        }
    }

    private var expenseBreakdownCard: some View {
        GalacticCard(padding: 16, radius: 18) {
            VStack(alignment: .leading, spacing: 12) {
                Text("Expense Breakdown")
                    .font(.subheadline.bold())
                    .foregroundStyle(GalacticTheme.navy)

                if rangeExpenseByCategory.isEmpty {
                    ContentUnavailableView("No expenses", systemImage: "chart.pie")
                        .frame(height: 185)
                } else {
                    HStack(spacing: 14) {
                        Chart(rangeExpenseByCategory) { item in
                            SectorMark(
                                angle: .value("Amount", item.amount),
                                innerRadius: .ratio(0.64),
                                angularInset: 1.5
                            )
                            .cornerRadius(4)
                            .foregroundStyle(categoryColor(item.category))
                        }
                        .chartLegend(.hidden)
                        .frame(width: 130, height: 130)
                        .overlay {
                            VStack(spacing: 1) {
                                Text(store.currency(rangeExpenses))
                                    .font(.caption.bold())
                                    .minimumScaleFactor(0.60)
                                    .lineLimit(1)
                                Text("Total Expenses")
                                    .font(.system(size: 9))
                                    .foregroundStyle(GalacticTheme.mutedText)
                            }
                            .padding(.horizontal, 12)
                        }

                        VStack(spacing: 8) {
                            ForEach(rangeExpenseByCategory.prefix(5)) { item in
                                HStack(spacing: 7) {
                                    Circle().fill(categoryColor(item.category)).frame(width: 7, height: 7)
                                    Text(item.category.rawValue)
                                        .font(.caption2)
                                        .foregroundStyle(GalacticTheme.navy)
                                        .lineLimit(1)
                                    Spacer()
                                    Text(percentOfExpenses(item.amount))
                                        .font(.caption2.bold())
                                        .foregroundStyle(GalacticTheme.mutedText)
                                }
                            }
                        }
                    }
                    .frame(maxWidth: .infinity)
                }
            }
        }
    }

    private var topVendorsCard: some View {
        GalacticCard(padding: 16, radius: 18) {
            VStack(alignment: .leading, spacing: 8) {
                SectionHeader(title: "Top Vendors", actionTitle: "View All") {
                    selection = .vendors
                }

                if topVendors.isEmpty {
                    Text("No vendor expenses in this range.")
                        .font(.caption)
                        .foregroundStyle(GalacticTheme.mutedText)
                        .padding(.vertical, 14)
                } else {
                    ForEach(topVendors.prefix(5)) { vendor in
                        HStack(spacing: 10) {
                            Text(String(vendor.name.prefix(1)).uppercased())
                                .font(.caption.bold())
                                .foregroundStyle(.white)
                                .frame(width: 30, height: 30)
                                .background(vendor.tint.gradient)
                                .clipShape(RoundedRectangle(cornerRadius: 9, style: .continuous))
                            Text(vendor.name)
                                .font(.caption.weight(.semibold))
                                .foregroundStyle(GalacticTheme.navy)
                                .lineLimit(1)
                            Spacer()
                            Text(store.currency(vendor.amount))
                                .font(.caption.bold())
                                .foregroundStyle(GalacticTheme.navy)
                        }
                        .padding(.vertical, 4)
                        if vendor.id != topVendors.prefix(5).last?.id {
                            Divider().overlay(GalacticTheme.divider)
                        }
                    }
                }
            }
        }
    }

    // MARK: - Activity row

    @ViewBuilder
    private func activityGrid(width: CGFloat) -> some View {
        if width > 1040 {
            HStack(alignment: .stretch, spacing: 12) {
                recentTransactionsCard.frame(maxWidth: .infinity)
                invoicesCard.frame(maxWidth: .infinity)
                alertsCard.frame(maxWidth: .infinity)
            }
            .frame(minHeight: 250)
        } else if width > 650 {
            HStack(alignment: .stretch, spacing: 12) {
                recentTransactionsCard.frame(maxWidth: .infinity)
                invoicesCard.frame(maxWidth: .infinity)
            }
            alertsCard
        } else {
            VStack(spacing: 12) {
                recentTransactionsCard
                invoicesCard
                alertsCard
            }
        }
    }

    private var recentTransactionsCard: some View {
        GalacticCard(padding: 16, radius: 18) {
            VStack(alignment: .leading, spacing: 7) {
                SectionHeader(title: "Recent Transactions", actionTitle: "View All") {
                    selection = .transactions
                }

                let items = filteredRecentTransactions
                if items.isEmpty {
                    Text("No transactions match the selected filter.")
                        .font(.caption)
                        .foregroundStyle(GalacticTheme.mutedText)
                } else {
                    ForEach(items.prefix(5)) { transaction in
                        transactionRow(transaction)
                    }
                }
            }
        }
    }

    private var invoicesCard: some View {
        GalacticCard(padding: 16, radius: 18) {
            VStack(alignment: .leading, spacing: 7) {
                SectionHeader(title: "Outstanding Invoices", actionTitle: "View All") {
                    showingInvoices = true
                }

                let invoices = store.invoices.filter { $0.status != .paid }
                if invoices.isEmpty {
                    Text("No outstanding invoices.")
                        .font(.caption)
                        .foregroundStyle(GalacticTheme.mutedText)
                } else {
                    ForEach(invoices.prefix(4)) { invoice in
                        HStack(spacing: 10) {
                            Image(systemName: invoice.status == .overdue ? "exclamationmark.circle.fill" : "doc.text.fill")
                                .font(.caption)
                                .foregroundStyle(invoice.status == .overdue ? GalacticTheme.pink : GalacticTheme.blue)
                                .frame(width: 30, height: 30)
                                .background((invoice.status == .overdue ? GalacticTheme.pink : GalacticTheme.blue).opacity(0.09))
                                .clipShape(Circle())
                            VStack(alignment: .leading, spacing: 2) {
                                Text(invoice.client)
                                    .font(.caption.bold())
                                    .foregroundStyle(GalacticTheme.navy)
                                Text(invoice.invoiceNumber)
                                    .font(.caption2)
                                    .foregroundStyle(GalacticTheme.mutedText)
                            }
                            Spacer()
                            VStack(alignment: .trailing, spacing: 2) {
                                Text(store.currency(invoice.amount))
                                    .font(.caption.bold())
                                Text(invoice.status.rawValue)
                                    .font(.system(size: 9, weight: .bold))
                                    .foregroundStyle(invoice.status == .overdue ? GalacticTheme.pink : GalacticTheme.indigo)
                            }
                        }
                        .padding(.vertical, 5)
                    }
                }
            }
        }
    }

    private var alertsCard: some View {
        GalacticCard(padding: 16, radius: 18) {
            VStack(alignment: .leading, spacing: 7) {
                SectionHeader(title: "AI Insights & Alerts", actionTitle: "View All") {
                    selection = .alerts
                }

                if store.insights.isEmpty {
                    Text("No alerts yet.")
                        .font(.caption)
                        .foregroundStyle(GalacticTheme.mutedText)
                } else {
                    ForEach(store.insights.prefix(4)) { insight in
                        Button {
                            selectedInsight = insight
                        } label: {
                            HStack(alignment: .top, spacing: 10) {
                                Image(systemName: insight.icon)
                                    .font(.caption.bold())
                                    .foregroundStyle(insight.color)
                                    .frame(width: 32, height: 32)
                                    .background(insight.color.opacity(0.10))
                                    .clipShape(Circle())
                                VStack(alignment: .leading, spacing: 2) {
                                    Text(insight.title)
                                        .font(.caption.bold())
                                        .foregroundStyle(GalacticTheme.navy)
                                        .multilineTextAlignment(.leading)
                                    Text(insight.detail)
                                        .font(.caption2)
                                        .foregroundStyle(GalacticTheme.mutedText)
                                        .lineLimit(2)
                                        .multilineTextAlignment(.leading)
                                }
                                Spacer(minLength: 0)
                            }
                            .padding(.vertical, 4)
                        }
                        .buttonStyle(.plain)
                    }
                }
            }
        }
    }

    // MARK: - Data helpers

    private var rangeTransactions: [BusinessTransaction] {
        guard rangeMonths > 1,
              let start = calendar.date(byAdding: .month, value: -(rangeMonths - 1), to: calendar.date(from: calendar.dateComponents([.year, .month], from: Date())) ?? Date())
        else {
            return store.currentMonthTransactions
        }
        return store.transactions.filter { $0.date >= start && $0.date <= Date() }
    }

    private var rangeIncome: Double {
        rangeTransactions.filter { $0.kind == .income }.reduce(0) { $0 + $1.amount }
    }

    private var rangeExpenses: Double {
        rangeTransactions.filter { $0.kind == .expense }.reduce(0) { $0 + $1.amount }
    }

    private var rangeNet: Double { rangeIncome - rangeExpenses }

    private var rangeExpenseByCategory: [CategoryTotal] {
        let expenses = rangeTransactions.filter { $0.kind == .expense }
        return Dictionary(grouping: expenses, by: \.category)
            .map { category, transactions in
                CategoryTotal(category: category, amount: transactions.reduce(0) { $0 + $1.amount })
            }
            .sorted { $0.amount > $1.amount }
    }

    private var topVendors: [DashboardVendor] {
        let expenses = rangeTransactions.filter { $0.kind == .expense }
        let palette = [GalacticTheme.navy, GalacticTheme.green, GalacticTheme.blue, GalacticTheme.violet, GalacticTheme.pink, GalacticTheme.orange]
        return Dictionary(grouping: expenses, by: \.merchant)
            .map { name, transactions in
                (name, transactions.reduce(0) { $0 + $1.amount })
            }
            .sorted { $0.1 > $1.1 }
            .enumerated()
            .map { index, pair in DashboardVendor(name: pair.0, amount: pair.1, tint: palette[index % palette.count]) }
    }

    private var filteredRecentTransactions: [BusinessTransaction] {
        switch filter {
        case .all: store.transactions
        case .income: store.transactions.filter { $0.kind == .income }
        case .expenses: store.transactions.filter { $0.kind == .expense }
        }
    }

    private var matchingTransactions: [BusinessTransaction] {
        let query = searchText.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        guard !query.isEmpty else { return [] }
        return store.transactions.filter {
            $0.merchant.lowercased().contains(query) ||
            $0.memo.lowercased().contains(query) ||
            $0.category.rawValue.lowercased().contains(query)
        }
    }

    private var previousPoint: MonthlyPoint? {
        guard store.monthlyPoints.count >= 2 else { return nil }
        return store.monthlyPoints[store.monthlyPoints.count - 2]
    }

    private var revenueChange: Double {
        percentChange(current: store.currentMonthIncome, previous: previousPoint?.income ?? 0)
    }

    private var expenseChange: Double {
        percentChange(current: store.currentMonthExpenses, previous: previousPoint?.expense ?? 0)
    }

    private var netChange: Double {
        let previous = (previousPoint?.income ?? 0) - (previousPoint?.expense ?? 0)
        return percentChange(current: store.currentMonthNet, previous: previous)
    }

    private var cumulativeBalancePoints: [Double] {
        var running = max(0, store.balance - store.monthlyPoints.reduce(0) { $0 + ($1.income - $1.expense) })
        return store.monthlyPoints.map { point in
            running += point.income - point.expense
            return running
        }
    }

    private var rangeLabel: String {
        switch rangeMonths {
        case 3: "Last 3 months"
        case 6: "Last 6 months"
        default: "This month"
        }
    }

    private func percentChange(current: Double, previous: Double) -> Double {
        guard abs(previous) > 0.001 else { return current == 0 ? 0 : 100 }
        return ((current - previous) / abs(previous)) * 100
    }

    private func changeLabel(_ value: Double) -> String {
        let direction = value >= 0 ? "↑" : "↓"
        return "\(direction) \(abs(value).formatted(.number.precision(.fractionLength(1))))%"
    }

    private func percentOfExpenses(_ amount: Double) -> String {
        guard rangeExpenses > 0 else { return "0%" }
        return "\((amount / rangeExpenses * 100).formatted(.number.precision(.fractionLength(0))))%"
    }

    private func legend(_ text: String, _ color: Color) -> some View {
        HStack(spacing: 4) {
            Circle().fill(color).frame(width: 6, height: 6)
            Text(text).font(.system(size: 9, weight: .medium)).foregroundStyle(GalacticTheme.mutedText)
        }
    }

    private func transactionRow(_ transaction: BusinessTransaction) -> some View {
        HStack(spacing: 10) {
            Image(systemName: transaction.kind == .income ? "arrow.down.left" : "arrow.up.right")
                .font(.caption.bold())
                .foregroundStyle(transaction.kind == .income ? GalacticTheme.green : GalacticTheme.indigo)
                .frame(width: 30, height: 30)
                .background((transaction.kind == .income ? GalacticTheme.green : GalacticTheme.indigo).opacity(0.10))
                .clipShape(Circle())
            VStack(alignment: .leading, spacing: 2) {
                Text(transaction.merchant)
                    .font(.caption.bold())
                    .foregroundStyle(GalacticTheme.navy)
                    .lineLimit(1)
                Text(transaction.category.rawValue)
                    .font(.caption2)
                    .foregroundStyle(GalacticTheme.mutedText)
            }
            Spacer()
            VStack(alignment: .trailing, spacing: 2) {
                Text((transaction.kind == .income ? "+" : "−") + store.currency(transaction.amount))
                    .font(.caption.bold())
                    .foregroundStyle(transaction.kind == .income ? GalacticTheme.green : GalacticTheme.navy)
                Text(transaction.date, style: .date)
                    .font(.system(size: 9))
                    .foregroundStyle(GalacticTheme.mutedText)
            }
        }
        .padding(.vertical, 3)
    }

    private func categoryColor(_ category: FinanceCategory) -> Color {
        switch category {
        case .payroll: GalacticTheme.violet
        case .software: GalacticTheme.blue
        case .marketing: GalacticTheme.pink
        case .office: GalacticTheme.orange
        case .rentUtilities: GalacticTheme.teal
        case .travel: .teal
        case .taxes: .brown
        case .fees: .gray
        case .sales: GalacticTheme.green
        case .services: .mint
        case .other: .secondary
        }
    }
}

private enum DashboardFilter: String, CaseIterable, Identifiable {
    case all = "All activity"
    case income = "Income"
    case expenses = "Expenses"
    var id: String { rawValue }
}

private struct DashboardVendor: Identifiable {
    var id: String { name }
    let name: String
    let amount: Double
    let tint: Color
}

private struct DashboardSparkPoint: Identifiable {
    let index: Int
    let value: Double
    var id: Int { index }
}

private struct DashboardMetricCard: View {
    let title: String
    let value: String
    let change: Double
    let icon: String
    let tint: Color
    let values: [Double]

    private var points: [DashboardSparkPoint] {
        values.enumerated().map { DashboardSparkPoint(index: $0.offset, value: $0.element) }
    }

    var body: some View {
        GalacticCard(padding: 15, radius: 18) {
            VStack(alignment: .leading, spacing: 7) {
                HStack(alignment: .top, spacing: 10) {
                    Image(systemName: icon)
                        .font(.subheadline.bold())
                        .foregroundStyle(.white)
                        .frame(width: 39, height: 39)
                        .background(tint.gradient)
                        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))

                    VStack(alignment: .leading, spacing: 2) {
                        Text(title)
                            .font(.caption.weight(.semibold))
                            .foregroundStyle(GalacticTheme.mutedText)
                        Text(value)
                            .font(.system(size: 18, weight: .bold, design: .rounded))
                            .foregroundStyle(GalacticTheme.navy)
                            .minimumScaleFactor(0.67)
                            .lineLimit(1)
                    }
                    Spacer(minLength: 0)
                }

                HStack(spacing: 5) {
                    Image(systemName: change >= 0 ? "arrow.up" : "arrow.down")
                    Text("\(abs(change).formatted(.number.precision(.fractionLength(1))))%")
                }
                .font(.system(size: 10, weight: .bold))
                .foregroundStyle(change >= 0 ? GalacticTheme.green : GalacticTheme.pink)

                if points.count > 1 {
                    Chart(points) { point in
                        AreaMark(
                            x: .value("Period", point.index),
                            y: .value("Value", point.value)
                        )
                        .foregroundStyle(
                            LinearGradient(
                                colors: [tint.opacity(0.20), tint.opacity(0.01)],
                                startPoint: .top,
                                endPoint: .bottom
                            )
                        )

                        LineMark(
                            x: .value("Period", point.index),
                            y: .value("Value", point.value)
                        )
                        .foregroundStyle(tint)
                        .lineStyle(StrokeStyle(lineWidth: 2, lineCap: .round, lineJoin: .round))
                    }
                    .chartXAxis(.hidden)
                    .chartYAxis(.hidden)
                    .frame(height: 44)
                }
            }
        }
    }
}

private struct CompactDashboardMetricCard: View {
    let title: String
    let value: String
    let status: String
    let statusIsPositive: Bool
    let icon: String
    let tint: Color
    let values: [Double]

    private var points: [DashboardSparkPoint] {
        values.enumerated().map { DashboardSparkPoint(index: $0.offset, value: $0.element) }
    }

    var body: some View {
        GalacticCard(padding: 12, radius: 18) {
            VStack(alignment: .leading, spacing: 8) {
                HStack(spacing: 8) {
                    Image(systemName: icon)
                        .font(.caption.bold())
                        .foregroundStyle(.white)
                        .frame(width: 32, height: 32)
                        .background(tint.gradient)
                        .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))

                    VStack(alignment: .leading, spacing: 1) {
                        Text(title)
                            .font(.system(size: 10, weight: .semibold))
                            .foregroundStyle(GalacticTheme.mutedText)
                        Text(value)
                            .font(.system(size: 16, weight: .bold, design: .rounded))
                            .foregroundStyle(GalacticTheme.navy)
                            .lineLimit(1)
                            .minimumScaleFactor(0.58)
                    }
                    Spacer(minLength: 0)
                }

                HStack(spacing: 6) {
                    Text(status)
                        .font(.system(size: 9, weight: .bold))
                        .foregroundStyle(statusIsPositive ? GalacticTheme.green : GalacticTheme.pink)
                        .lineLimit(1)

                    Spacer(minLength: 2)

                    if points.count > 1 {
                        Chart(points) { point in
                            LineMark(
                                x: .value("Period", point.index),
                                y: .value("Value", point.value)
                            )
                            .foregroundStyle(tint)
                            .lineStyle(StrokeStyle(lineWidth: 2, lineCap: .round, lineJoin: .round))
                        }
                        .chartXAxis(.hidden)
                        .chartYAxis(.hidden)
                        .frame(width: 62, height: 24)
                    }
                }
            }
        }
    }
}

struct InsightEvidenceView: View {
    @EnvironmentObject private var store: FinancialStore
    @Environment(\.dismiss) private var dismiss
    let insight: FinancialInsight

    var body: some View {
        NavigationStack {
            List {
                Section {
                    Label(insight.title, systemImage: insight.icon)
                        .font(.headline)
                        .foregroundStyle(insight.color)
                    Text(insight.detail)
                        .font(.subheadline)
                }

                Section("Evidence") {
                    let evidence = store.evidence(for: insight)
                    if evidence.isEmpty {
                        Text("This insight is based on invoice status or aggregate financial totals.")
                            .foregroundStyle(.secondary)
                    } else {
                        ForEach(evidence) { item in
                            HStack {
                                VStack(alignment: .leading) {
                                    Text(item.merchant).font(.subheadline.bold())
                                    Text(item.date, style: .date).font(.caption).foregroundStyle(.secondary)
                                }
                                Spacer()
                                Text((item.kind == .income ? "+" : "−") + store.currency(item.amount))
                                    .font(.subheadline.weight(.semibold))
                            }
                        }
                    }
                }
            }
            .navigationTitle("AI Evidence")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done") { dismiss() }
                }
            }
        }
    }
}
