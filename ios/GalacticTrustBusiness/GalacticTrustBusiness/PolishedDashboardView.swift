import SwiftUI

struct PolishedDashboardView: View {
    @EnvironmentObject private var store: FinancialStore
    @Environment(\.horizontalSizeClass) private var horizontalSizeClass
    @Binding var selection: AppTab

    @State private var searchText = ""
    @State private var showingInvoices = false

    private let navy = Color(red: 0.025, green: 0.055, blue: 0.27)
    private let blue = Color(red: 0.18, green: 0.31, blue: 1.00)
    private let cyan = Color(red: 0.00, green: 0.82, blue: 0.78)
    private let violet = Color(red: 0.59, green: 0.22, blue: 0.98)
    private let pink = Color(red: 1.00, green: 0.20, blue: 0.47)
    private let green = Color(red: 0.02, green: 0.77, blue: 0.36)

    private var isPad: Bool { horizontalSizeClass == .regular }
    private var contentWidth: CGFloat { isPad ? 920 : 470 }
    private var horizontalPadding: CGFloat { isPad ? 34 : 12 }
    private var sectionSpacing: CGFloat { isPad ? 14 : 8 }

    var body: some View {
        ScrollView(showsIndicators: false) {
            VStack(spacing: sectionSpacing) {
                header
                searchRow
                cashHero
                quickActions
                metricGrid
                aiBrief
            }
            .frame(maxWidth: contentWidth)
            .padding(.horizontal, horizontalPadding)
            .padding(.top, isPad ? 18 : 7)
            .padding(.bottom, isPad ? 24 : 10)
            .frame(maxWidth: .infinity)
        }
        .background {
            PolishedCosmicBackground()
                .ignoresSafeArea()
        }
        .toolbar(.hidden, for: .navigationBar)
        .sheet(isPresented: $showingInvoices) {
            NavigationStack { InvoicesView() }
                .environmentObject(store)
        }
    }

    private var header: some View {
        HStack(alignment: .top, spacing: isPad ? 18 : 10) {
            VStack(alignment: .leading, spacing: isPad ? 7 : 4) {
                Text("GALACTIC TRUST • BUSINESS")
                    .font(.system(size: isPad ? 12 : 10, weight: .bold))
                    .tracking(isPad ? 3.1 : 2.35)
                    .foregroundStyle(blue)

                Text("Welcome back,\n\(store.profile.name)")
                    .font(.system(size: isPad ? 44 : 33, weight: .bold, design: .rounded))
                    .foregroundStyle(navy)
                    .lineSpacing(isPad ? -3 : -2)
                    .minimumScaleFactor(0.70)
                    .fixedSize(horizontal: false, vertical: true)

                Text("Your business money, made clear.")
                    .font(.system(size: isPad ? 18 : 14.5, weight: .medium, design: .rounded))
                    .foregroundStyle(navy.opacity(0.58))
            }
            .frame(maxWidth: .infinity, alignment: .leading)

            GalacticBrandMark(size: isPad ? 68 : 50)
                .padding(.top, isPad ? 18 : 13)
        }
        .padding(.horizontal, isPad ? 4 : 2)
    }

    private var searchRow: some View {
        HStack(spacing: isPad ? 13 : 9) {
            HStack(spacing: isPad ? 13 : 10) {
                Image(systemName: "magnifyingglass")
                    .font(.system(size: isPad ? 21 : 18, weight: .medium))
                    .foregroundStyle(navy.opacity(0.70))

                TextField("Search transactions...", text: $searchText)
                    .font(.system(size: isPad ? 17 : 15, weight: .medium, design: .rounded))
                    .foregroundStyle(navy)
                    .textInputAutocapitalization(.never)
                    .submitLabel(.search)
                    .onSubmit { selection = .transactions }
            }
            .padding(.horizontal, isPad ? 23 : 18)
            .frame(maxWidth: .infinity)
            .frame(height: isPad ? 62 : 52)
            .background(PolishedGlass(cornerRadius: isPad ? 31 : 27))

            searchButton(icon: "calendar", destination: .cashFlow)
            searchButton(icon: "line.3.horizontal.decrease", destination: .transactions)
        }
    }

