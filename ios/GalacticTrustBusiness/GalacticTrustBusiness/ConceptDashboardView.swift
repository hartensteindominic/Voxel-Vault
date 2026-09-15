import SwiftUI

struct ConceptDashboardView: View {
    @EnvironmentObject private var store: FinancialStore
    @Binding var selection: AppTab

    @State private var searchText = ""
    @State private var showingInvoices = false

    private let navy = Color(red: 0.025, green: 0.055, blue: 0.27)
    private let blue = Color(red: 0.20, green: 0.32, blue: 0.98)
    private let cyan = Color(red: 0.02, green: 0.83, blue: 0.82)
    private let violet = Color(red: 0.58, green: 0.25, blue: 0.98)
    private let pink = Color(red: 1.00, green: 0.20, blue: 0.49)
    private let green = Color(red: 0.03, green: 0.76, blue: 0.37)

    var body: some View {
        ScrollView(showsIndicators: false) {
            VStack(spacing: 8) {
                header
                searchRow
                cashHero
                quickActions
                metricGrid
                aiBrief
            }
            .frame(maxWidth: 470)
            .padding(.horizontal, 12)
            .padding(.top, 6)
            .padding(.bottom, 8)
            .frame(maxWidth: .infinity)
        }
        .background {
            ConceptPastelPageBackground()
                .ignoresSafeArea()
        }
        .toolbar(.hidden, for: .navigationBar)
        .sheet(isPresented: $showingInvoices) {
            NavigationStack { InvoicesView() }
                .environmentObject(store)
        }
    }

    private var header: some View {
        HStack(alignment: .top, spacing: 8) {
            VStack(alignment: .leading, spacing: 3) {
                Text("GALACTIC TRUST • BUSINESS")
                    .font(.system(size: 9.5, weight: .bold))
                    .tracking(2.0)
                    .foregroundStyle(blue)

                Text("Welcome back,\n\(store.profile.name)")
                    .font(.system(size: 29, weight: .bold, design: .rounded))
                    .foregroundStyle(navy)
                    .lineSpacing(-2)
                    .minimumScaleFactor(0.74)
                    .fixedSize(horizontal: false, vertical: true)

                Text("Your business money, made clear.")
                    .font(.system(size: 14, weight: .medium, design: .rounded))
                    .foregroundStyle(navy.opacity(0.58))
            }
            .frame(maxWidth: .infinity, alignment: .leading)

            GalacticBrandMark(size: 47)
                .padding(.top, 12)
        }
        .padding(.horizontal, 2)
    }

    private var searchRow: some View {
        HStack(spacing: 9) {
            HStack(spacing: 10) {
                Image(systemName: "magnifyingglass")
                    .font(.system(size: 17, weight: .medium))
                    .foregroundStyle(navy.opacity(0.68))

                TextField("Search transactions...", text: $searchText)
                    .font(.system(size: 14.5, weight: .medium, design: .rounded))
                    .foregroundStyle(navy)
                    .textInputAutocapitalization(.never)
                    .submitLabel(.search)
                    .onSubmit { selection = .transactions }
            }
            .padding(.horizontal, 17)
            .frame(maxWidth: .infinity)
            .frame(height: 48)
            .background(ConceptGlassBackground(cornerRadius: 25))

            Button { selection = .cashFlow } label: {
                Image(systemName: "calendar")
                    .font(.system(size: 15, weight: .bold))
                    .foregroundStyle(navy.opacity(0.72))
                    .frame(width: 48, height: 48)
                    .background(ConceptGlassBackground(cornerRadius: 24))
            }
            .buttonStyle(.plain)

            Button { selection = .transactions } label: {
                Image(systemName: "line.3.horizontal.decrease")
                    .font(.system(size: 16, weight: .bold))
                    .foregroundStyle(navy.opacity(0.72))
                    .frame(width: 48, height: 48)
                    .background(ConceptGlassBackground(cornerRadius: 24))
            }
            .buttonStyle(.plain)
        }
    }

