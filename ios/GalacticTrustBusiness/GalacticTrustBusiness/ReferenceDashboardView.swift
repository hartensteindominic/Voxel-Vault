import SwiftUI

struct ReferenceDashboardView: View {
    @EnvironmentObject private var store: FinancialStore
    @Environment(\.horizontalSizeClass) private var horizontalSizeClass
    @Binding var selection: AppTab

    @State private var searchText = ""
    @State private var showingInvoices = false

    private let navy = Color(red: 0.025, green: 0.055, blue: 0.27)
    private let blue = Color(red: 0.20, green: 0.32, blue: 0.98)
    private let cyan = Color(red: 0.02, green: 0.83, blue: 0.82)
    private let violet = Color(red: 0.58, green: 0.25, blue: 0.98)
    private let pink = Color(red: 1.00, green: 0.20, blue: 0.49)
    private let green = Color(red: 0.03, green: 0.76, blue: 0.37)

    private var isRegular: Bool { horizontalSizeClass == .regular }
    private var contentWidth: CGFloat { isRegular ? 840 : 470 }

    var body: some View {
        ScrollView(showsIndicators: false) {
            VStack(spacing: isRegular ? 14 : 8) {
                header
                searchRow
                cashHero
                quickActions
                metricGrid
                aiBrief
            }
            .frame(maxWidth: contentWidth)
            .padding(.horizontal, isRegular ? 24 : 12)
            .padding(.top, isRegular ? 16 : 6)
            .padding(.bottom, isRegular ? 18 : 8)
            .frame(maxWidth: .infinity)
        }
        .background {
            ReferencePastelBackground()
                .ignoresSafeArea()
        }
        .toolbar(.hidden, for: .navigationBar)
        .sheet(isPresented: $showingInvoices) {
            NavigationStack { InvoicesView() }
                .environmentObject(store)
        }
    }

    private var header: some View {
        HStack(alignment: .top, spacing: 10) {
            VStack(alignment: .leading, spacing: isRegular ? 5 : 3) {
                Text("GALACTIC TRUST • BUSINESS")
                    .font(.system(size: isRegular ? 11 : 9.5, weight: .bold))
                    .tracking(isRegular ? 2.5 : 2.0)
                    .foregroundStyle(blue)

                Text("Welcome back,\n\(store.profile.name)")
                    .font(.system(size: isRegular ? 38 : 29, weight: .bold, design: .rounded))
                    .foregroundStyle(navy)
                    .lineSpacing(-2)
                    .minimumScaleFactor(0.72)
                    .fixedSize(horizontal: false, vertical: true)

                Text("Your business money, made clear.")
                    .font(.system(size: isRegular ? 17 : 14, weight: .medium, design: .rounded))
                    .foregroundStyle(navy.opacity(0.58))
            }
            .frame(maxWidth: .infinity, alignment: .leading)

            GalacticBrandMark(size: isRegular ? 62 : 47)
                .padding(.top, isRegular ? 15 : 12)
        }
        .padding(.horizontal, isRegular ? 2 : 8)
    }

    private var searchRow: some View {
        HStack(spacing: isRegular ? 12 : 9) {
            HStack(spacing: 10) {
                Image(systemName: "magnifyingglass")
                    .font(.system(size: isRegular ? 19 : 17, weight: .medium))
                    .foregroundStyle(navy.opacity(0.68))

                TextField("Search transactions...", text: $searchText)
                    .font(.system(size: isRegular ? 16 : 14.5, weight: .medium, design: .rounded))
                    .foregroundStyle(navy)
                    .textInputAutocapitalization(.never)
                    .submitLabel(.search)
                    .onSubmit { selection = .transactions }
            }
            .padding(.horizontal, isRegular ? 20 : 17)
            .frame(maxWidth: .infinity)
            .frame(height: isRegular ? 56 : 48)
            .background(ReferenceGlass(cornerRadius: isRegular ? 28 : 25))

            searchButton(icon: "calendar", destination: .cashFlow)
            searchButton(icon: "line.3.horizontal.decrease", destination: .transactions)
        }
        .padding(.horizontal, isRegular ? 0 : 4)
    }

