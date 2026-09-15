import SwiftUI

@main
struct GalacticTrustBusinessApp: App {
    @StateObject private var store = FinancialStore()

    var body: some Scene {
        WindowGroup {
            RootView()
                .environmentObject(store)
                .preferredColorScheme(.light)
        }
    }
}

struct RootView: View {
    @Environment(\.horizontalSizeClass) private var horizontalSizeClass
    @AppStorage(GalacticThemeOption.storageKey) private var selectedThemeID = GalacticThemeOption.defaultTheme.rawValue
    @AppStorage(GalacticLayoutStyle.storageKey) private var selectedLayoutID = GalacticLayoutStyle.defaultLayout.rawValue
    @State private var selection: AppTab = .dashboard

    var body: some View {
        Group {
            if selection.supportsCompactTab {
                compactShell
            } else if horizontalSizeClass == .regular {
                regularShell
            } else {
                compactShell
                    .onAppear { selection = .dashboard }
            }
        }
        .tint(GalacticTheme.indigo)
        .animation(.easeInOut(duration: 0.32), value: selectedThemeID)
        .animation(.snappy(duration: 0.24), value: selectedLayoutID)
    }

    private var regularShell: some View {
        HStack(spacing: 0) {
            GalacticSidebar(selection: $selection)
                .frame(width: 230)
            destination(for: selection)
                .frame(maxWidth: .infinity, maxHeight: .infinity)
        }
        .background(GalacticTheme.page)
    }

    private var compactShell: some View {
        ZStack(alignment: .bottom) {
            ZStack {
                GalacticTheme.page
                GalacticTheme.backgroundGlow

                RadialGradient(
                    colors: [GalacticTheme.palette.highlight.opacity(0.10), Color.clear],
                    center: .bottomLeading,
                    startRadius: 12,
                    endRadius: 360
                )
            }
            .ignoresSafeArea()

            compactDestination(for: selection)
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .padding(.bottom, 76)

            GalacticFloatingTabBar(selection: $selection)
                .frame(maxWidth: 620)
                .padding(.horizontal, 12)
                .padding(.bottom, 6)
        }
        .animation(.snappy(duration: 0.28), value: selection)
    }

    @ViewBuilder
    private func compactDestination(for tab: AppTab) -> some View {
        switch tab {
        case .dashboard:
            NavigationStack { FinalDashboardView(selection: $selection) }
        case .transactions:
            NavigationStack { TransactionsView() }
        case .cashFlow:
            NavigationStack { CashFlowView() }
        case .ai:
            NavigationStack { AIManagerView() }
        case .more:
            NavigationStack { MoreView() }
        default:
            NavigationStack { FinalDashboardView(selection: $selection) }
        }
    }

    @ViewBuilder
    private func destination(for tab: AppTab) -> some View {
        switch tab {
        case .dashboard:
            NavigationStack { FinalDashboardView(selection: $selection) }
        case .accounts:
            NavigationStack { BusinessModuleView(kind: .accounts) }
        case .transactions:
            NavigationStack { TransactionsView() }
        case .invoices:
            NavigationStack { InvoicesView() }
        case .expenses:
            NavigationStack { BusinessModuleView(kind: .expenses) }
        case .customers:
            NavigationStack { BusinessModuleView(kind: .customers) }
        case .vendors:
            NavigationStack { BusinessModuleView(kind: .vendors) }
        case .payroll:
            NavigationStack { BusinessModuleView(kind: .payroll) }
        case .cashFlow:
            NavigationStack { CashFlowView() }
        case .reports:
            NavigationStack { BusinessModuleView(kind: .reports) }
        case .budgets:
            NavigationStack { BusinessModuleView(kind: .budgets) }
        case .forecasting:
            NavigationStack { CashFlowView() }
        case .ai:
            NavigationStack { AIManagerView() }
        case .alerts:
            NavigationStack { BusinessModuleView(kind: .alerts) }
        case .settings, .more:
            NavigationStack { MoreView() }
        case .integrations:
            NavigationStack { ImportGuideView() }
        case .help:
            NavigationStack { BusinessModuleView(kind: .help) }
        }
    }
}

