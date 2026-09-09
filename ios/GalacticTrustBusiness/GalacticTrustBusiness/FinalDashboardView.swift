import SwiftUI

struct FinalDashboardView: View {
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
            FinalPastelBackground()
                .ignoresSafeArea()
        }
        .toolbar(.hidden, for: .navigationBar)
        .sheet(isPresented: $showingInvoices) {
            NavigationStack { InvoicesView() }
                .environmentObject(store)
        }
    }

    private var header: some View {
        HStack(alignment: .top, spacing: 12) {
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
        .padding(.horizontal, 2)
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
            .background(FinalGlass(cornerRadius: isRegular ? 28 : 25))

            searchButton(icon: "calendar", destination: .cashFlow)
            searchButton(icon: "line.3.horizontal.decrease", destination: .transactions)
        }
    }

    private func searchButton(icon: String, destination: AppTab) -> some View {
        Button { selection = destination } label: {
            Image(systemName: icon)
                .font(.system(size: isRegular ? 18 : 16, weight: .bold))
                .foregroundStyle(navy.opacity(0.72))
                .frame(width: isRegular ? 56 : 48, height: isRegular ? 56 : 48)
                .background(FinalGlass(cornerRadius: isRegular ? 28 : 24))
        }
        .buttonStyle(.plain)
    }

    private var cashHero: some View {
        Button { selection = .cashFlow } label: {
            ZStack {
                FinalHeroBackground()

                GeometryReader { geo in
                    FinalMoon()
                        .frame(
                            width: min(geo.size.width * (isRegular ? 0.39 : 0.55), isRegular ? 270 : 210),
                            height: min(geo.size.width * (isRegular ? 0.39 : 0.55), isRegular ? 270 : 210)
                        )
                        .position(
                            x: geo.size.width * (isRegular ? 0.82 : 0.82),
                            y: geo.size.height * (isRegular ? 0.54 : 0.57)
                        )

                    Circle()
                        .fill(
                            LinearGradient(
                                colors: [
                                    Color(red: 0.76, green: 0.50, blue: 1.0),
                                    Color(red: 0.55, green: 0.64, blue: 1.0),
                                    Color(red: 0.48, green: 0.87, blue: 1.0)
                                ],
                                startPoint: .topLeading,
                                endPoint: .bottomTrailing
                            )
                        )
                        .frame(width: isRegular ? 58 : 48, height: isRegular ? 58 : 48)
                        .overlay { Circle().stroke(Color.white.opacity(0.82), lineWidth: 1.2) }
                        .overlay {
                            Image(systemName: "arrow.up.right")
                                .font(.system(size: isRegular ? 26 : 22, weight: .semibold))
                                .foregroundStyle(.white)
                        }
                        .shadow(color: Color.white.opacity(0.74), radius: 6)
                        .shadow(color: violet.opacity(0.30), radius: 15)
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
                            .fill(Color.white.opacity(0.76))
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
                                Color(red: 1.0, green: 0.78, blue: 0.87).opacity(0.94),
                                Color(red: 0.69, green: 0.63, blue: 1.0).opacity(0.90),
                                Color(red: 0.50, green: 0.88, blue: 1.0).opacity(0.96)
                            ],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        ),
                        lineWidth: 1.7
                    )
            }
            .shadow(color: Color(red: 0.48, green: 0.42, blue: 0.92).opacity(0.17), radius: 18, y: 8)
            .shadow(color: Color.white.opacity(0.94), radius: 2)
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
            quickAction(title: "Add", icon: "plus", colors: [blue, violet]) {
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
                            .overlay { Circle().stroke(Color.white.opacity(0.40), lineWidth: 0.9) }
                            .shadow(color: colors.first?.opacity(0.34) ?? .clear, radius: 9, y: 4)
                    }

                Text(title)
                    .font(.system(size: isRegular ? 12.5 : 10.5, weight: .bold, design: .rounded))
                    .foregroundStyle(navy)
                    .lineLimit(1)
                    .minimumScaleFactor(0.68)
            }
            .frame(maxWidth: .infinity)
            .frame(height: isRegular ? 92 : 76)
            .background(FinalGlass(cornerRadius: isRegular ? 24 : 21))
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
                tint: Color(red: 0.13, green: 0.53, blue: 0.98),
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
            FinalGlass(cornerRadius: isRegular ? 23 : 19)

            FinalSparkline(values: values, tint: tint)
                .frame(width: isRegular ? 165 : 96, height: isRegular ? 34 : 25)
                .padding(.trailing, isRegular ? 16 : 9)
                .padding(.bottom, isRegular ? 12 : 7)
                .opacity(0.94)

            HStack(alignment: .top, spacing: isRegular ? 13 : 9) {
                Image(systemName: icon)
                    .font(.system(size: isRegular ? 19 : 16, weight: .bold))
                    .foregroundStyle(.white)
                    .frame(width: isRegular ? 44 : 36, height: isRegular ? 44 : 36)
                    .background {
                        RoundedRectangle(cornerRadius: isRegular ? 14 : 12, style: .continuous)
                            .fill(LinearGradient(colors: [tint.opacity(0.70), tint], startPoint: .topLeading, endPoint: .bottomTrailing))
                            .overlay {
                                RoundedRectangle(cornerRadius: isRegular ? 14 : 12, style: .continuous)
                                    .stroke(Color.white.opacity(0.30), lineWidth: 0.8)
                            }
                            .shadow(color: tint.opacity(0.28), radius: 7, y: 4)
                    }

                VStack(alignment: .leading, spacing: isRegular ? 3 : 2) {
                    Text(title)
                        .font(.system(size: isRegular ? 12.5 : 10.5, weight: .medium, design: .rounded))
                        .foregroundStyle(navy.opacity(0.68))

                    Text(value)
                        .font(.system(size: isRegular ? 20 : 15.5, weight: .bold, design: .rounded))
                        .foregroundStyle(navy)
                        .lineLimit(1)
                        .minimumScaleFactor(0.60)

                    Spacer(minLength: 0)

                    Text(status)
                        .font(.system(size: isRegular ? 12 : 10.5, weight: .bold, design: .rounded))
                        .foregroundStyle(positive ? green : pink)
                        .lineLimit(1)
                }

                Spacer(minLength: 0)
            }
            .padding(isRegular ? 14 : 10)
        }
        .frame(height: isRegular ? 112 : 84)
    }

    private var aiBrief: some View {
        Button { selection = .ai } label: {
            HStack(spacing: isRegular ? 14 : 7) {
                VStack(alignment: .leading, spacing: isRegular ? 7 : 4) {
                    HStack(spacing: 6) {
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

                GalacticRobot()
                    .frame(width: isRegular ? 94 : 72, height: isRegular ? 94 : 72)
            }
            .padding(.leading, isRegular ? 20 : 14)
            .padding(.trailing, isRegular ? 12 : 7)
            .frame(height: isRegular ? 108 : 84)
            .background {
                ZStack {
                    RoundedRectangle(cornerRadius: isRegular ? 24 : 20, style: .continuous)
                        .fill(Color.white.opacity(0.74))
                    FinalMiniCosmos()
                        .clipShape(RoundedRectangle(cornerRadius: isRegular ? 24 : 20, style: .continuous))
                }
            }
            .overlay {
                RoundedRectangle(cornerRadius: isRegular ? 24 : 20, style: .continuous)
                    .stroke(Color.white.opacity(0.95), lineWidth: 1.2)
            }
            .shadow(color: violet.opacity(0.12), radius: 13, y: 6)
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

private struct FinalGlass: View {
    let cornerRadius: CGFloat

    var body: some View {
        RoundedRectangle(cornerRadius: cornerRadius, style: .continuous)
            .fill(Color.white.opacity(0.80))
            .overlay {
                RoundedRectangle(cornerRadius: cornerRadius, style: .continuous)
                    .fill(
                        LinearGradient(
                            colors: [
                                Color.white.opacity(0.58),
                                Color(red: 1.0, green: 0.93, blue: 0.97).opacity(0.10),
                                Color(red: 0.92, green: 0.94, blue: 1.0).opacity(0.18)
                            ],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        )
                    )
            }
            .overlay {
                RoundedRectangle(cornerRadius: cornerRadius, style: .continuous)
                    .stroke(Color.white.opacity(0.98), lineWidth: 1.1)
            }
            .shadow(color: Color(red: 0.43, green: 0.39, blue: 0.72).opacity(0.10), radius: 11, y: 5)
    }
}

private struct FinalPastelBackground: View {
    var body: some View {
        GeometryReader { proxy in
            ZStack {
                LinearGradient(
                    colors: [
                        Color(red: 0.995, green: 0.975, blue: 1.0),
                        Color(red: 1.0, green: 0.955, blue: 0.91),
                        Color(red: 1.0, green: 0.92, blue: 0.96),
                        Color(red: 0.95, green: 0.93, blue: 1.0),
                        Color(red: 0.91, green: 0.96, blue: 1.0)
                    ],
                    startPoint: .topLeading,
                    endPoint: .bottomTrailing
                )

                RadialGradient(
                    colors: [Color(red: 1.0, green: 0.78, blue: 0.54).opacity(0.25), .clear],
                    center: UnitPoint(x: 0.68, y: 0.20),
                    startRadius: 0,
                    endRadius: proxy.size.width * 0.72
                )

                RadialGradient(
                    colors: [Color(red: 1.0, green: 0.62, blue: 0.76).opacity(0.26), .clear],
                    center: UnitPoint(x: 0.92, y: 0.34),
                    startRadius: 0,
                    endRadius: proxy.size.width * 0.82
                )

                RadialGradient(
                    colors: [Color(red: 0.63, green: 0.55, blue: 1.0).opacity(0.20), .clear],
                    center: UnitPoint(x: 0.18, y: 0.80),
                    startRadius: 0,
                    endRadius: proxy.size.width * 0.88
                )

                FinalNebulaClouds(opacity: 0.18)
                FinalStars(count: 52, opacity: 0.74)
            }
        }
    }
}

private struct FinalHeroBackground: View {
    var body: some View {
        ZStack {
            LinearGradient(
                colors: [
                    Color(red: 1.0, green: 0.94, blue: 0.77),
                    Color(red: 1.0, green: 0.79, blue: 0.84),
                    Color(red: 0.88, green: 0.69, blue: 1.0),
                    Color(red: 0.58, green: 0.88, blue: 1.0)
                ],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )

            RadialGradient(
                colors: [Color.white.opacity(0.80), .clear],
                center: UnitPoint(x: 0.12, y: 0.20),
                startRadius: 0,
                endRadius: 175
            )

            RadialGradient(
                colors: [Color(red: 1.0, green: 0.47, blue: 0.83).opacity(0.34), .clear],
                center: UnitPoint(x: 0.52, y: 0.82),
                startRadius: 0,
                endRadius: 200
            )

            FinalNebulaClouds(opacity: 0.27)
            FinalStars(count: 36, opacity: 0.88)
        }
    }
}

private struct FinalNebulaClouds: View {
    let opacity: Double

    var body: some View {
        GeometryReader { proxy in
            ZStack {
                ForEach(0..<10, id: \.self) { index in
                    let w = proxy.size.width * CGFloat(0.22 + Double(index % 4) * 0.06)
                    let h = w * CGFloat(0.38 + Double(index % 3) * 0.10)
                    let x = proxy.size.width * CGFloat(0.05 + Double((index * 29) % 88) / 100.0)
                    let y = proxy.size.height * CGFloat(0.12 + Double((index * 43) % 76) / 100.0)

                    Ellipse()
                        .fill(Color.white.opacity(opacity * (index.isMultiple(of: 2) ? 1.0 : 0.68)))
                        .frame(width: w, height: h)
                        .blur(radius: 14)
                        .position(x: x, y: y)
                }
            }
        }
        .allowsHitTesting(false)
    }
}

private struct FinalStars: View {
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
                            Capsule().fill(Color.white.opacity(opacity * 0.72)).frame(width: 1, height: 9)
                            Capsule().fill(Color.white.opacity(opacity * 0.72)).frame(width: 9, height: 1)
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

private struct FinalMoon: View {
    var body: some View {
        GeometryReader { proxy in
            let s = min(proxy.size.width, proxy.size.height)

            ZStack {
                Circle()
                    .fill(Color.white.opacity(0.72))
                    .frame(width: s * 1.14, height: s * 1.14)
                    .blur(radius: s * 0.08)

                Ellipse()
                    .stroke(
                        LinearGradient(
                            colors: [
                                Color.white.opacity(0.98),
                                Color(red: 1.0, green: 0.67, blue: 0.87),
                                Color(red: 0.73, green: 0.57, blue: 1.0),
                                Color(red: 0.43, green: 0.89, blue: 1.0)
                            ],
                            startPoint: .leading,
                            endPoint: .trailing
                        ),
                        lineWidth: max(4, s * 0.042)
                    )
                    .frame(width: s * 1.28, height: s * 0.40)
                    .rotationEffect(.degrees(-15))
                    .shadow(color: .white.opacity(0.90), radius: 7)
                    .shadow(color: Color(red: 0.60, green: 0.42, blue: 1.0).opacity(0.34), radius: 11)

                Circle()
                    .fill(
                        RadialGradient(
                            colors: [
                                Color(red: 1.0, green: 0.99, blue: 0.94),
                                Color(red: 1.0, green: 0.91, blue: 0.82),
                                Color(red: 0.98, green: 0.73, blue: 0.79),
                                Color(red: 0.80, green: 0.60, blue: 0.94),
                                Color(red: 0.55, green: 0.53, blue: 0.90)
                            ],
                            center: UnitPoint(x: 0.26, y: 0.20),
                            startRadius: 0,
                            endRadius: s * 0.72
                        )
                    )
                    .frame(width: s * 0.83, height: s * 0.83)
                    .overlay {
                        FinalMoonTexture()
                            .padding(s * 0.085)
                            .clipShape(Circle())
                    }
                    .overlay {
                        RadialGradient(
                            colors: [Color.white.opacity(0.62), .clear],
                            center: UnitPoint(x: 0.25, y: 0.17),
                            startRadius: 0,
                            endRadius: s * 0.36
                        )
                        .frame(width: s * 0.83, height: s * 0.83)
                        .clipShape(Circle())
                    }
                    .overlay {
                        Circle()
                            .stroke(Color.white.opacity(0.82), lineWidth: 1.4)
                    }
                    .shadow(color: Color.white.opacity(0.94), radius: 5)
                    .shadow(color: Color(red: 0.68, green: 0.55, blue: 1.0).opacity(0.52), radius: 18)

                Ellipse()
                    .trim(from: 0.03, to: 0.48)
                    .stroke(
                        LinearGradient(
                            colors: [
                                Color(red: 1.0, green: 0.72, blue: 0.86),
                                Color(red: 0.76, green: 0.58, blue: 1.0),
                                Color(red: 0.44, green: 0.91, blue: 1.0)
                            ],
                            startPoint: .leading,
                            endPoint: .trailing
                        ),
                        style: StrokeStyle(lineWidth: max(5, s * 0.045), lineCap: .round)
                    )
                    .frame(width: s * 1.28, height: s * 0.40)
                    .rotationEffect(.degrees(-15))
                    .shadow(color: .white.opacity(0.90), radius: 5)
            }
            .frame(width: s, height: s)
        }
        .accessibilityHidden(true)
    }
}

private struct FinalMoonTexture: View {
    var body: some View {
        GeometryReader { proxy in
            let s = min(proxy.size.width, proxy.size.height)

            ZStack {
                ForEach(0..<27, id: \.self) { index in
                    let crater = s * CGFloat(0.045 + Double(index % 5) * 0.018)
                    let x = s * CGFloat(0.10 + Double((index * 31) % 80) / 100.0)
                    let y = s * CGFloat(0.09 + Double((index * 47) % 80) / 100.0)

                    Circle()
                        .fill(
                            RadialGradient(
                                colors: [
                                    Color(red: 0.39, green: 0.31, blue: 0.57).opacity(0.34),
                                    Color(red: 0.66, green: 0.48, blue: 0.68).opacity(0.18),
                                    Color.white.opacity(0.05)
                                ],
                                center: .bottomTrailing,
                                startRadius: 0,
                                endRadius: crater
                            )
                        )
                        .overlay {
                            Circle().stroke(Color.white.opacity(index.isMultiple(of: 3) ? 0.30 : 0.16), lineWidth: 0.8)
                        }
                        .frame(width: crater, height: crater)
                        .position(x: x, y: y)
                }

                ForEach(0..<7, id: \.self) { index in
                    Ellipse()
                        .stroke(Color.white.opacity(0.11), lineWidth: 1)
                        .frame(width: s * CGFloat(0.22 + Double(index % 3) * 0.05), height: s * 0.045)
                        .rotationEffect(.degrees(Double(index * 19 - 48)))
                        .position(
                            x: s * CGFloat(0.17 + Double((index * 23) % 66) / 100.0),
                            y: s * CGFloat(0.16 + Double((index * 39) % 66) / 100.0)
                        )
                }
            }
        }
    }
}

private struct FinalMiniCosmos: View {
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
            FinalStars(count: 20, opacity: 0.80)
        }
    }
}

private struct FinalSparkline: View {
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
                    .stroke(tint.opacity(0.94), style: StrokeStyle(lineWidth: 2.1, lineCap: .round, lineJoin: .round))

                    if let last = points.last {
                        Circle()
                            .fill(tint)
                            .frame(width: 7, height: 7)
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