    private func searchButton(icon: String, destination: AppTab) -> some View {
        Button { selection = destination } label: {
            Image(systemName: icon)
                .font(.system(size: isRegular ? 18 : 16, weight: .bold))
                .foregroundStyle(navy.opacity(0.72))
                .frame(width: isRegular ? 56 : 48, height: isRegular ? 56 : 48)
                .background(ReferenceGlass(cornerRadius: isRegular ? 28 : 24))
        }
        .buttonStyle(.plain)
    }

    private var cashHero: some View {
        Button { selection = .cashFlow } label: {
            ZStack {
                ReferenceHeroBackground()

                GeometryReader { geo in
                    ReferenceMoon()
                        .frame(
                            width: min(geo.size.width * (isRegular ? 0.40 : 0.55), isRegular ? 276 : 214),
                            height: min(geo.size.width * (isRegular ? 0.40 : 0.55), isRegular ? 276 : 214)
                        )
                        .position(
                            x: geo.size.width * (isRegular ? 0.82 : 0.82),
                            y: geo.size.height * (isRegular ? 0.55 : 0.58)
                        )

                    Circle()
                        .fill(
                            LinearGradient(
                                colors: [
                                    Color(red: 0.92, green: 0.58, blue: 1.0),
                                    Color(red: 0.56, green: 0.61, blue: 1.0),
                                    Color(red: 0.44, green: 0.90, blue: 1.0)
                                ],
                                startPoint: .topLeading,
                                endPoint: .bottomTrailing
                            )
                        )
                        .frame(width: isRegular ? 58 : 48, height: isRegular ? 58 : 48)
                        .overlay {
                            Circle()
                                .fill(
                                    RadialGradient(
                                        colors: [Color.white.opacity(0.45), .clear],
                                        center: UnitPoint(x: 0.30, y: 0.22),
                                        startRadius: 0,
                                        endRadius: isRegular ? 26 : 21
                                    )
                                )
                        }
                        .overlay { Circle().stroke(Color.white.opacity(0.90), lineWidth: 1.25) }
                        .overlay {
                            Image(systemName: "arrow.up.right")
                                .font(.system(size: isRegular ? 26 : 22, weight: .semibold))
                                .foregroundStyle(.white)
                        }
                        .shadow(color: Color.white.opacity(0.82), radius: 7)
                        .shadow(color: violet.opacity(0.34), radius: 16)
                        .position(x: geo.size.width * 0.92, y: geo.size.height * 0.82)
                }

                VStack(alignment: .leading, spacing: 0) {
                    HStack {
                        Text("RECORDED CASH")
                            .font(.system(size: isRegular ? 11 : 9.5, weight: .bold))
                            .tracking(isRegular ? 2.5 : 2.15)
                            .foregroundStyle(navy.opacity(0.80))

                        Spacer()

                        Label("PRIVATE", systemImage: "checkmark.shield.fill")
                            .font(.system(size: isRegular ? 11 : 9.5, weight: .bold))
                            .foregroundStyle(blue)
                    }

                    Text(store.currency(store.balance))
                        .font(.system(size: isRegular ? 46 : 36, weight: .bold, design: .rounded))
                        .foregroundStyle(navy)
                        .lineLimit(1)
                        .minimumScaleFactor(0.58)
                        .padding(.top, isRegular ? 13 : 9)
                        .frame(maxWidth: isRegular ? 450 : 265, alignment: .leading)

                    Text("Your current balance from recorded activity")
                        .font(.system(size: isRegular ? 13.5 : 11.5, weight: .medium, design: .rounded))
                        .foregroundStyle(navy.opacity(0.64))
                        .padding(.top, 3)
                        .frame(maxWidth: isRegular ? 440 : 250, alignment: .leading)

                    Spacer()

                    HStack(spacing: isRegular ? 30 : 22) {
                        heroAmount(title: "Money in", value: "+\(store.currency(store.currentMonthIncome))", color: green)

                        Rectangle()
                            .fill(Color.white.opacity(0.78))
                            .frame(width: 1, height: isRegular ? 43 : 36)

                        heroAmount(title: "Money out", value: "−\(store.currency(store.currentMonthExpenses))", color: pink)

                        Spacer(minLength: 0)
                    }
                }
                .padding(isRegular ? 22 : 17)
            }
            .frame(height: isRegular ? 252 : 202)
            .clipShape(RoundedRectangle(cornerRadius: isRegular ? 30 : 26, style: .continuous))
            .overlay {
                RoundedRectangle(cornerRadius: isRegular ? 30 : 26, style: .continuous)
                    .stroke(
                        LinearGradient(
                            colors: [
                                Color.white,
                                Color(red: 1.0, green: 0.77, blue: 0.88).opacity(0.98),
                                Color(red: 0.68, green: 0.61, blue: 1.0).opacity(0.94),
                                Color(red: 0.47, green: 0.90, blue: 1.0).opacity(0.98)
                            ],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        ),
                        lineWidth: 1.8
                    )
            }
            .overlay {
                RoundedRectangle(cornerRadius: isRegular ? 28 : 24, style: .continuous)
                    .stroke(Color.white.opacity(0.40), lineWidth: 0.8)
                    .padding(3)
            }
            .shadow(color: Color(red: 0.48, green: 0.42, blue: 0.92).opacity(0.20), radius: 18, y: 8)
            .shadow(color: Color.white.opacity(0.98), radius: 2)
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Recorded cash \(store.currency(store.balance)). Open cash flow.")
    }

    private func heroAmount(title: String, value: String, color: Color) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(value)
                .font(.system(size: isRegular ? 18 : 14.5, weight: .bold, design: .rounded))
                .foregroundStyle(color)
                .lineLimit(1)
                .minimumScaleFactor(0.66)
            Text(title)
                .font(.system(size: isRegular ? 12 : 10.5, weight: .medium, design: .rounded))
                .foregroundStyle(navy.opacity(0.68))
        }
    }

    private var quickActions: some View {
        HStack(spacing: isRegular ? 12 : 7) {
            quickAction(title: "Add", icon: "plus", colors: [Color(red: 0.31, green: 0.62, blue: 1.0), violet]) {
                selection = .transactions
            }
            quickAction(title: "Invoices", icon: "doc.text.fill", colors: [cyan, Color(red: 0.10, green: 0.90, blue: 0.63)]) {
                showingInvoices = true
            }
            quickAction(title: "Cash Flow", icon: "chart.line.uptrend.xyaxis", colors: [violet, Color(red: 0.73, green: 0.25, blue: 0.98)]) {
                selection = .cashFlow
            }
            quickAction(title: "Ask AI", icon: "sparkles", colors: [pink, Color(red: 1.0, green: 0.42, blue: 0.55)]) {
                selection = .ai
            }
        }
    }

    private func quickAction(title: String, icon: String, colors: [Color], action: @escaping () -> Void) -> some View {
        Button(action: action) {
            VStack(spacing: isRegular ? 8 : 6) {
                Image(systemName: icon)
                    .font(.system(size: isRegular ? 21 : 18, weight: .bold))
                    .foregroundStyle(.white)
                    .frame(width: isRegular ? 48 : 40, height: isRegular ? 48 : 40)
                    .background {
                        Circle()
                            .fill(LinearGradient(colors: colors, startPoint: .topLeading, endPoint: .bottomTrailing))
                            .overlay {
                                Circle()
                                    .fill(
                                        RadialGradient(
                                            colors: [Color.white.opacity(0.56), .clear],
                                            center: UnitPoint(x: 0.30, y: 0.20),
                                            startRadius: 0,
                                            endRadius: isRegular ? 24 : 20
                                        )
                                    )
                            }
                            .overlay { Circle().stroke(Color.white.opacity(0.54), lineWidth: 0.9) }
                            .shadow(color: colors.first?.opacity(0.40) ?? .clear, radius: 10, y: 5)
                    }

                Text(title)
                    .font(.system(size: isRegular ? 12.5 : 10.5, weight: .bold, design: .rounded))
                    .foregroundStyle(navy)
                    .lineLimit(1)
                    .minimumScaleFactor(0.68)
            }
            .frame(maxWidth: .infinity)
            .frame(height: isRegular ? 92 : 76)
            .background(ReferenceGlass(cornerRadius: isRegular ? 24 : 21))
        }
        .buttonStyle(.plain)
    }

    private var metricGrid: some View {
        LazyVGrid(
            columns: [GridItem(.flexible(), spacing: isRegular ? 12 : 7), GridItem(.flexible(), spacing: isRegular ? 12 : 7)],
            spacing: isRegular ? 12 : 7
        ) {
            metricCard(
                title: "Revenue",
                value: store.currency(store.currentMonthIncome),
                status: changeText(revenueChange),
                statusColor: revenueChange >= 0 ? green : pink,
                icon: "arrow.down.left",
                tint: green,
                values: store.monthlyPoints.map(\.income)
            )

            metricCard(
                title: "Expenses",
                value: store.currency(store.currentMonthExpenses),
                status: changeText(expenseChange),
                statusColor: pink,
                icon: "arrow.up.right",
                tint: pink,
                values: store.monthlyPoints.map(\.expense)
            )

            metricCard(
                title: "Net profit",
                value: store.currency(store.currentMonthNet),
                status: changeText(netChange),
                statusColor: netChange >= 0 ? green : pink,
                icon: "chart.line.uptrend.xyaxis",
                tint: Color(red: 0.13, green: 0.53, blue: 0.98),
                values: store.monthlyPoints.map { $0.income - $0.expense }
            )

            metricCard(
                title: "Outstanding",
                value: store.currency(store.outstandingInvoices),
                status: store.overdueInvoices.isEmpty ? "All on track" : "\(store.overdueInvoices.count) overdue",
                statusColor: store.overdueInvoices.isEmpty ? green : pink,
                icon: "doc.text.fill",
                tint: violet,
                values: cumulativeBalancePoints
            )
        }
    }

    private func metricCard(
        title: String,
        value: String,
        status: String,
        statusColor: Color,
        icon: String,
        tint: Color,
        values: [Double]
    ) -> some View {
        ZStack {
            ReferenceGlass(cornerRadius: isRegular ? 23 : 19)

            Image(systemName: icon)
                .font(.system(size: isRegular ? 19 : 16, weight: .bold))
                .foregroundStyle(.white)
                .frame(width: isRegular ? 44 : 36, height: isRegular ? 44 : 36)
                .background {
                    RoundedRectangle(cornerRadius: isRegular ? 14 : 12, style: .continuous)
                        .fill(LinearGradient(colors: [tint.opacity(0.66), tint], startPoint: .topLeading, endPoint: .bottomTrailing))
                        .overlay {
                            RoundedRectangle(cornerRadius: isRegular ? 14 : 12, style: .continuous)
                                .fill(
                                    RadialGradient(
                                        colors: [Color.white.opacity(0.45), .clear],
                                        center: UnitPoint(x: 0.28, y: 0.18),
                                        startRadius: 0,
                                        endRadius: isRegular ? 24 : 19
                                    )
                                )
                        }
                        .overlay {
                            RoundedRectangle(cornerRadius: isRegular ? 14 : 12, style: .continuous)
                                .stroke(Color.white.opacity(0.36), lineWidth: 0.8)
                        }
                        .shadow(color: tint.opacity(0.34), radius: 8, y: 4)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
                .padding(isRegular ? 14 : 10)

            VStack(alignment: .leading, spacing: isRegular ? 3 : 2) {
                Text(title)
                    .font(.system(size: isRegular ? 12.5 : 10.5, weight: .medium, design: .rounded))
                    .foregroundStyle(navy.opacity(0.68))

                Text(value)
                    .font(.system(size: isRegular ? 20 : 15.5, weight: .bold, design: .rounded))
                    .foregroundStyle(navy)
                    .lineLimit(1)
                    .minimumScaleFactor(0.60)
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
            .padding(.top, isRegular ? 14 : 10)
            .padding(.leading, isRegular ? 72 : 56)
            .padding(.trailing, isRegular ? 12 : 8)

            Text(status)
                .font(.system(size: isRegular ? 12 : 10.5, weight: .bold, design: .rounded))
                .foregroundStyle(statusColor)
                .lineLimit(1)
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .bottomLeading)
                .padding(.leading, isRegular ? 14 : 10)
                .padding(.bottom, isRegular ? 13 : 9)

            ReferenceSparkline(values: values, tint: tint)
                .frame(width: isRegular ? 170 : 104, height: isRegular ? 36 : 27)
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .bottomTrailing)
                .padding(.trailing, isRegular ? 14 : 9)
                .padding(.bottom, isRegular ? 11 : 7)
                .opacity(0.96)
        }
        .frame(height: isRegular ? 112 : 84)
    }

    private var aiBrief: some View {
        Button { selection = .ai } label: {
            HStack(spacing: isRegular ? 14 : 7) {
                VStack(alignment: .leading, spacing: isRegular ? 7 : 4) {
                    HStack(spacing: 7) {
                        Image(systemName: "sparkles")
                            .font(.system(size: isRegular ? 14 : 12, weight: .semibold))
                            .foregroundStyle(violet)
                        Text("GALACTIC AI BRIEF")
                            .font(.system(size: isRegular ? 11 : 9.5, weight: .bold))
                            .tracking(isRegular ? 2.1 : 1.85)
                            .foregroundStyle(blue)
                    }

                    Text(store.insights.first?.title ?? "Your financial brief is ready")
                        .font(.system(size: isRegular ? 19 : 15, weight: .bold, design: .rounded))
                        .foregroundStyle(navy)
                        .multilineTextAlignment(.leading)
                        .lineLimit(1)
                        .minimumScaleFactor(0.72)

                    HStack(spacing: 6) {
                        Text("Review the numbers")
                        Image(systemName: "arrow.right")
                    }
                    .font(.system(size: isRegular ? 13 : 11.5, weight: .semibold, design: .rounded))
                    .foregroundStyle(blue)
                }
                .frame(maxWidth: .infinity, alignment: .leading)

                ReferenceRobotStage(isRegular: isRegular)
                    .frame(width: isRegular ? 110 : 84, height: isRegular ? 94 : 72)
            }
            .padding(.leading, isRegular ? 20 : 14)
            .padding(.trailing, isRegular ? 10 : 5)
            .frame(height: isRegular ? 108 : 84)
            .background {
                ZStack {
                    RoundedRectangle(cornerRadius: isRegular ? 24 : 20, style: .continuous)
                        .fill(Color.white.opacity(0.75))
                    ReferenceMiniCosmos()
                        .clipShape(RoundedRectangle(cornerRadius: isRegular ? 24 : 20, style: .continuous))
                }
            }
            .overlay {
                RoundedRectangle(cornerRadius: isRegular ? 24 : 20, style: .continuous)
                    .stroke(Color.white.opacity(0.96), lineWidth: 1.2)
            }
            .shadow(color: violet.opacity(0.13), radius: 13, y: 6)
        }
        .buttonStyle(.plain)
    }

    private var previousIncome: Double {
        store.monthlyPoints.dropLast().last?.income ?? 0
    }

    private var previousExpense: Double {
        store.monthlyPoints.dropLast().last?.expense ?? 0
    }

    private var revenueChange: Double {
        percentChange(current: store.currentMonthIncome, previous: previousIncome)
    }

    private var expenseChange: Double {
        percentChange(current: store.currentMonthExpenses, previous: previousExpense)
    }

    private var netChange: Double {
        percentChange(current: store.currentMonthNet, previous: previousIncome - previousExpense)
    }

    private var cumulativeBalancePoints: [Double] {
        var running = max(0, store.balance - store.monthlyPoints.reduce(0) { $0 + ($1.income - $1.expense) })
        return store.monthlyPoints.map { point in
            running += point.income - point.expense
            return running
        }
    }

    private func percentChange(current: Double, previous: Double) -> Double {
        guard abs(previous) > 0.001 else { return current == 0 ? 0 : 100 }
        return ((current - previous) / abs(previous)) * 100
    }

    private func changeText(_ change: Double) -> String {
        let arrow = change >= 0 ? "↑" : "↓"
        return "\(arrow) \(abs(change).formatted(.number.precision(.fractionLength(1))))%"
    }
}