    private func searchButton(icon: String, destination: AppTab) -> some View {
        Button { selection = destination } label: {
            Image(systemName: icon)
                .font(.system(size: isPad ? 19 : 16.5, weight: .bold))
                .foregroundStyle(navy.opacity(0.74))
                .frame(width: isPad ? 62 : 52, height: isPad ? 62 : 52)
                .background(PolishedGlass(cornerRadius: isPad ? 31 : 26))
        }
        .buttonStyle(.plain)
    }

    private var cashHero: some View {
        Button { selection = .cashFlow } label: {
            ZStack {
                PolishedHeroBackground()

                GeometryReader { geo in
                    PolishedMoon()
                        .frame(
                            width: min(geo.size.width * (isPad ? 0.41 : 0.59), isPad ? 310 : 228),
                            height: min(geo.size.width * (isPad ? 0.41 : 0.59), isPad ? 310 : 228)
                        )
                        .position(
                            x: geo.size.width * (isPad ? 0.82 : 0.84),
                            y: geo.size.height * (isPad ? 0.55 : 0.57)
                        )

                    Circle()
                        .fill(
                            LinearGradient(
                                colors: [
                                    Color(red: 0.74, green: 0.47, blue: 1.0),
                                    Color(red: 0.49, green: 0.66, blue: 1.0),
                                    Color(red: 0.42, green: 0.89, blue: 1.0)
                                ],
                                startPoint: .topLeading,
                                endPoint: .bottomTrailing
                            )
                        )
                        .frame(width: isPad ? 62 : 52, height: isPad ? 62 : 52)
                        .overlay { Circle().stroke(Color.white.opacity(0.90), lineWidth: 1.3) }
                        .overlay {
                            Image(systemName: "arrow.up.right")
                                .font(.system(size: isPad ? 28 : 23, weight: .semibold))
                                .foregroundStyle(.white)
                        }
                        .shadow(color: Color.white.opacity(0.90), radius: 7)
                        .shadow(color: violet.opacity(0.34), radius: 16)
                        .position(x: geo.size.width * 0.92, y: geo.size.height * 0.83)
                }

                VStack(alignment: .leading, spacing: 0) {
                    HStack {
                        Text("RECORDED CASH")
                            .font(.system(size: isPad ? 12 : 10, weight: .bold))
                            .tracking(isPad ? 3.0 : 2.35)
                            .foregroundStyle(navy.opacity(0.82))

                        Spacer()

                        Label("PRIVATE", systemImage: "checkmark.shield.fill")
                            .font(.system(size: isPad ? 12 : 10, weight: .bold))
                            .foregroundStyle(blue)
                    }

                    Text(store.currency(store.balance))
                        .font(.system(size: isPad ? 50 : 39, weight: .bold, design: .rounded))
                        .foregroundStyle(navy)
                        .lineLimit(1)
                        .minimumScaleFactor(0.56)
                        .padding(.top, isPad ? 16 : 11)
                        .frame(maxWidth: isPad ? 500 : 275, alignment: .leading)

                    Text("Your current balance from recorded activity")
                        .font(.system(size: isPad ? 14 : 11.8, weight: .medium, design: .rounded))
                        .foregroundStyle(navy.opacity(0.65))
                        .padding(.top, 4)
                        .frame(maxWidth: isPad ? 470 : 255, alignment: .leading)

                    Spacer()

                    HStack(spacing: isPad ? 32 : 24) {
                        heroAmount(title: "Money in", value: "+\(store.currency(store.currentMonthIncome))", color: green)

                        Rectangle()
                            .fill(Color.white.opacity(0.78))
                            .frame(width: 1, height: isPad ? 48 : 39)

                        heroAmount(title: "Money out", value: "−\(store.currency(store.currentMonthExpenses))", color: pink)

                        Spacer(minLength: 0)
                    }
                }
                .padding(isPad ? 25 : 18)
            }
            .frame(height: isPad ? 286 : 214)
            .clipShape(RoundedRectangle(cornerRadius: isPad ? 34 : 28, style: .continuous))
            .overlay {
                RoundedRectangle(cornerRadius: isPad ? 34 : 28, style: .continuous)
                    .stroke(
                        LinearGradient(
                            colors: [
                                Color.white,
                                Color(red: 1.0, green: 0.75, blue: 0.86).opacity(0.95),
                                Color(red: 0.70, green: 0.58, blue: 1.0).opacity(0.92),
                                Color(red: 0.43, green: 0.90, blue: 1.0).opacity(0.98)
                            ],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        ),
                        lineWidth: isPad ? 2.0 : 1.8
                    )
            }
            .shadow(color: Color(red: 0.49, green: 0.39, blue: 0.92).opacity(0.20), radius: 20, y: 9)
            .shadow(color: Color.white.opacity(0.96), radius: 2)
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Recorded cash \(store.currency(store.balance)). Open cash flow.")
    }

    private func heroAmount(title: String, value: String, color: Color) -> some View {
        VStack(alignment: .leading, spacing: 3) {
            Text(value)
                .font(.system(size: isPad ? 19 : 15.5, weight: .bold, design: .rounded))
                .foregroundStyle(color)
                .lineLimit(1)
                .minimumScaleFactor(0.64)

            Text(title)
                .font(.system(size: isPad ? 12.5 : 10.8, weight: .medium, design: .rounded))
                .foregroundStyle(navy.opacity(0.70))
        }
    }

    private var quickActions: some View {
        HStack(spacing: isPad ? 13 : 8) {
            quickAction(title: "Add", icon: "plus", colors: [blue, violet]) {
                selection = .transactions
            }
            quickAction(title: "Invoices", icon: "doc.text.fill", colors: [cyan, Color(red: 0.08, green: 0.91, blue: 0.69)]) {
                showingInvoices = true
            }
            quickAction(title: "Cash Flow", icon: "chart.line.uptrend.xyaxis", colors: [violet, Color(red: 0.72, green: 0.22, blue: 1.0)]) {
                selection = .cashFlow
            }
            quickAction(title: "Ask AI", icon: "sparkles", colors: [pink, Color(red: 1.0, green: 0.38, blue: 0.55)]) {
                selection = .ai
            }
        }
    }

    private func quickAction(title: String, icon: String, colors: [Color], action: @escaping () -> Void) -> some View {
        Button(action: action) {
            VStack(spacing: isPad ? 9 : 6) {
                Image(systemName: icon)
                    .font(.system(size: isPad ? 23 : 19, weight: .bold))
                    .foregroundStyle(.white)
                    .frame(width: isPad ? 52 : 42, height: isPad ? 52 : 42)
                    .background {
                        Circle()
                            .fill(LinearGradient(colors: colors, startPoint: .topLeading, endPoint: .bottomTrailing))
                            .overlay { Circle().stroke(Color.white.opacity(0.43), lineWidth: 0.9) }
                            .shadow(color: colors.first?.opacity(0.38) ?? .clear, radius: 10, y: 4)
                    }

                Text(title)
                    .font(.system(size: isPad ? 13 : 10.8, weight: .bold, design: .rounded))
                    .foregroundStyle(navy)
                    .lineLimit(1)
                    .minimumScaleFactor(0.66)
            }
            .frame(maxWidth: .infinity)
            .frame(height: isPad ? 104 : 80)
            .background(PolishedGlass(cornerRadius: isPad ? 27 : 22))
        }
        .buttonStyle(.plain)
    }

    private var metricGrid: some View {
        LazyVGrid(
            columns: [
                GridItem(.flexible(), spacing: isPad ? 13 : 8),
                GridItem(.flexible(), spacing: isPad ? 13 : 8)
            ],
            spacing: isPad ? 13 : 8
        ) {
            metricCard(
                title: "Revenue",
                value: store.currency(store.currentMonthIncome),
                status: changeText(revenueChange),
                positive: revenueChange >= 0,
                icon: "arrow.down.left",
                tint: green,
                values: store.monthlyPoints.map(\.income)
            )

            metricCard(
                title: "Expenses",
                value: store.currency(store.currentMonthExpenses),
                status: changeText(expenseChange),
                positive: expenseChange <= 0,
                icon: "arrow.up.right",
                tint: pink,
                values: store.monthlyPoints.map(\.expense)
            )

            metricCard(
                title: "Net profit",
                value: store.currency(store.currentMonthNet),
                status: changeText(netChange),
                positive: netChange >= 0,
                icon: "chart.line.uptrend.xyaxis",
                tint: Color(red: 0.10, green: 0.56, blue: 1.0),
                values: store.monthlyPoints.map { $0.income - $0.expense }
            )

            metricCard(
                title: "Outstanding",
                value: store.currency(store.outstandingInvoices),
                status: store.overdueInvoices.isEmpty ? "All on track" : "\(store.overdueInvoices.count) overdue",
                positive: store.overdueInvoices.isEmpty,
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
        positive: Bool,
        icon: String,
        tint: Color,
        values: [Double]
    ) -> some View {
        ZStack(alignment: .bottomTrailing) {
            PolishedGlass(cornerRadius: isPad ? 26 : 20)

            PolishedSparkline(values: values, tint: tint)
                .frame(width: isPad ? 190 : 104, height: isPad ? 40 : 27)
                .padding(.trailing, isPad ? 18 : 10)
                .padding(.bottom, isPad ? 14 : 8)
                .opacity(0.96)

            HStack(alignment: .top, spacing: isPad ? 14 : 10) {
                Image(systemName: icon)
                    .font(.system(size: isPad ? 21 : 17, weight: .bold))
                    .foregroundStyle(.white)
                    .frame(width: isPad ? 48 : 38, height: isPad ? 48 : 38)
                    .background {
                        RoundedRectangle(cornerRadius: isPad ? 15 : 12, style: .continuous)
                            .fill(LinearGradient(colors: [tint.opacity(0.72), tint], startPoint: .topLeading, endPoint: .bottomTrailing))
                            .overlay {
                                RoundedRectangle(cornerRadius: isPad ? 15 : 12, style: .continuous)
                                    .stroke(Color.white.opacity(0.36), lineWidth: 0.9)
                            }
                            .shadow(color: tint.opacity(0.30), radius: 8, y: 4)
                    }

                VStack(alignment: .leading, spacing: isPad ? 4 : 2) {
                    Text(title)
                        .font(.system(size: isPad ? 13.5 : 10.8, weight: .medium, design: .rounded))
                        .foregroundStyle(navy.opacity(0.68))

                    Text(value)
                        .font(.system(size: isPad ? 21 : 16, weight: .bold, design: .rounded))
                        .foregroundStyle(navy)
                        .lineLimit(1)
                        .minimumScaleFactor(0.58)

                    Spacer(minLength: 0)

                    Text(status)
                        .font(.system(size: isPad ? 12.5 : 10.8, weight: .bold, design: .rounded))
                        .foregroundStyle(positive ? green : pink)
                        .lineLimit(1)
                }

                Spacer(minLength: 0)
            }
            .padding(isPad ? 15 : 10)
        }
        .frame(height: isPad ? 126 : 90)
    }

    private var aiBrief: some View {
        Button { selection = .ai } label: {
            HStack(spacing: isPad ? 15 : 8) {
                VStack(alignment: .leading, spacing: isPad ? 7 : 4) {
                    HStack(spacing: 6) {
                        Image(systemName: "sparkles")
                            .font(.system(size: isPad ? 15 : 12, weight: .semibold))
                            .foregroundStyle(violet)

                        Text("GALACTIC AI BRIEF")
                            .font(.system(size: isPad ? 11.5 : 9.7, weight: .bold))
                            .tracking(isPad ? 2.5 : 2.0)
                            .foregroundStyle(blue)
                    }

                    Text(store.insights.first?.title ?? "Your financial brief is ready")
                        .font(.system(size: isPad ? 20 : 15.5, weight: .bold, design: .rounded))
                        .foregroundStyle(navy)
                        .multilineTextAlignment(.leading)
                        .lineLimit(1)
                        .minimumScaleFactor(0.70)

                    HStack(spacing: 7) {
                        Text("Review the numbers")
                        Image(systemName: "arrow.right")
                    }
                    .font(.system(size: isPad ? 13.5 : 11.8, weight: .semibold, design: .rounded))
                    .foregroundStyle(blue)
                }
                .frame(maxWidth: .infinity, alignment: .leading)

                GalacticRobot()
                    .frame(width: isPad ? 102 : 76, height: isPad ? 102 : 76)
            }
            .padding(.leading, isPad ? 22 : 15)
            .padding(.trailing, isPad ? 14 : 8)
            .frame(height: isPad ? 118 : 90)
            .background {
                ZStack {
                    RoundedRectangle(cornerRadius: isPad ? 28 : 22, style: .continuous)
                        .fill(Color.white.opacity(0.76))

                    PolishedMiniCosmos()
                        .clipShape(RoundedRectangle(cornerRadius: isPad ? 28 : 22, style: .continuous))
                }
            }
            .overlay {
                RoundedRectangle(cornerRadius: isPad ? 28 : 22, style: .continuous)
                    .stroke(Color.white.opacity(0.98), lineWidth: 1.2)
            }
            .shadow(color: violet.opacity(0.13), radius: 14, y: 6)
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

private struct PolishedGlass: View {
    let cornerRadius: CGFloat

    var body: some View {
        RoundedRectangle(cornerRadius: cornerRadius, style: .continuous)
            .fill(Color.white.opacity(0.82))
            .overlay {
                RoundedRectangle(cornerRadius: cornerRadius, style: .continuous)
                    .fill(
                        LinearGradient(
                            colors: [
                                Color.white.opacity(0.68),
                                Color(red: 1.0, green: 0.91, blue: 0.96).opacity(0.12),
                                Color(red: 0.90, green: 0.93, blue: 1.0).opacity(0.20)
                            ],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        )
                    )
            }
            .overlay {
                RoundedRectangle(cornerRadius: cornerRadius, style: .continuous)
                    .stroke(Color.white.opacity(0.99), lineWidth: 1.2)
            }
            .shadow(color: Color(red: 0.44, green: 0.37, blue: 0.76).opacity(0.11), radius: 12, y: 5)
    }
}

private struct PolishedCosmicBackground: View {
    var body: some View {
        GeometryReader { proxy in
            ZStack {
                LinearGradient(
                    colors: [
                        Color(red: 1.0, green: 0.982, blue: 0.995),
                        Color(red: 1.0, green: 0.945, blue: 0.89),
                        Color(red: 1.0, green: 0.90, blue: 0.95),
                        Color(red: 0.93, green: 0.91, blue: 1.0),
                        Color(red: 0.89, green: 0.96, blue: 1.0)
                    ],
                    startPoint: .topLeading,
                    endPoint: .bottomTrailing
                )

                RadialGradient(
                    colors: [Color(red: 1.0, green: 0.77, blue: 0.47).opacity(0.30), .clear],
                    center: UnitPoint(x: 0.63, y: 0.18),
                    startRadius: 0,
                    endRadius: proxy.size.width * 0.74
                )

                RadialGradient(
                    colors: [Color(red: 1.0, green: 0.56, blue: 0.74).opacity(0.28), .clear],
                    center: UnitPoint(x: 0.94, y: 0.34),
                    startRadius: 0,
                    endRadius: proxy.size.width * 0.86
                )

                RadialGradient(
                    colors: [Color(red: 0.60, green: 0.51, blue: 1.0).opacity(0.22), .clear],
                    center: UnitPoint(x: 0.18, y: 0.79),
                    startRadius: 0,
                    endRadius: proxy.size.width * 0.92
                )

                PolishedClouds(opacity: 0.18)
                PolishedStars(count: 58, opacity: 0.78)
            }
        }
    }
}

private struct PolishedHeroBackground: View {
    var body: some View {
        ZStack {
            LinearGradient(
                colors: [
                    Color(red: 1.0, green: 0.96, blue: 0.78),
                    Color(red: 1.0, green: 0.76, blue: 0.83),
                    Color(red: 0.90, green: 0.65, blue: 1.0),
                    Color(red: 0.55, green: 0.88, blue: 1.0)
                ],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )

            RadialGradient(
                colors: [Color.white.opacity(0.86), .clear],
                center: UnitPoint(x: 0.10, y: 0.16),
                startRadius: 0,
                endRadius: 190
            )

            RadialGradient(
                colors: [Color(red: 1.0, green: 0.41, blue: 0.79).opacity(0.35), .clear],
                center: UnitPoint(x: 0.50, y: 0.84),
                startRadius: 0,
                endRadius: 220
            )

            PolishedClouds(opacity: 0.28)
            PolishedStars(count: 40, opacity: 0.92)
        }
    }
}

private struct PolishedClouds: View {
    let opacity: Double

    var body: some View {
        GeometryReader { proxy in
            ZStack {
                ForEach(0..<11, id: \.self) { index in
                    let width = proxy.size.width * CGFloat(0.20 + Double(index % 4) * 0.065)
                    let height = width * CGFloat(0.34 + Double(index % 3) * 0.11)
                    let x = proxy.size.width * CGFloat(0.04 + Double((index * 31) % 90) / 100.0)
                    let y = proxy.size.height * CGFloat(0.10 + Double((index * 47) % 78) / 100.0)

                    Ellipse()
                        .fill(Color.white.opacity(opacity * (index.isMultiple(of: 2) ? 1.0 : 0.68)))
                        .frame(width: width, height: height)
                        .blur(radius: 15)
                        .position(x: x, y: y)
                }
            }
        }
        .allowsHitTesting(false)
    }
}

private struct PolishedStars: View {
    let count: Int
    let opacity: Double

    var body: some View {
        GeometryReader { proxy in
            ZStack {
                ForEach(0..<count, id: \.self) { index in
                    let x = CGFloat((index * 37 + 13) % 97) / 100
                    let y = CGFloat((index * 59 + 9) % 93) / 100
                    let size = CGFloat(1 + (index % 3))

                    Circle()
                        .fill(Color.white.opacity(index.isMultiple(of: 4) ? opacity : opacity * 0.58))
                        .frame(width: size, height: size)
                        .shadow(color: Color.white.opacity(opacity * 0.90), radius: index.isMultiple(of: 4) ? 3 : 1)
                        .position(x: proxy.size.width * x, y: proxy.size.height * y)

                    if index.isMultiple(of: 8) {
                        ZStack {
                            Capsule().fill(Color.white.opacity(opacity * 0.76)).frame(width: 1, height: 10)
                            Capsule().fill(Color.white.opacity(opacity * 0.76)).frame(width: 10, height: 1)
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

private struct PolishedMoon: View {
    var body: some View {
        GeometryReader { proxy in
            let s = min(proxy.size.width, proxy.size.height)

            ZStack {
                Circle()
                    .fill(Color.white.opacity(0.76))
                    .frame(width: s * 1.12, height: s * 1.12)
                    .blur(radius: s * 0.075)

                Ellipse()
                    .stroke(
                        LinearGradient(
                            colors: [
                                Color.white.opacity(0.98),
                                Color(red: 1.0, green: 0.65, blue: 0.85),
                                Color(red: 0.72, green: 0.55, blue: 1.0),
                                Color(red: 0.39, green: 0.90, blue: 1.0)
                            ],
                            startPoint: .leading,
                            endPoint: .trailing
                        ),
                        lineWidth: max(4, s * 0.040)
                    )
                    .frame(width: s * 1.31, height: s * 0.39)
                    .rotationEffect(.degrees(-14))
                    .shadow(color: .white.opacity(0.94), radius: 8)
                    .shadow(color: Color(red: 0.59, green: 0.38, blue: 1.0).opacity(0.35), radius: 12)

                Circle()
                    .fill(
                        RadialGradient(
                            colors: [
                                Color(red: 1.0, green: 0.995, blue: 0.95),
                                Color(red: 1.0, green: 0.91, blue: 0.78),
                                Color(red: 0.99, green: 0.73, blue: 0.79),
                                Color(red: 0.81, green: 0.58, blue: 0.94),
                                Color(red: 0.53, green: 0.52, blue: 0.89)
                            ],
                            center: UnitPoint(x: 0.24, y: 0.17),
                            startRadius: 0,
                            endRadius: s * 0.73
                        )
                    )
                    .frame(width: s * 0.84, height: s * 0.84)
                    .overlay {
                        PolishedMoonSurface()
                            .padding(s * 0.072)
                            .clipShape(Circle())
                    }
                    .overlay {
                        RadialGradient(
                            colors: [Color.white.opacity(0.72), .clear],
                            center: UnitPoint(x: 0.24, y: 0.14),
                            startRadius: 0,
                            endRadius: s * 0.34
                        )
                        .frame(width: s * 0.84, height: s * 0.84)
                        .clipShape(Circle())
                    }
                    .overlay {
                        Circle()
                            .stroke(Color.white.opacity(0.88), lineWidth: 1.5)
                    }
                    .shadow(color: Color.white.opacity(0.98), radius: 6)
                    .shadow(color: Color(red: 0.68, green: 0.52, blue: 1.0).opacity(0.52), radius: 20)

                Ellipse()
                    .trim(from: 0.02, to: 0.49)
                    .stroke(
                        LinearGradient(
                            colors: [
                                Color(red: 1.0, green: 0.72, blue: 0.86),
                                Color(red: 0.74, green: 0.54, blue: 1.0),
                                Color(red: 0.39, green: 0.91, blue: 1.0)
                            ],
                            startPoint: .leading,
                            endPoint: .trailing
                        ),
                        style: StrokeStyle(lineWidth: max(5, s * 0.044), lineCap: .round)
                    )
                    .frame(width: s * 1.31, height: s * 0.39)
                    .rotationEffect(.degrees(-14))
                    .shadow(color: .white.opacity(0.94), radius: 6)
            }
            .frame(width: s, height: s)
        }
        .accessibilityHidden(true)
    }
}

private struct PolishedMoonSurface: View {
    var body: some View {
        GeometryReader { proxy in
            let s = min(proxy.size.width, proxy.size.height)

            ZStack {
                ForEach(0..<31, id: \.self) { index in
                    let diameter = s * CGFloat(0.035 + Double((index * 7) % 8) * 0.009)
                    let x = s * CGFloat(0.09 + Double((index * 29 + 7) % 82) / 100.0)
                    let y = s * CGFloat(0.08 + Double((index * 43 + 11) % 82) / 100.0)

                    Circle()
                        .fill(
                            RadialGradient(
                                colors: [
                                    Color(red: 0.34, green: 0.26, blue: 0.52).opacity(0.32),
                                    Color(red: 0.69, green: 0.48, blue: 0.67).opacity(0.19),
                                    Color.white.opacity(0.04)
                                ],
                                center: .bottomTrailing,
                                startRadius: 0,
                                endRadius: diameter
                            )
                        )
                        .overlay {
                            Circle()
                                .stroke(Color.white.opacity(index.isMultiple(of: 3) ? 0.38 : 0.20), lineWidth: 0.8)
                        }
                        .shadow(color: Color(red: 0.35, green: 0.26, blue: 0.54).opacity(0.10), radius: 1, x: 1, y: 1)
                        .frame(width: diameter, height: diameter)
                        .position(x: x, y: y)
                }

                ForEach(0..<8, id: \.self) { index in
                    let width = s * CGFloat(0.14 + Double(index % 4) * 0.045)
                    let x = s * CGFloat(0.15 + Double((index * 17 + 9) % 68) / 100.0)
                    let y = s * CGFloat(0.14 + Double((index * 31 + 5) % 67) / 100.0)

                    Ellipse()
                        .stroke(Color.white.opacity(0.13), lineWidth: 1)
                        .frame(width: width, height: width * 0.28)
                        .rotationEffect(.degrees(Double(index * 23 - 55)))
                        .position(x: x, y: y)
                }
            }
        }
    }
}

private struct PolishedMiniCosmos: View {
    var body: some View {
        ZStack {
            LinearGradient(
                colors: [
                    Color.clear,
                    Color(red: 1.0, green: 0.70, blue: 0.86).opacity(0.18),
                    Color(red: 0.74, green: 0.59, blue: 1.0).opacity(0.25),
                    Color(red: 0.44, green: 0.85, blue: 1.0).opacity(0.21)
                ],
                startPoint: .leading,
                endPoint: .trailing
            )

            PolishedStars(count: 22, opacity: 0.82)
        }
    }
}

private struct PolishedSparkline: View {
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
                    .stroke(tint.opacity(0.96), style: StrokeStyle(lineWidth: 2.2, lineCap: .round, lineJoin: .round))

                    if let last = points.last {
                        Circle()
                            .fill(tint)
                            .frame(width: 7.5, height: 7.5)
                            .overlay { Circle().stroke(Color.white, lineWidth: 1) }
                            .position(last)
                    }
                }
            }
        }
        .accessibilityHidden(true)
    }

    private func pathPoints(in size: CGSize) -> [CGPoint] {
        guard values.count > 1 else { return [] }
        let low = values.min() ?? 0
        let high = values.max() ?? 1
        let span = max(high - low, 0.001)

        return values.enumerated().map { index, value in
            let x = CGFloat(index) / CGFloat(values.count - 1) * size.width
            let normalized = (value - low) / span
            let y = size.height - CGFloat(normalized) * (size.height - 4) - 2
            return CGPoint(x: x, y: y)
        }
    }
}
