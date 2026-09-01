import SwiftUI

@main
struct GalacticTrustBusinessApp: App {
    @StateObject private var store = FinancialStore()
    @StateObject private var subscription = SubscriptionManager()

    var body: some Scene {
        WindowGroup {
            Group {
                if store.requiresStorageRecovery {
                    StorageRecoveryView()
                } else {
                    RootView()
                }
            }
            .environmentObject(store)
            .environmentObject(subscription)
            .preferredColorScheme(.light)
            .task {
                // Used only by the GitHub simulator screenshot workflow. Normal installs
                // still start with an empty $0 workspace.
                if !store.requiresStorageRecovery && ProcessInfo.processInfo.arguments.contains("-AppStoreScreenshots") {
                    store.resetToDemo()
                }
            }
            .alert("Local Data Not Saved", isPresented: Binding(
                get: { store.storageNotice != nil && !store.requiresStorageRecovery },
                set: { if !$0 { store.dismissStorageNotice() } }
            )) {
                Button("OK") { store.dismissStorageNotice() }
            } message: {
                Text(store.storageNotice ?? "The local financial workspace could not be saved.")
            }
        }
    }
}

private struct StorageRecoveryView: View {
    @EnvironmentObject private var store: FinancialStore
    @State private var confirmingReset = false

    var body: some View {
        ZStack {
            GalacticTheme.page.ignoresSafeArea()

            ScrollView {
                VStack(spacing: 18) {
                    Image(systemName: "externaldrive.badge.exclamationmark")
                        .font(.system(size: 34, weight: .bold))
                        .foregroundStyle(.white)
                        .frame(width: 76, height: 76)
                        .background(GalacticTheme.heroGradient)
                        .clipShape(RoundedRectangle(cornerRadius: 22, style: .continuous))

                    Text("Your saved workspace needs attention")
                        .font(.title2.bold())
                        .foregroundStyle(GalacticTheme.navy)
                        .multilineTextAlignment(.center)

                    Text(store.storageNotice ?? "The saved local financial workspace could not be opened.")
                        .font(.subheadline)
                        .foregroundStyle(GalacticTheme.mutedText)
                        .multilineTextAlignment(.center)

                    GalacticCard {
                        VStack(alignment: .leading, spacing: 10) {
                            Label("Your unreadable file has not been overwritten", systemImage: "lock.shield.fill")
                                .font(.headline)
                                .foregroundStyle(GalacticTheme.navy)
                            Text("To prevent silent data loss, the app will not accept financial changes until you explicitly reset the local workspace. Resetting permanently replaces the unreadable local file with a new empty workspace.")
                                .font(.subheadline)
                                .foregroundStyle(GalacticTheme.mutedText)
                        }
                    }

                    Button("Reset Local Workspace", role: .destructive) {
                        confirmingReset = true
                    }
                    .font(.headline.bold())
                    .padding(.horizontal, 18)
                    .padding(.vertical, 12)
                    .background(GalacticTheme.pink.opacity(0.10))
                    .clipShape(Capsule())

                    Link("Open Support", destination: URL(string: "https://voxelvault.io/business/support")!)
                        .font(.subheadline.weight(.semibold))
                }
                .frame(maxWidth: 560)
                .padding(24)
            }
        }
        .alert("Reset local workspace?", isPresented: $confirmingReset) {
            Button("Cancel", role: .cancel) { }
            Button("Reset", role: .destructive) {
                store.resetUnreadableWorkspace()
            }
        } message: {
            Text("This permanently replaces the unreadable local financial file with a new empty workspace. This cannot be undone in the app.")
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