private struct ReferenceGlass: View {
    let cornerRadius: CGFloat

    var body: some View {
        RoundedRectangle(cornerRadius: cornerRadius, style: .continuous)
            .fill(Color.white.opacity(0.80))
            .overlay {
                RoundedRectangle(cornerRadius: cornerRadius, style: .continuous)
                    .fill(
                        LinearGradient(
                            colors: [
                                Color.white.opacity(0.60),
                                Color(red: 1.0, green: 0.93, blue: 0.97).opacity(0.11),
                                Color(red: 0.92, green: 0.94, blue: 1.0).opacity(0.19)
                            ],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        )
                    )
            }
            .overlay {
                RoundedRectangle(cornerRadius: cornerRadius, style: .continuous)
                    .stroke(Color.white.opacity(0.99), lineWidth: 1.1)
            }
            .shadow(color: Color(red: 0.43, green: 0.39, blue: 0.72).opacity(0.11), radius: 11, y: 5)
    }
}

private struct ReferencePastelBackground: View {
    var body: some View {
        GeometryReader { proxy in
            ZStack {
                LinearGradient(
                    colors: [
                        Color(red: 0.985, green: 0.975, blue: 1.0),
                        Color(red: 1.0, green: 0.965, blue: 0.94),
                        Color(red: 1.0, green: 0.925, blue: 0.965),
                        Color(red: 0.95, green: 0.93, blue: 1.0),
                        Color(red: 0.91, green: 0.965, blue: 1.0)
                    ],
                    startPoint: .topLeading,
                    endPoint: .bottomTrailing
                )

                RadialGradient(
                    colors: [Color(red: 1.0, green: 0.80, blue: 0.56).opacity(0.22), .clear],
                    center: UnitPoint(x: 0.62, y: 0.22),
                    startRadius: 0,
                    endRadius: proxy.size.width * 0.72
                )

                RadialGradient(
                    colors: [Color(red: 1.0, green: 0.60, blue: 0.78).opacity(0.25), .clear],
                    center: UnitPoint(x: 0.90, y: 0.34),
                    startRadius: 0,
                    endRadius: proxy.size.width * 0.84
                )

                RadialGradient(
                    colors: [Color(red: 0.62, green: 0.54, blue: 1.0).opacity(0.20), .clear],
                    center: UnitPoint(x: 0.17, y: 0.79),
                    startRadius: 0,
                    endRadius: proxy.size.width * 0.88
                )

                RadialGradient(
                    colors: [Color(red: 0.44, green: 0.80, blue: 1.0).opacity(0.15), .clear],
                    center: .bottomTrailing,
                    startRadius: 0,
                    endRadius: proxy.size.width * 0.90
                )

                ReferenceNebulaClouds(opacity: 0.17)
                ReferenceStars(count: 54, opacity: 0.72)
            }
        }
    }
}

