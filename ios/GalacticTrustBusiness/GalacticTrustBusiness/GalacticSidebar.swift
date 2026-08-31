import SwiftUI

struct GalacticSidebar: View {
    @Binding var selection: AppTab

    var body: some View {
        ZStack {
            GalacticTheme.sidebarGradient
                .ignoresSafeArea()

            Circle()
                .fill(GalacticTheme.indigo.opacity(0.20))
                .frame(width: 260, height: 260)
                .blur(radius: 35)
                .offset(x: -85, y: 360)

            ScrollView(showsIndicators: false) {
                VStack(alignment: .leading, spacing: 20) {
                    brand
                    SidebarButton(title: "Dashboard", icon: "house.fill", tab: .dashboard, selection: $selection)

                    SidebarGroup(title: "MANAGE") {
                        SidebarButton(title: "Accounts", icon: "creditcard.fill", tab: .accounts, selection: $selection)
                        SidebarButton(title: "Transactions", icon: "list.bullet.rectangle.fill", tab: .transactions, selection: $selection)
                        SidebarButton(title: "Invoices", icon: "doc.text.fill", tab: .invoices, selection: $selection)
                        SidebarButton(title: "Expenses", icon: "receipt.fill", tab: .expenses, selection: $selection)
                        SidebarButton(title: "Customers", icon: "person.2.fill", tab: .customers, selection: $selection)
                        SidebarButton(title: "Vendors", icon: "building.2.fill", tab: .vendors, selection: $selection)
                        SidebarButton(title: "Payroll", icon: "banknote.fill", tab: .payroll, selection: $selection)
                    }

                    SidebarGroup(title: "ANALYTICS") {
                        SidebarButton(title: "Cash Flow", icon: "chart.line.uptrend.xyaxis", tab: .cashFlow, selection: $selection)
                        SidebarButton(title: "Reports", icon: "chart.bar.doc.horizontal.fill", tab: .reports, selection: $selection)
                        SidebarButton(title: "Budgets", icon: "chart.pie.fill", tab: .budgets, selection: $selection)
                        SidebarButton(title: "Forecasting", icon: "waveform.path.ecg.rectangle.fill", tab: .forecasting, selection: $selection)
                    }

                    SidebarGroup(title: "AI & INSIGHTS") {
                        SidebarButton(title: "AI Assistant", icon: "sparkles", tab: .ai, selection: $selection)
                        SidebarButton(title: "Alerts & Insights", icon: "bell.badge.fill", tab: .alerts, selection: $selection)
                    }

                    Divider().overlay(Color.white.opacity(0.14))

                    VStack(spacing: 4) {
                        SidebarButton(title: "Settings", icon: "gearshape.fill", tab: .settings, selection: $selection)
                        SidebarButton(title: "Integrations", icon: "point.3.connected.trianglepath.dotted", tab: .integrations, selection: $selection)
                        SidebarButton(title: "Help Center", icon: "questionmark.circle.fill", tab: .help, selection: $selection)
                    }

                    planCard
                }
                .padding(16)
                .padding(.bottom, 18)
            }
        }
        .foregroundStyle(.white)
    }

    private var brand: some View {
        HStack(spacing: 10) {
            GalacticBrandMark(size: 46)
            VStack(alignment: .leading, spacing: 0) {
                Text("Galactic")
                    .font(.title3.bold())
                Text("Trust")
                    .font(.title3.bold())
                Text("Business")
                    .font(.caption)
                    .foregroundStyle(Color(red: 0.63, green: 0.68, blue: 1.0))
            }
        }
        .padding(.horizontal, 4)
        .padding(.top, 6)
    }

    private var planCard: some View {
        ZStack(alignment: .bottomTrailing) {
            RoundedRectangle(cornerRadius: 20, style: .continuous)
                .fill(
                    LinearGradient(
                        colors: [GalacticTheme.indigo.opacity(0.62), GalacticTheme.violet.opacity(0.48)],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    )
                )
                .overlay {
                    RoundedRectangle(cornerRadius: 20, style: .continuous)
                        .stroke(Color.white.opacity(0.13), lineWidth: 1)
                }

            GalacticRobot()
                .frame(width: 86, height: 86)
                .offset(x: 8, y: 8)

            VStack(alignment: .leading, spacing: 7) {
                Text("Your Business Plan")
                    .font(.caption2)
                    .foregroundStyle(.white.opacity(0.68))
                Text("Growth Plan")
                    .font(.subheadline.bold())
                Text("Renews monthly")
                    .font(.caption2)
                    .foregroundStyle(.white.opacity(0.68))

                Button {
                    selection = .settings
                } label: {
                    Text("Manage Plan")
                        .font(.caption.bold())
                        .foregroundStyle(.white)
                        .padding(.horizontal, 13)
                        .padding(.vertical, 8)
                        .background(Color.white.opacity(0.14))
                        .clipShape(Capsule())
                }
                .buttonStyle(.plain)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(15)
        }
        .frame(height: 150)
    }
}

private struct SidebarGroup<Content: View>: View {
    let title: String
    let content: Content

    init(title: String, @ViewBuilder content: () -> Content) {
        self.title = title
        self.content = content()
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(title)
                .font(.system(size: 10, weight: .semibold))
                .tracking(0.7)
                .foregroundStyle(.white.opacity(0.42))
                .padding(.horizontal, 10)
            content
        }
    }
}

private struct SidebarButton: View {
    let title: String
    let icon: String
    let tab: AppTab
    @Binding var selection: AppTab

    var body: some View {
        Button {
            selection = tab
        } label: {
            HStack(spacing: 12) {
                Image(systemName: icon)
                    .font(.system(size: 14, weight: .semibold))
                    .frame(width: 20)
                Text(title)
                    .font(.subheadline.weight(selection == tab ? .semibold : .medium))
                Spacer(minLength: 0)
            }
            .foregroundStyle(selection == tab ? .white : .white.opacity(0.82))
            .padding(.horizontal, 12)
            .frame(height: 40)
            .background {
                if selection == tab {
                    LinearGradient(
                        colors: [GalacticTheme.indigo, GalacticTheme.deepBlue],
                        startPoint: .leading,
                        endPoint: .trailing
                    )
                    .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                    .shadow(color: GalacticTheme.indigo.opacity(0.45), radius: 10)
                }
            }
        }
        .buttonStyle(.plain)
    }
}