    private var cashHero: some View {
        Button { selection = .cashFlow } label: {
            ZStack {
                ConceptPastelHeroBackground()

                GeometryReader { geo in
                    Image("ApprovedMoon")
                        .resizable()
                        .scaledToFit()
                        .frame(width: min(geo.size.width * 0.54, 206), height: min(geo.size.width * 0.54, 206))
                        .shadow(color: Color.white.opacity(0.82), radius: 8)
                        .shadow(color: violet.opacity(0.22), radius: 18)
                        .position(x: geo.size.width * 0.82, y: geo.size.height * 0.58)

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
                        .frame(width: 48, height: 48)
                        .overlay { Circle().stroke(Color.white.opacity(0.82), lineWidth: 1.1) }
                        .overlay {
                            Image(systemName: "arrow.up.right")
                                .font(.system(size: 22, weight: .semibold))
                                .foregroundStyle(.white)
                        }
                        .shadow(color: Color.white.opacity(0.74), radius: 6)
                        .shadow(color: violet.opacity(0.30), radius: 15)
                        .position(x: geo.size.width * 0.91, y: geo.size.height * 0.82)
                }

                VStack(alignment: .leading, spacing: 0) {
                    HStack {
                        Text("RECORDED CASH")
                            .font(.system(size: 9.5, weight: .bold))
                            .tracking(2.15)
                            .foregroundStyle(navy.opacity(0.80))

                        Spacer()

                        Label("PRIVATE", systemImage: "checkmark.shield.fill")
                            .font(.system(size: 9.5, weight: .bold))
                            .foregroundStyle(blue)
                    }

                    Text(store.currency(store.balance))
                        .font(.system(size: 36, weight: .bold, design: .rounded))
                        .foregroundStyle(navy)
                        .lineLimit(1)
                        .minimumScaleFactor(0.60)
                        .padding(.top, 9)

                    Text("Your current balance from recorded activity")
                        .font(.system(size: 11.5, weight: .medium, design: .rounded))
                        .foregroundStyle(navy.opacity(0.64))
                        .padding(.top, 3)

                    Spacer()

                    HStack(spacing: 22) {
                        heroAmount(title: "Money in", value: "+\(store.currency(store.currentMonthIncome))", color: green)

                        Rectangle()
                            .fill(Color.white.opacity(0.76))
                            .frame(width: 1, height: 36)

                        heroAmount(title: "Money out", value: "−\(store.currency(store.currentMonthExpenses))", color: pink)

                        Spacer(minLength: 0)
                    }
                }
                .padding(17)
            }
            .frame(height: 202)
            .clipShape(RoundedRectangle(cornerRadius: 26, style: .continuous))
            .overlay {
                RoundedRectangle(cornerRadius: 26, style: .continuous)
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
                .font(.system(size: 14.5, weight: .bold, design: .rounded))
                .foregroundStyle(color)
                .lineLimit(1)
                .minimumScaleFactor(0.68)
            Text(title)
                .font(.system(size: 10.5, weight: .medium, design: .rounded))
                .foregroundStyle(navy.opacity(0.68))
        }
    }

    private var quickActions: some View {
        HStack(spacing: 7) {
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
            VStack(spacing: 6) {
                Image(systemName: icon)
                    .font(.system(size: 18, weight: .bold))
                    .foregroundStyle(.white)
                    .frame(width: 40, height: 40)
                    .background {
                        Circle()
                            .fill(LinearGradient(colors: colors, startPoint: .topLeading, endPoint: .bottomTrailing))
                            .overlay { Circle().stroke(Color.white.opacity(0.36), lineWidth: 0.8) }
                            .shadow(color: colors.first?.opacity(0.34) ?? .clear, radius: 9, y: 4)
                    }

                Text(title)
                    .font(.system(size: 10.5, weight: .bold, design: .rounded))
                    .foregroundStyle(navy)
                    .lineLimit(1)
                    .minimumScaleFactor(0.68)
            }
            .frame(maxWidth: .infinity)
            .frame(height: 76)
            .background(ConceptGlassBackground(cornerRadius: 21))
        }
        .buttonStyle(.plain)
    }

    private var metricGrid: some View {
        LazyVGrid(
            columns: [GridItem(.flexible(), spacing: 7), GridItem(.flexible(), spacing: 7)],
            spacing: 7
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
            ConceptGlassBackground(cornerRadius: 19)

            ConceptSparkline(values: values, tint: tint)
                .frame(width: 96, height: 25)
                .padding(.trailing, 9)
                .padding(.bottom, 7)
                .opacity(0.94)

            HStack(alignment: .top, spacing: 9) {
                Image(systemName: icon)
                    .font(.system(size: 16, weight: .bold))
                    .foregroundStyle(.white)
                    .frame(width: 36, height: 36)
                    .background {
                        RoundedRectangle(cornerRadius: 12, style: .continuous)
                            .fill(
                                LinearGradient(
                                    colors: [tint.opacity(0.70), tint],
                                    startPoint: .topLeading,
                                    endPoint: .bottomTrailing
                                )
                            )
                            .overlay {
                                RoundedRectangle(cornerRadius: 12, style: .continuous)
                                    .stroke(Color.white.opacity(0.28), lineWidth: 0.8)
                            }
                            .shadow(color: tint.opacity(0.28), radius: 7, y: 4)
                    }

                VStack(alignment: .leading, spacing: 2) {
                    Text(title)
                        .font(.system(size: 10.5, weight: .medium, design: .rounded))
                        .foregroundStyle(navy.opacity(0.68))

                    Text(value)
                        .font(.system(size: 15.5, weight: .bold, design: .rounded))
                        .foregroundStyle(navy)
                        .lineLimit(1)
                        .minimumScaleFactor(0.64)

                    Spacer(minLength: 0)

                    Text(status)
                        .font(.system(size: 10.5, weight: .bold, design: .rounded))
                        .foregroundStyle(positive ? green : pink)
                        .lineLimit(1)
                }

                Spacer(minLength: 0)
            }
            .padding(10)
        }
        .frame(height: 84)
    }

    private var aiBrief: some View {
        Button { selection = .ai } label: {
            HStack(spacing: 7) {
                VStack(alignment: .leading, spacing: 4) {
                    HStack(spacing: 6) {
                        Image(systemName: "sparkles")
                            .font(.system(size: 12, weight: .semibold))
                            .foregroundStyle(violet)
                        Text("GALACTIC AI BRIEF")
                            .font(.system(size: 9.5, weight: .bold))
                            .tracking(1.85)
                            .foregroundStyle(blue)
                    }

                    Text(store.insights.first?.title ?? "Your financial brief is ready")
                        .font(.system(size: 15, weight: .bold, design: .rounded))
                        .foregroundStyle(navy)
                        .multilineTextAlignment(.leading)
                        .lineLimit(1)
                        .minimumScaleFactor(0.74)

                    HStack(spacing: 6) {
                        Text("Review the numbers")
                        Image(systemName: "arrow.right")
                    }
                    .font(.system(size: 11.5, weight: .semibold, design: .rounded))
                    .foregroundStyle(blue)
                }
                .frame(maxWidth: .infinity, alignment: .leading)

                GalacticRobot()
                    .frame(width: 72, height: 72)
            }
            .padding(.leading, 14)
            .padding(.trailing, 7)
            .frame(height: 84)
            .background {
                ZStack {
                    RoundedRectangle(cornerRadius: 20, style: .continuous)
                        .fill(Color.white.opacity(0.72))
                    ConceptMiniCosmos()
                        .clipShape(RoundedRectangle(cornerRadius: 20, style: .continuous))
                }
            }
            .overlay {
                RoundedRectangle(cornerRadius: 20, style: .continuous)
                    .stroke(Color.white.opacity(0.94), lineWidth: 1.2)
            }
            .shadow(color: violet.opacity(0.12), radius: 13, y: 6)
        }
        .buttonStyle(.plain)
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
        let previousNet = (previousPoint?.income ?? 0) - (previousPoint?.expense ?? 0)
        return percentChange(current: store.currentMonthNet, previous: previousNet)
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

private struct ConceptGlassBackground: View {
    let cornerRadius: CGFloat

    var body: some View {
        RoundedRectangle(cornerRadius: cornerRadius, style: .continuous)
            .fill(Color.white.opacity(0.79))
            .overlay {
                RoundedRectangle(cornerRadius: cornerRadius, style: .continuous)
                    .fill(
                        LinearGradient(
                            colors: [
                                Color.white.opacity(0.55),
                                Color(red: 1.0, green: 0.93, blue: 0.97).opacity(0.10),
                                Color(red: 0.92, green: 0.94, blue: 1.0).opacity(0.17)
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

private struct ConceptPastelPageBackground: View {
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
                    colors: [Color(red: 1.0, green: 0.78, blue: 0.54).opacity(0.24), Color.clear],
                    center: UnitPoint(x: 0.68, y: 0.20),
                    startRadius: 0,
                    endRadius: proxy.size.width * 0.72
                )

                RadialGradient(
                    colors: [Color(red: 1.0, green: 0.62, blue: 0.76).opacity(0.26), Color.clear],
                    center: UnitPoint(x: 0.92, y: 0.34),
                    startRadius: 0,
                    endRadius: proxy.size.width * 0.82
                )

                RadialGradient(
                    colors: [Color(red: 0.63, green: 0.55, blue: 1.0).opacity(0.20), Color.clear],
                    center: UnitPoint(x: 0.18, y: 0.80),
                    startRadius: 0,
                    endRadius: proxy.size.width * 0.88
                )

                RadialGradient(
                    colors: [Color(red: 0.46, green: 0.78, blue: 1.0).opacity(0.17), Color.clear],
                    center: .bottomTrailing,
                    startRadius: 0,
                    endRadius: proxy.size.width * 0.90
                )

                ConceptNebulaClouds(opacity: 0.18)
                ConceptStars(count: 46, opacity: 0.74)
            }
        }
    }
}

private struct ConceptPastelHeroBackground: View {
    var body: some View {
        ZStack {
            LinearGradient(
                colors: [
                    Color(red: 1.0, green: 0.93, blue: 0.76),
                    Color(red: 1.0, green: 0.78, blue: 0.84),
                    Color(red: 0.86, green: 0.68, blue: 1.0),
                    Color(red: 0.56, green: 0.87, blue: 1.0)
                ],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )

            RadialGradient(
                colors: [Color.white.opacity(0.78), Color.clear],
                center: UnitPoint(x: 0.12, y: 0.20),
                startRadius: 0,
                endRadius: 165
            )

            RadialGradient(
                colors: [Color(red: 1.0, green: 0.47, blue: 0.83).opacity(0.32), Color.clear],
                center: UnitPoint(x: 0.52, y: 0.82),
                startRadius: 0,
                endRadius: 185
            )

            RadialGradient(
                colors: [Color(red: 0.39, green: 0.61, blue: 1.0).opacity(0.27), Color.clear],
                center: .topTrailing,
                startRadius: 0,
                endRadius: 180
            )

            ConceptNebulaClouds(opacity: 0.26)
            ConceptStars(count: 32, opacity: 0.86)
        }
    }
}

private struct ConceptNebulaClouds: View {
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

private struct ConceptMiniCosmos: View {
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
            ConceptStars(count: 20, opacity: 0.80)
        }
    }
}

private struct ConceptStars: View {
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
                            Capsule()
                                .fill(Color.white.opacity(opacity * 0.72))
                                .frame(width: 1, height: 9)
                            Capsule()
                                .fill(Color.white.opacity(opacity * 0.72))
                                .frame(width: 9, height: 1)
                        }
                        .shadow(color: Color.white.opacity(opacity), radius: 4)
                        .position(x: proxy.size.width * x, y: proxy.size.height * y)
                    }
                }
            }
        }
        .allowsHitTesting(false)
    }
}

private struct ConceptSparkline: View {
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