private struct ReferenceHeroBackground: View {
    var body: some View {
        ZStack {
            LinearGradient(
                colors: [
                    Color(red: 1.0, green: 0.95, blue: 0.78),
                    Color(red: 1.0, green: 0.80, blue: 0.85),
                    Color(red: 0.91, green: 0.70, blue: 1.0),
                    Color(red: 0.55, green: 0.88, blue: 1.0)
                ],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )

            RadialGradient(
                colors: [Color.white.opacity(0.82), .clear],
                center: UnitPoint(x: 0.12, y: 0.20),
                startRadius: 0,
                endRadius: 175
            )

            RadialGradient(
                colors: [Color(red: 1.0, green: 0.47, blue: 0.83).opacity(0.36), .clear],
                center: UnitPoint(x: 0.54, y: 0.84),
                startRadius: 0,
                endRadius: 205
            )

            RadialGradient(
                colors: [Color(red: 0.44, green: 0.68, blue: 1.0).opacity(0.34), .clear],
                center: .topTrailing,
                startRadius: 0,
                endRadius: 190
            )

            ReferenceNebulaClouds(opacity: 0.27)
            ReferenceStars(count: 40, opacity: 0.88)
        }
    }
}

private struct ReferenceNebulaClouds: View {
    let opacity: Double