private struct GalacticFloatingTabBar: View {
    @Binding var selection: AppTab

    private struct TabItem: Identifiable {
        let tab: AppTab
        let title: String
        let icon: String

        var id: AppTab { tab }
    }

    private let tabs: [TabItem] = [
        TabItem(tab: .dashboard, title: "Home", icon: "house.fill"),
        TabItem(tab: .transactions, title: "Activity", icon: "list.bullet.rectangle.portrait.fill"),
        TabItem(tab: .cashFlow, title: "Cash Flow", icon: "chart.xyaxis.line"),
        TabItem(tab: .ai, title: "AI", icon: "sparkles"),
        TabItem(tab: .more, title: "More", icon: "ellipsis.circle.fill")
    ]

    var body: some View {
        HStack(spacing: 3) {
            ForEach(tabs) { item in
                let isSelected = selection == item.tab

                Button {
                    withAnimation(.snappy(duration: 0.24)) {
                        selection = item.tab
                    }
                } label: {
                    VStack(spacing: 3) {
                        Image(systemName: item.icon)
                            .font(.system(size: 17, weight: .semibold))
                            .symbolRenderingMode(.hierarchical)
                            .foregroundStyle(isSelected ? GalacticTheme.indigo : GalacticTheme.navy.opacity(0.72))
                            .symbolEffect(.bounce, value: isSelected)
                            .frame(height: 25)

                        Text(item.title)
                            .font(.system(size: 9.5, weight: isSelected ? .bold : .semibold, design: .rounded))
                            .foregroundStyle(isSelected ? GalacticTheme.indigo : GalacticTheme.navy.opacity(0.66))
                            .lineLimit(1)
                            .minimumScaleFactor(0.72)
                    }
                    .frame(maxWidth: .infinity)
                    .frame(height: 54)
                    .background {
                        if isSelected {
                            RoundedRectangle(cornerRadius: 17, style: .continuous)
                                .fill(
                                    LinearGradient(
                                        colors: [Color.white.opacity(0.94), GalacticTheme.violet.opacity(0.10)],
                                        startPoint: .topLeading,
                                        endPoint: .bottomTrailing
                                    )
                                )
                                .overlay {
                                    RoundedRectangle(cornerRadius: 17, style: .continuous)
                                        .stroke(Color.white.opacity(0.96), lineWidth: 1)
                                }
                                .shadow(color: GalacticTheme.violet.opacity(0.12), radius: 8, y: 4)
                        }
                    }
                    .contentShape(RoundedRectangle(cornerRadius: 17, style: .continuous))
                }
                .buttonStyle(.plain)
                .accessibilityLabel(item.title)
                .accessibilityAddTraits(isSelected ? .isSelected : [])
            }
        }
        .padding(5)
        .background {
            RoundedRectangle(cornerRadius: 25, style: .continuous)
                .fill(Color.white.opacity(0.83))
                .overlay {
                    LinearGradient(
                        colors: [Color.white.opacity(0.35), GalacticTheme.violet.opacity(0.045), GalacticTheme.cyan.opacity(0.045)],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    )
                    .clipShape(RoundedRectangle(cornerRadius: 25, style: .continuous))
                }
                .overlay {
                    RoundedRectangle(cornerRadius: 25, style: .continuous)
                        .stroke(Color.white.opacity(0.96), lineWidth: 1)
                }
                .shadow(color: GalacticTheme.violet.opacity(0.13), radius: 18, y: 8)
        }
    }
}

enum AppTab: Hashable {
    case dashboard
    case accounts
    case transactions
    case invoices
    case expenses
    case customers
    case vendors
    case payroll
    case cashFlow
    case reports
    case budgets
    case forecasting
    case ai
    case alerts
    case settings
    case integrations
    case help
    case more

    var supportsCompactTab: Bool {
        switch self {
        case .dashboard, .transactions, .cashFlow, .ai, .more:
            true
        default:
            false
        }
    }
}
