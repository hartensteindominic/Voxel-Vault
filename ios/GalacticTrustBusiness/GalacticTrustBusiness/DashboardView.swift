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
                LazyVStack(spacing: 16) {
                    topHeader(width: proxy.size.width)

                    if !searchText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                        searchResults
                    }

                    dashboardLayout(width: proxy.size.width)
                }
                .padding(.horizontal, proxy.size.width > 700 ? 24 : 14)
                .padding(.top, proxy.size.width > 700 ? 18 : 10)
                .padding(.bottom, 34)
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
        VStack(spacing: width > 760 ? 12 : 10) {
            HStack(alignment: .center, spacing: 12) {
                VStack(alignment: .leading, spacing: width > 760 ? 4 : 2) {
                    if width <= 760 {
                        Text("GALACTIC TRUST BUSINESS")
                            .font(.system(size: 10, weight: .bold))
                            .tracking(1.2)
                            .foregroundStyle(GalacticTheme.indigo)
                    }
                    Text("Welcome back, \(store.profile.name)! 👋")
                        .font(width > 760 ? .system(size: 26, weight: .bold, design: .rounded) : .system(size: 21, weight: .bold, design: .rounded))
                        .foregroundStyle(GalacticTheme.navy)
                        .lineLimit(width > 760 ? 1 : 2)
                        .minimumScaleFactor(0.74)
                    Text(width > 760 ? "Here’s what’s happening in your business." : "Your business money, made clear.")
                        .font(width > 760 ? .subheadline : .caption)
                        .foregroundStyle(GalacticTheme.mutedText)
                }

                Spacer(minLength: 6)

                if width > 760 {
                    HStack(spacing: 8) {
                        Image(systemName: "magnifyingglass")
                            .foregroundStyle(GalacticTheme.mutedText)
                        TextField("Search anything…", text: $searchText)
                            .textInputAutocapitalization(.never)
                            .submitLabel(.search)
                    }
                    .padding(.horizontal, 15)
                    .frame(width: min(280, width * 0.27), height: 44)
                    .background(Color.white.opacity(0.78))
                    .clipShape(Capsule())
                    .overlay { Capsule().stroke(GalacticTheme.divider.opacity(0.8), lineWidth: 1) }
                }

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
                            .shadow(color: GalacticTheme.navy.opacity(0.07), radius: 10, y: 4)
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

                Button {
                    selection = .settings
                } label: {
                    HStack(spacing: 9) {
                        GalacticBrandMark(size: width > 760 ? 38 : 36)
                        if width > 920 {
                            VStack(alignment: .leading, spacing: 1) {
                                Text(store.profile.name)
                                    .font(.caption.bold())
                                    .foregroundStyle(GalacticTheme.navy)
                                Text("Business Profile")
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

            HStack(spacing: 9) {
                if width <= 760 {
                    HStack(spacing: 8) {
                        Image(systemName: "magnifyingglass")
                            .foregroundStyle(GalacticTheme.mutedText)
                        TextField("Search activity…", text: $searchText)
                            .textInputAutocapitalization(.never)
                    }
                    .padding(.horizontal, 13)
                    .frame(maxWidth: .infinity)
                    .frame(height: 42)
                    .background(.white)
                    .clipShape(Capsule())
                    .overlay { Capsule().stroke(GalacticTheme.divider.opacity(0.8), lineWidth: 1) }
                } else {
                    Spacer(minLength: 0)
                }

                Menu {
                    Button("This month") { rangeMonths = 1 }
                    Button("Last 3 months") { rangeMonths = 3 }
                    Button("Last 6 months") { rangeMonths = 6 }
                } label: {
                    HStack(spacing: 7) {
                        if width > 760 { Text(rangeLabel) }
                        Image(systemName: "calendar")
                    }
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(GalacticTheme.navy)
                    .padding(.horizontal, width > 760 ? 14 : 13)
                    .frame(height: 42)
                    .background(.white)
                    .clipShape(width > 760 ? AnyShape(RoundedRectangle(cornerRadius: 13, style: .continuous)) : AnyShape(Circle()))
                    .overlay {
                        if width > 760 {
                            RoundedRectangle(cornerRadius: 13, style: .continuous)
                                .stroke(GalacticTheme.divider, lineWidth: 1)
                        }
                    }
                }

                Menu {
                    ForEach(DashboardFilter.allCases) { option in
                        Button(option.rawValue) { filter = option }
                    }
                } label: {
                    HStack(spacing: 7) {
                        Image(systemName: "line.3.horizontal.decrease")
                        if width > 760 { Text(filter == .all ? "Filters" : filter.rawValue) }
                    }
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(GalacticTheme.navy)
                    .padding(.horizontal, width > 760 ? 14 : 13)
                    .frame(height: 42)
                    .background(.white)
                    .clipShape(width > 760 ? AnyShape(RoundedRectangle(cornerRadius: 13, style: .continuous)) : AnyShape(Circle()))
                    .overlay {
                        if width > 760 {
                            RoundedRectangle(cornerRadius: 13, style: .continuous)
                                .stroke(GalacticTheme.divider, lineWidth: 1)
                        }
                    }
                }
            }
        }
    }

    // MARK: - Reference-led dashboard

    @ViewBuilder
    private func dashboardLayout(width: CGFloat) -> some View {
        if width > 880 {
            desktopDashboard(width: width)
        } else {
            compactDashboard(width: width)
        }
    }

    private func compactDashboard(width: CGFloat) -> some View {
        VStack(spacing: 14) {
            balanceHero(width: width)
            quickActionRow(width: width)
            accountSummaryRow(width: width)
            recentTransactionsCard
            spendingInsightsCard
            aiBriefCard
            invoicesCard
            alertsCard
        }
    }

    private func desktopDashboard(width: CGFloat) -> some View {
        let sideWidth = min(390, max(330, width * 0.35))

        return VStack(spacing: 16) {
            HStack(alignment: .top, spacing: 16) {
                VStack(spacing: 14) {
                    balanceHero(width: width - sideWidth - 16)
                    quickActionRow(width: width - sideWidth - 16)
                    accountSummaryRow(width: width - sideWidth - 16)
                    recentTransactionsCard
                }
                .frame(maxWidth: .infinity)

                VStack(spacing: 14) {
                    businessPulsePanel
                    spendingInsightsCard
                }
                .frame(width: sideWidth)
            }

            HStack(alignment: .stretch, spacing: 14) {
                aiBriefCard.frame(maxWidth: .infinity)
                invoicesCard.frame(maxWidth: .infinity)
                alertsCard.frame(maxWidth: .infinity)
            }

            HStack(alignment: .stretch, spacing: 14) {
                incomeExpenseCard.frame(maxWidth: .infinity)
                topVendorsCard.frame(maxWidth: .infinity)
            }
        }
    }

    private func balanceHero(width: CGFloat) -> some View {
        ZStack(alignment: .leading) {
            Image("CosmicHeroBackground")
                .resizable()
                .scaledToFill()
                .frame(maxWidth: .infinity, maxHeight: .infinity)

            LinearGradient(
                colors: [
                    GalacticTheme.navy.opacity(0.94),
                    GalacticTheme.deepBlue.opacity(width > 620 ? 0.54 : 0.70),
                    Color.clear
                ],
                startPoint: .leading,
                endPoint: .trailing
            )

            VStack(alignment: .leading, spacing: width > 620 ? 10 : 8) {
                HStack(spacing: 8) {
                    Text("Recorded Cash")
                        .font(width > 620 ? .headline : .subheadline.bold())
                    Image(systemName: "eye.fill")
                        .font(.caption)
                        .foregroundStyle(.white.opacity(0.78))
                }
                .foregroundStyle(.white)

                Text(store.currency(store.balance))
                    .font(.system(size: width > 620 ? 46 : 36, weight: .bold, design: .rounded))
                    .foregroundStyle(.white)
                    .minimumScaleFactor(0.62)
                    .lineLimit(1)
                    .contentTransition(.numericText())
                    .padding(.top, width > 620 ? 8 : 4)

                HStack(spacing: 7) {
                    Image(systemName: cashBalanceChange == nil ? "checkmark.shield.fill" : "arrow.up.right")
                    Text(cashTrendLabel)
                }
                .font(.caption.weight(.bold))
                .foregroundStyle(cashBalanceChange == nil ? .white : Color(red: 0.25, green: 1.0, blue: 0.90))
                .padding(.horizontal, 12)
                .padding(.vertical, 7)
                .background(GalacticTheme.navy.opacity(0.42))
                .clipShape(Capsule())

                Spacer(minLength: 4)

                Text("From secure records stored on this device")
                    .font(.caption2.weight(.medium))
                    .foregroundStyle(.white.opacity(0.72))
            }
            .padding(width > 620 ? 24 : 20)
            .frame(maxWidth: width > 620 ? width * 0.60 : width * 0.72, alignment: .leading)
        }
        .frame(height: width > 620 ? 250 : 220)
        .clipShape(RoundedRectangle(cornerRadius: width > 620 ? 26 : 24, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: width > 620 ? 26 : 24, style: .continuous)
                .stroke(Color.white.opacity(0.12), lineWidth: 1)
        }
        .shadow(color: GalacticTheme.deepBlue.opacity(0.28), radius: 22, y: 12)
        .accessibilityElement(children: .combine)
        .accessibilityLabel("Recorded cash \(store.currency(store.balance)). \(cashTrendLabel).")
    }

    private var cashTrendLabel: String {
        guard let cashBalanceChange else { return "Current workspace" }
        return "\(abs(cashBalanceChange).formatted(.number.precision(.fractionLength(1))))% vs last month"
    }

    private func quickActionRow(width: CGFloat) -> some View {
        HStack(spacing: width > 620 ? 12 : 8) {
            quickAction(
                title: "Add Record",
                subtitle: "Income or expense",
                icon: "plus",
                tint: GalacticTheme.blue,
                tab: .transactions,
                compact: width <= 620
            )
            quickAction(
                title: "Invoices",
                subtitle: "Track receivables",
                icon: "doc.text.fill",
                tint: GalacticTheme.teal,
                tab: .invoices,
                compact: width <= 620
            )
            quickAction(
                title: "Import",
                subtitle: "Add a CSV",
                icon: "square.and.arrow.down.fill",
                tint: GalacticTheme.violet,
                tab: .integrations,
                compact: width <= 620
            )
            quickAction(
                title: "Ask AI",
                subtitle: "Explain finances",
                icon: "sparkles",
                tint: GalacticTheme.pink,
                tab: .ai,
                compact: width <= 620
            )
        }
    }

    private func quickAction(
        title: String,
        subtitle: String,
        icon: String,
        tint: Color,
        tab: AppTab,
        compact: Bool
    ) -> some View {
        Button {
            selection = tab
        } label: {
            Group {
                if compact {
                    VStack(spacing: 7) {
                        Image(systemName: icon)
                            .font(.system(size: 16, weight: .bold))
                            .foregroundStyle(.white)
                            .frame(width: 42, height: 42)
                            .background(tint.gradient)
                            .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
                            .shadow(color: tint.opacity(0.30), radius: 8, y: 5)
                        Text(title)
                            .font(.system(size: 10, weight: .bold))
                            .foregroundStyle(GalacticTheme.navy)
                            .lineLimit(1)
                            .minimumScaleFactor(0.72)
                    }
                    .padding(.vertical, 11)
                } else {
                    HStack(spacing: 11) {
                        Image(systemName: icon)
                            .font(.system(size: 16, weight: .bold))
                            .foregroundStyle(.white)
                            .frame(width: 43, height: 43)
                            .background(tint.gradient)
                            .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
                            .shadow(color: tint.opacity(0.26), radius: 8, y: 5)
                        VStack(alignment: .leading, spacing: 2) {
                            Text(title)
                                .font(.caption.bold())
                                .foregroundStyle(GalacticTheme.navy)
                            Text(subtitle)
                                .font(.system(size: 9, weight: .medium))
                                .foregroundStyle(GalacticTheme.mutedText)
                                .lineLimit(1)
                        }
                        Spacer(minLength: 0)
                    }
                    .padding(12)
                }
            }
            .frame(maxWidth: .infinity)
            .background(Color.white)
            .clipShape(RoundedRectangle(cornerRadius: 20, style: .continuous))
            .overlay {
                RoundedRectangle(cornerRadius: 20, style: .continuous)
                    .stroke(GalacticTheme.divider.opacity(0.75), lineWidth: 1)
            }
            .shadow(color: GalacticTheme.navy.opacity(0.055), radius: 14, y: 7)
        }
        .buttonStyle(.plain)
        .accessibilityLabel("\(title), \(subtitle)")
    }

    private func accountSummaryRow(width: CGFloat) -> some View {
        HStack(spacing: 12) {
            accountSummaryCard(
                title: "Money In",
                value: store.currency(rangeIncome),
                subtitle: rangeLabel,
                icon: "arrow.down.left",
                tint: GalacticTheme.blue,
                values: store.monthlyPoints.map(\.income)
            )
            accountSummaryCard(
                title: "Money Out",
                value: store.currency(rangeExpenses),
                subtitle: rangeLabel,
                icon: "arrow.up.right",
                tint: GalacticTheme.teal,
                values: store.monthlyPoints.map(\.expense)
            )
        }
    }

    private func accountSummaryCard(
        title: String,
        value: String,
        subtitle: String,
        icon: String,
        tint: Color,
        values: [Double]
    ) -> some View {
        let points = values.enumerated().map { DashboardSparkPoint(index: $0.offset, value: $0.element) }

        return GalacticCard(padding: 14, radius: 20) {
            VStack(alignment: .leading, spacing: 9) {
                HStack(spacing: 9) {
                    Image(systemName: icon)
                        .font(.caption.bold())
                        .foregroundStyle(.white)
                        .frame(width: 34, height: 34)
                        .background(tint.gradient)
                        .clipShape(RoundedRectangle(cornerRadius: 11, style: .continuous))
                    VStack(alignment: .leading, spacing: 1) {
                        Text(title)
                            .font(.caption.bold())
                            .foregroundStyle(GalacticTheme.navy)
                        Text(subtitle)
                            .font(.system(size: 9, weight: .medium))
                            .foregroundStyle(GalacticTheme.mutedText)
                    }
                    Spacer(minLength: 0)
                }

                Text(value)
                    .font(.system(size: 19, weight: .bold, design: .rounded))
                    .foregroundStyle(GalacticTheme.navy)
                    .minimumScaleFactor(0.60)
                    .lineLimit(1)

                Chart(points) { point in
                    LineMark(x: .value("Point", point.index), y: .value("Amount", point.value))
                        .foregroundStyle(tint)
                        .lineStyle(.init(lineWidth: 2.2, lineCap: .round, lineJoin: .round))
                    AreaMark(x: .value("Point", point.index), y: .value("Amount", point.value))
                        .foregroundStyle(
                            LinearGradient(
                                colors: [tint.opacity(0.22), tint.opacity(0.01)],
                                startPoint: .top,
                                endPoint: .bottom
                            )
                        )
                }
                .chartXAxis(.hidden)
                .chartYAxis(.hidden)
                .frame(height: 32)
            }
        }
        .frame(maxWidth: .infinity)
    }

    private var businessPulsePanel: some View {
        GalacticCard(padding: 16, radius: 24) {
            VStack(spacing: 12) {
                SectionHeader(title: "Business Pulse", actionTitle: "View All") {
                    selection = .cashFlow
                }
                digitalPulseCard(
                    title: "Money Received",
                    value: store.currency(rangeIncome),
                    detail: rangeLabel.uppercased(),
                    isPink: false
                )
                digitalPulseCard(
                    title: "Money Spent",
                    value: store.currency(rangeExpenses),
                    detail: rangeLabel.uppercased(),
                    isPink: true
                )
            }
        }
    }

    private func digitalPulseCard(title: String, value: String, detail: String, isPink: Bool) -> some View {
        ZStack(alignment: .leading) {
            if isPink {
                GalacticTheme.pinkCardGradient
                Image("CosmicHeroBackground")
                    .resizable()
                    .scaledToFill()
                    .blendMode(.screen)
                    .opacity(0.22)
            } else {
                Image("CosmicHeroBackground")
                    .resizable()
                    .scaledToFill()
            }

            LinearGradient(
                colors: [Color.black.opacity(isPink ? 0.05 : 0.30), Color.clear],
                startPoint: .leading,
                endPoint: .trailing
            )

            VStack(alignment: .leading, spacing: 5) {
                HStack {
                    Label("GALACTIC TRUST", systemImage: "star.fill")
                        .font(.system(size: 9, weight: .bold))
                    Spacer()
                    Image(systemName: "wave.3.right")
                        .font(.caption.bold())
                }
                .foregroundStyle(.white.opacity(0.90))

                Spacer(minLength: 6)
                Text(title)
                    .font(.subheadline.bold())
                    .foregroundStyle(.white)
                Text(value)
                    .font(.system(size: 22, weight: .bold, design: .rounded))
                    .foregroundStyle(.white)
                    .minimumScaleFactor(0.64)
                    .lineLimit(1)
                Text(detail)
                    .font(.system(size: 9, weight: .bold))
                    .tracking(0.7)
                    .foregroundStyle(.white.opacity(0.72))
            }
            .padding(16)
        }
        .frame(height: 145)
        .clipShape(RoundedRectangle(cornerRadius: 20, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: 20, style: .continuous)
                .stroke(Color.white.opacity(0.18), lineWidth: 1)
        }
        .shadow(color: (isPink ? GalacticTheme.pink : GalacticTheme.deepBlue).opacity(0.22), radius: 14, y: 8)
    }

    private var spendingInsightsCard: some View {
        GalacticCard(padding: 16, radius: 24) {
            VStack(alignment: .leading, spacing: 12) {
                HStack {
                    VStack(alignment: .leading, spacing: 3) {
                        Text("Spending Insights")
                            .font(.headline.bold())
                            .foregroundStyle(GalacticTheme.navy)
                        Text(store.currency(rangeExpenses))
                            .font(.title2.bold())
                            .foregroundStyle(GalacticTheme.navy)
                    }
                    Spacer()
                    Text(rangeLabel)
                        .font(.caption2.weight(.semibold))
                        .foregroundStyle(GalacticTheme.mutedText)
                }

                if rangeExpenseByCategory.isEmpty {
                    ContentUnavailableView("No spending yet", systemImage: "chart.pie")
                        .frame(height: 170)
                } else {
                    HStack(spacing: 14) {
                        VStack(spacing: 9) {
                            ForEach(rangeExpenseByCategory.prefix(5)) { item in
                                HStack(spacing: 7) {
                                    Circle()
                                        .fill(categoryColor(item.category))
                                        .frame(width: 8, height: 8)
                                    Text(item.category.rawValue)
                                        .font(.caption2.weight(.medium))
                                        .foregroundStyle(GalacticTheme.navy)
                                        .lineLimit(1)
                                    Spacer()
                                    Text(percentOfExpenses(item.amount))
                                        .font(.caption2.bold())
                                        .foregroundStyle(GalacticTheme.mutedText)
                                }
                            }
                        }

                        Chart(rangeExpenseByCategory) { item in
                            SectorMark(
                                angle: .value("Amount", item.amount),
                                innerRadius: .ratio(0.62),
                                angularInset: 2
                            )
                            .cornerRadius(5)
                            .foregroundStyle(categoryColor(item.category))
                        }
                        .chartLegend(.hidden)
                        .frame(width: 132, height: 132)
                        .overlay {
                            GalacticBrandMark(size: 42)
                                .padding(8)
                                .background(Color.white.opacity(0.90))
                                .clipShape(Circle())
                                .shadow(color: GalacticTheme.violet.opacity(0.16), radius: 10)
                        }
                    }
                }

                Button {
                    selection = .cashFlow
                } label: {
                    HStack {
                        Image(systemName: "chart.bar.fill")
                        Text("See Full Breakdown")
                        Spacer()
                        Image(systemName: "chevron.right")
                    }
                    .font(.caption.bold())
                    .foregroundStyle(GalacticTheme.indigo)
                    .padding(.horizontal, 14)
                    .frame(height: 42)
                    .background(GalacticTheme.indigo.opacity(0.08))
                    .clipShape(Capsule())
                }
                .buttonStyle(.plain)
            }
        }
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
                unavailableChangeLabel: comparisonUnavailableLabel,
                icon: "banknote.fill",
                tint: GalacticTheme.green,
                values: store.monthlyPoints.map(\.income)
            )
            DashboardMetricCard(
                title: "Total Expenses",
                value: store.currency(rangeExpenses),
                change: expenseChange,
                unavailableChangeLabel: comparisonUnavailableLabel,
                icon: "bag.fill",
                tint: GalacticTheme.pink,
                values: store.monthlyPoints.map(\.expense)
            )
            DashboardMetricCard(
                title: "Net Cash Flow",
                value: store.currency(rangeNet),
                change: netChange,
                unavailableChangeLabel: comparisonUnavailableLabel,
                icon: "chart.line.uptrend.xyaxis",
                tint: GalacticTheme.blue,
                values: store.monthlyPoints.map { $0.income - $0.expense }
            )
            DashboardMetricCard(
                title: "Recorded Cash",
                value: store.currency(store.balance),
                change: cashBalanceChange,
                unavailableChangeLabel: comparisonUnavailableLabel,
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

                    Button("View All Insights") {
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

                let invoices = store.invoices.filter { $0.status == .sent || $0.status == .overdue }
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

    private var revenueChange: Double? {
        guard rangeMonths == 1, let previousPoint else { return nil }
        return percentChange(current: store.currentMonthIncome, previous: previousPoint.income)
    }

    private var expenseChange: Double? {
        guard rangeMonths == 1, let previousPoint else { return nil }
        return percentChange(current: store.currentMonthExpenses, previous: previousPoint.expense)
    }

    private var netChange: Double? {
        guard rangeMonths == 1, let previousPoint else { return nil }
        let previous = previousPoint.income - previousPoint.expense
        return percentChange(current: store.currentMonthNet, previous: previous)
    }

    private var cashBalanceChange: Double? {
        guard rangeMonths == 1 else { return nil }
        let startOfMonthBalance = store.balance - store.currentMonthNet
        return percentChange(current: store.balance, previous: startOfMonthBalance)
    }

    private var comparisonUnavailableLabel: String {
        rangeMonths == 1 ? "No prior baseline" : "Selected range total"
    }

    private var cumulativeBalancePoints: [Double] {
        var running = store.balance - store.monthlyPoints.reduce(0) { $0 + ($1.income - $1.expense) }
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

    private func percentChange(current: Double, previous: Double) -> Double? {
        guard abs(previous) > 0.001 else { return nil }
        return ((current - previous) / abs(previous)) * 100
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
    let change: Double?
    let unavailableChangeLabel: String
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

                if let change {
                    HStack(spacing: 5) {
                        Image(systemName: change >= 0 ? "arrow.up" : "arrow.down")
                        Text("\(abs(change).formatted(.number.precision(.fractionLength(1))))%")
                    }
                    .font(.system(size: 10, weight: .bold))
                    .foregroundStyle(change >= 0 ? GalacticTheme.green : GalacticTheme.pink)
                } else {
                    Text(unavailableChangeLabel)
                        .font(.system(size: 10, weight: .semibold))
                        .foregroundStyle(GalacticTheme.mutedText)
                }

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