    var body: some View {
        GeometryReader { proxy in
            ZStack {
                ForEach(0..<11, id: \.self) { index in
                    let width = proxy.size.width * CGFloat(0.20 + Double(index % 4) * 0.065)
                    let height = width * CGFloat(0.36 + Double(index % 3) * 0.10)
                    let x = proxy.size.width * CGFloat(0.04 + Double((index * 29) % 90) / 100.0)
                    let y = proxy.size.height * CGFloat(0.10 + Double((index * 43) % 79) / 100.0)

                    Ellipse()
                        .fill(Color.white.opacity(opacity * (index.isMultiple(of: 2) ? 1.0 : 0.67)))
                        .frame(width: width, height: height)
                        .blur(radius: 14)
                        .position(x: x, y: y)
                }
            }
        }
        .allowsHitTesting(false)
    }
}

private struct ReferenceStars: View {
    let count: Int
    let opacity: Double

    var body: some View {
        GeometryReader { proxy in
            ZStack {
                ForEach(0..<count, id: \.self) { index in
                    let x = CGFloat((index * 37 + 11) % 97) / 100
                    let y = CGFloat((index * 53 + 7) % 93) / 100
                    let size = CGFloat(1 + (index % 3))

                    Circle()
                        .fill(Color.white.opacity(index.isMultiple(of: 4) ? opacity : opacity * 0.58))
                        .frame(width: size, height: size)
                        .shadow(color: Color.white.opacity(opacity * 0.86), radius: index.isMultiple(of: 4) ? 3 : 1)
                        .position(x: proxy.size.width * x, y: proxy.size.height * y)

                    if index.isMultiple(of: 7) {
                        ZStack {
                            Capsule().fill(Color.white.opacity(opacity * 0.76)).frame(width: 1, height: 9)
                            Capsule().fill(Color.white.opacity(opacity * 0.76)).frame(width: 9, height: 1)
                        }
                        .shadow(color: .white.opacity(opacity), radius: 4)
                        .position(x: proxy.size.width * x, y: proxy.size.height * y)
                    }
                }
            }
        }
        .allowsHitTesting(false)
    }
}

