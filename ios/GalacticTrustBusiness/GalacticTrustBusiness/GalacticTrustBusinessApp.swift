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
    @State private var selection: AppTab = .dashboard

    var body: some View {
        Group {
            if horizontalSizeClass == .regular {
                HStack(spacing: 0) {
                    GalacticSidebar(selection: $selection)
                        .frame(width: 230)
                    destination(for: selection)
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                }
                .background(GalacticTheme.page)
            } else {
                compactTabs
                    .onAppear {
                        if !selection.supportsCompactTab {
                            selection = .dashboard
                        }
                    }
            }
        }
        .tint(GalacticTheme.indigo)
    }

    private var compactTabs: some View {
        TabView(selection: $selection) {
            NavigationStack { DashboardView(selection: $selection) }
                .tabItem { Label("Home", systemImage: "house.fill") }
                .tag(AppTab.dashboard)

            NavigationStack { TransactionsView() }
                .tabItem { Label("Transactions", systemImage: "list.bullet.rectangle.portrait.fill") }
                .tag(AppTab.transactions)

            NavigationStack { CashFlowView() }
                .tabItem { Label("Cash Flow", systemImage: "chart.xyaxis.line") }
                .tag(AppTab.cashFlow)

            NavigationStack { AIManagerView() }
                .tabItem { Label("AI", systemImage: "sparkles") }
                .tag(AppTab.ai)

            NavigationStack { MoreView() }
                .tabItem { Label("More", systemImage: "ellipsis.circle.fill") }
                .tag(AppTab.more)
        }
        .tint(GalacticTheme.indigo)
    }

    @ViewBuilder
    private func destination(for tab: AppTab) -> some View {
        switch tab {
        case .dashboard:
            NavigationStack { DashboardView(selection: $selection) }
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
