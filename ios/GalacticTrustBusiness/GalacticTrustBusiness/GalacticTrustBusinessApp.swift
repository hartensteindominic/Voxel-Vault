import SwiftUI

@main
struct GalacticTrustBusinessApp: App {
    @StateObject private var store = FinancialStore()
    @StateObject private var subscription = SubscriptionManager()

    var body: some Scene {
        WindowGroup {
            RootView()
                .environmentObject(store)
                .environmentObject(subscription)
                .preferredColorScheme(.light)
                .task {
                    // Used only by the GitHub simulator screenshot workflow. Normal installs
                    // still start with an empty $0 workspace.
                    if ProcessInfo.processInfo.arguments.contains("-AppStoreScreenshots") {
                        store.resetToDemo()
                    }
                }
        }
    }
}

struct RootView: View {
    @Environment(\.horizontalSizeClass) private var horizontalSizeClass
    @EnvironmentObject private var subscription: SubscriptionManager
    @State private var selection: AppTab
    @State private var compactPresentedTab: AppTab?

    init() {
        _selection = State(initialValue: Self.requestedLaunchTab())
    }

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
        .sheet(item: $compactPresentedTab) { tab in
            destination(for: tab)
        }
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
        .onChange(of: selection) { oldSelection, newSelection in
            guard horizontalSizeClass != .regular, !newSelection.supportsCompactTab else { return }
            compactPresentedTab = newSelection
            selection = oldSelection.supportsCompactTab ? oldSelection : .dashboard
        }
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
            if subscription.isPro {
                NavigationStack { BusinessModuleView(kind: .reports) }
            } else {
                NavigationStack {
                    ProFeatureGateScreen(
                        title: "Unlock advanced reports",
                        detail: "Galactic Pro adds six-month operating reports and deeper financial trend analysis.",
                        icon: "chart.bar.doc.horizontal.fill"
                    )
                }
            }
        case .budgets:
            NavigationStack { BusinessModuleView(kind: .budgets) }
        case .forecasting:
            NavigationStack { CashFlowView() }
        case .ai:
            NavigationStack { AIManagerView() }
        case .alerts:
            if subscription.isPro {
                NavigationStack { BusinessModuleView(kind: .alerts) }
            } else {
                NavigationStack {
                    ProFeatureGateScreen(
                        title: "Unlock advanced alerts",
                        detail: "Galactic Pro unlocks the full explainable alerts center for spending, revenue, recurring costs, and overdue invoices.",
                        icon: "bell.badge.fill"
                    )
                }
            }
        case .settings, .more:
            NavigationStack { MoreView() }
        case .integrations:
            NavigationStack { ImportGuideView() }
        case .help:
            NavigationStack { BusinessModuleView(kind: .help) }
        }
    }

    private static func requestedLaunchTab() -> AppTab {
        let arguments = ProcessInfo.processInfo.arguments
        guard let marker = arguments.firstIndex(of: "-ScreenshotTab"), arguments.indices.contains(marker + 1) else {
            return .dashboard
        }

        switch arguments[marker + 1].lowercased() {
        case "transactions": return .transactions
        case "cashflow", "cash-flow": return .cashFlow
        case "ai": return .ai
        case "more": return .more
        case "invoices": return .invoices
        case "reports": return .reports
        case "alerts": return .alerts
        default: return .dashboard
        }
    }
}

enum AppTab: Hashable, Identifiable {
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

    var id: String { String(describing: self) }

    var supportsCompactTab: Bool {
        switch self {
        case .dashboard, .transactions, .cashFlow, .ai, .more:
            true
        default:
            false
        }
    }
}