private struct ReferenceMoon: View {
    var body: some View {
        GeometryReader { proxy in
            let size = min(proxy.size.width, proxy.size.height)

            ZStack {
                Circle()
                    .fill(Color.white.opacity(0.62))
                    .frame(width: size * 1.10, height: size * 1.10)
                    .blur(radius: size * 0.085)

                Circle()
                    .fill(
                        RadialGradient(
                            colors: [
                                Color(red: 1.0, green: 0.995, blue: 0.95),
                                Color(red: 1.0, green: 0.91, blue: 0.84),
                                Color(red: 0.99, green: 0.72, blue: 0.80),
                                Color(red: 0.79, green: 0.59, blue: 0.94),
                                Color(red: 0.43, green: 0.53, blue: 0.91)
                            ],
                            center: UnitPoint(x: 0.22, y: 0.23),
                            startRadius: 0,
                            endRadius: size * 0.76
                        )
                    )
                    .frame(width: size * 0.96, height: size * 0.96)
                    .overlay {
                        ReferenceMoonTexture()
                            .padding(size * 0.035)
                            .clipShape(Circle())
                    }
                    .overlay {
                        LinearGradient(
                            colors: [Color.white.opacity(0.60), Color.white.opacity(0.08), Color.clear],
                            startPoint: .leading,
                            endPoint: .trailing
                        )
                        .clipShape(Circle())
                    }
                    .overlay {
                        RadialGradient(
                            colors: [Color.clear, Color(red: 0.34, green: 0.49, blue: 1.0).opacity(0.31)],
                            center: UnitPoint(x: 0.38, y: 0.35),
                            startRadius: size * 0.20,
                            endRadius: size * 0.54
                        )
                        .clipShape(Circle())
                    }
                    .overlay {
                        Circle()
                            .stroke(
                                LinearGradient(
                                    colors: [Color.white.opacity(0.94), Color(red: 0.77, green: 0.67, blue: 1.0), Color(red: 0.40, green: 0.88, blue: 1.0)],
                                    startPoint: .topLeading,
                                    endPoint: .bottomTrailing
                                ),
                                lineWidth: 1.5
                            )
                    }
                    .shadow(color: Color.white.opacity(0.94), radius: 6)
                    .shadow(color: Color(red: 0.62, green: 0.52, blue: 1.0).opacity(0.52), radius: 18)

                Circle()
                    .trim(from: 0.10, to: 0.52)
                    .stroke(Color.white.opacity(0.48), style: StrokeStyle(lineWidth: max(1.5, size * 0.012), lineCap: .round))
                    .frame(width: size * 1.02, height: size * 1.02)
                    .rotationEffect(.degrees(26))
                    .blur(radius: 0.3)
            }
            .frame(width: size, height: size)
        }
        .accessibilityHidden(true)
    }
}

private struct ReferenceMoonTexture: View {
    var body: some View {
        GeometryReader { proxy in
            let size = min(proxy.size.width, proxy.size.height)

            ZStack {
                ForEach(0..<46, id: \.self) { index in
                    let diameter = size * CGFloat(0.030 + Double(index % 7) * 0.013)
                    let x = size * CGFloat(0.05 + Double((index * 31 + 5) % 91) / 100.0)
                    let y = size * CGFloat(0.05 + Double((index * 47 + 3) % 91) / 100.0)

                    Circle()
                        .fill(
                            RadialGradient(
                                colors: [
                                    Color(red: 0.29, green: 0.27, blue: 0.55).opacity(index.isMultiple(of: 4) ? 0.42 : 0.31),
                                    Color(red: 0.65, green: 0.47, blue: 0.69).opacity(0.20),
                                    Color.white.opacity(0.04)
                                ],
                                center: .bottomTrailing,
                                startRadius: 0,
                                endRadius: diameter
                            )
                        )
                        .overlay {
                            Circle()
                                .stroke(Color.white.opacity(index.isMultiple(of: 3) ? 0.34 : 0.15), lineWidth: 0.7)
                        }
                        .frame(width: diameter, height: diameter)
                        .position(x: x, y: y)
                }

                ForEach(0..<8, id: \.self) { index in
                    Ellipse()
                        .stroke(Color.white.opacity(0.12), lineWidth: 1)
                        .frame(width: size * CGFloat(0.20 + Double(index % 3) * 0.055), height: size * 0.040)
                        .rotationEffect(.degrees(Double(index * 19 - 51)))
                        .position(
                            x: size * CGFloat(0.15 + Double((index * 23) % 70) / 100.0),
                            y: size * CGFloat(0.14 + Double((index * 39) % 69) / 100.0)
                        )
                }
            }
        }
    }
}

private struct ReferenceRobotStage: View {
    let isRegular: Bool

    var body: some View {
        ZStack(alignment: .bottom) {
            Ellipse()
                .stroke(Color(red: 0.64, green: 0.47, blue: 1.0).opacity(0.38), lineWidth: 1.1)
                .frame(width: isRegular ? 104 : 79, height: isRegular ? 24 : 18)
                .blur(radius: 0.4)
                .offset(y: isRegular ? 2 : 1)

            Ellipse()
                .stroke(Color(red: 0.35, green: 0.83, blue: 1.0).opacity(0.35), lineWidth: 1)
                .frame(width: isRegular ? 82 : 63, height: isRegular ? 17 : 13)
                .offset(y: isRegular ? -1 : -1)

            RadialGradient(
                colors: [Color(red: 0.64, green: 0.45, blue: 1.0).opacity(0.22), .clear],
                center: .bottom,
                startRadius: 0,
                endRadius: isRegular ? 54 : 40
            )
            .frame(width: isRegular ? 108 : 82, height: isRegular ? 72 : 55)

            GalacticRobot()
                .frame(width: isRegular ? 94 : 72, height: isRegular ? 94 : 72)
                .offset(y: isRegular ? -6 : -4)
        }
        .accessibilityHidden(true)
    }
}

private struct ReferenceMiniCosmos: View {
    var body: some View {
        ZStack {
            LinearGradient(
                colors: [
                    Color.clear,
                    Color(red: 1.0, green: 0.73, blue: 0.87).opacity(0.17),
                    Color(red: 0.76, green: 0.62, blue: 1.0).opacity(0.24),
                    Color(red: 0.49, green: 0.84, blue: 1.0).opacity(0.20)
                ],
                startPoint: .leading,
                endPoint: .trailing
            )
            ReferenceStars(count: 22, opacity: 0.82)
        }
    }
}

private struct ReferenceSparkline: View {
    let values: [Double]
    let tint: Color

    var body: some View {
        GeometryReader { proxy in
            let points = pathPoints(in: proxy.size)

            ZStack(alignment: .topLeading) {
                if points.count > 1 {
                    Path { path in
                        path.move(to: points[0])
                        for point in points.dropFirst() {
                            path.addLine(to: point)
                        }
                    }
                    .stroke(tint.opacity(0.94), style: StrokeStyle(lineWidth: 2.0, lineCap: .round, lineJoin: .round))

                    if let last = points.last {
                        Circle()
                            .fill(tint)
                            .frame(width: 7, height: 7)
                            .overlay { Circle().stroke(Color.white, lineWidth: 1) }
                            .shadow(color: tint.opacity(0.28), radius: 3)
                            .position(last)
                    }
                }
            }
        }
        .allowsHitTesting(false)
    }

    private func pathPoints(in size: CGSize) -> [CGPoint] {
        let sample = values.isEmpty ? [0, 1, 2, 1, 3, 4, 5] : values
        guard sample.count > 1 else { return [] }

        let minimum = sample.min() ?? 0
        let maximum = sample.max() ?? 1
        let range = max(maximum - minimum, 0.001)

        return sample.enumerated().map { index, value in
            let x = size.width * CGFloat(index) / CGFloat(sample.count - 1)
            let normalized = (value - minimum) / range
            let y = size.height * (0.86 - CGFloat(normalized) * 0.68)
            return CGPoint(x: x, y: y)
        }
    }
}
