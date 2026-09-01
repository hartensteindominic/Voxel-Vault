import SwiftUI
import StoreKit
import Combine

@MainActor
final class SubscriptionManager: ObservableObject {
    static let monthlyProductID = "com.hartensteindominic.galactictrustbusiness.pro.monthly"
    static let yearlyProductID = "com.hartensteindominic.galactictrustbusiness.pro.yearly"

    static let productIDs: [String] = [
        monthlyProductID,
        yearlyProductID
    ]

    @Published private(set) var products: [Product] = []
    @Published private(set) var purchasedProductIDs: Set<String> = []
    @Published private(set) var isLoading = false
    @Published var errorMessage: String?

    private var updatesTask: Task<Void, Never>?

    var isPro: Bool {
        !purchasedProductIDs.isDisjoint(with: Set(Self.productIDs))
    }

    init() {
        updatesTask = observeTransactions()
        Task { await refresh() }
    }

    deinit {
        updatesTask?.cancel()
    }

    func refresh() async {
        isLoading = true
        defer { isLoading = false }

        // Entitlements can be available from StoreKit even when the storefront cannot
        // currently return product metadata. Refresh them independently so an existing
        // subscriber is not incorrectly treated as free during a temporary outage.
        await refreshEntitlements()

        do {
            let loaded = try await Product.products(for: Self.productIDs)
            products = loaded.sorted { lhs, rhs in
                productSortIndex(lhs.id) < productSortIndex(rhs.id)
            }
            errorMessage = nil
        } catch {
            errorMessage = "Subscriptions could not be loaded right now. Your existing Pro access will remain available if Apple can verify the entitlement."
        }
    }

    func purchase(_ product: Product) async {
        do {
            let result = try await product.purchase()
            switch result {
            case .success(let verification):
                let transaction = try verified(verification)
                await transaction.finish()
                await refreshEntitlements()
                errorMessage = nil
            case .userCancelled:
                break
            case .pending:
                errorMessage = "Your purchase is pending Apple approval or payment confirmation."
            @unknown default:
                errorMessage = "The purchase could not be completed."
            }
        } catch {
            errorMessage = "The purchase could not be completed. Please try again."
        }
    }

    func restorePurchases() async {
        do {
            try await AppStore.sync()
            await refreshEntitlements()
            if !isPro {
                errorMessage = "No active Galactic Pro subscription was found for this Apple Account."
            } else {
                errorMessage = nil
            }
        } catch {
            errorMessage = "Purchases could not be restored right now. Please try again."
        }
    }

    func refreshEntitlements() async {
        var active: Set<String> = []
        let now = Date()

        for await result in Transaction.currentEntitlements {
            guard let transaction = try? verified(result) else { continue }
            guard transaction.revocationDate == nil else { continue }
            if let expirationDate = transaction.expirationDate, expirationDate <= now { continue }
            guard Self.productIDs.contains(transaction.productID) else { continue }
            active.insert(transaction.productID)
        }

        purchasedProductIDs = active
    }

    private func observeTransactions() -> Task<Void, Never> {
        Task { [weak self] in
            for await result in Transaction.updates {
                guard let self else { return }
                guard let transaction = try? self.verified(result) else { continue }
                await transaction.finish()
                await self.refreshEntitlements()
            }
        }
    }

    private func productSortIndex(_ id: String) -> Int {
        switch id {
        case Self.monthlyProductID: return 0
        case Self.yearlyProductID: return 1
        default: return 2
        }
    }

    private func verified<T>(_ result: VerificationResult<T>) throws -> T {
        switch result {
        case .verified(let safe):
            return safe
        case .unverified:
            throw SubscriptionVerificationError.failed
        }
    }
}

private enum SubscriptionVerificationError: Error {
    case failed
}

struct GalacticProPaywallView: View {
    @EnvironmentObject private var subscription: SubscriptionManager
    @Environment(\.dismiss) private var dismiss
    @State private var purchasingProductID: String?

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 18) {
                    hero
                    benefits
                    plans
                    purchaseStatus
                    legal
                }
                .padding(18)
                .padding(.bottom, 28)
            }
            .background(GalacticTheme.page.ignoresSafeArea())
            .navigationTitle("Galactic Pro")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Done") { dismiss() }
                }
            }
            .task {
                await subscription.refresh()
            }
            .onChange(of: subscription.isPro) { _, isPro in
                if isPro { dismiss() }
            }
        }
    }

    private var hero: some View {
        ZStack {
            GalacticTheme.spaceGradient
            GalacticPlanetScene()
                .opacity(0.70)

            VStack(spacing: 10) {
                Image(systemName: "sparkles")
                    .font(.system(size: 28, weight: .bold))
                    .foregroundStyle(.white)
                    .frame(width: 62, height: 62)
                    .background(GalacticTheme.violet.opacity(0.75))
                    .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))

                Text("Galactic Trust Business Pro")
                    .font(.title2.bold())
                    .foregroundStyle(.white)
                    .multilineTextAlignment(.center)

                Text("Turn your business records into deeper forecasts, alerts, and unlimited AI financial analysis.")
                    .font(.subheadline.weight(.medium))
                    .foregroundStyle(.white.opacity(0.82))
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, 12)
            }
            .padding(24)
        }
        .frame(minHeight: 240)
        .clipShape(RoundedRectangle(cornerRadius: 26, style: .continuous))
    }

    private var benefits: some View {
        GalacticCard {
            VStack(alignment: .leading, spacing: 14) {
                Text("Pro includes")
                    .font(.headline.bold())
                    .foregroundStyle(GalacticTheme.navy)

                benefit("Unlimited AI Financial Manager questions", icon: "bubble.left.and.text.bubble.right.fill")
                benefit("30-day cash-flow forecast and runway analysis", icon: "chart.line.uptrend.xyaxis")
                benefit("Advanced alerts and explainable financial insights", icon: "bell.badge.fill")
                benefit("Six-month reports and deeper business trends", icon: "chart.bar.doc.horizontal.fill")
            }
        }
    }

    @ViewBuilder
    private var plans: some View {
        VStack(spacing: 10) {
            if subscription.isLoading && subscription.products.isEmpty {
                ProgressView("Loading subscription options…")
                    .frame(maxWidth: .infinity)
                    .padding(24)
            } else if subscription.products.isEmpty {
                GalacticCard {
                    VStack(spacing: 8) {
                        Text("Subscription products are unavailable")
                            .font(.headline)
                            .foregroundStyle(GalacticTheme.navy)
                        Text("Apple is not returning the Galactic Pro purchase options right now. Check your connection and try again. Existing verified Pro access is not removed by this screen.")
                            .font(.subheadline)
                            .foregroundStyle(GalacticTheme.mutedText)
                            .multilineTextAlignment(.center)

                        Button("Try Again") {
                            Task { await subscription.refresh() }
                        }
                        .font(.subheadline.bold())
                        .foregroundStyle(GalacticTheme.indigo)
                    }
                }
            } else {
                ForEach(subscription.products) { product in
                    Button {
                        Task {
                            purchasingProductID = product.id
                            await subscription.purchase(product)
                            purchasingProductID = nil
                        }
                    } label: {
                        HStack(spacing: 14) {
                            VStack(alignment: .leading, spacing: 4) {
                                Text(planTitle(product))
                                    .font(.headline.bold())
                                    .foregroundStyle(GalacticTheme.navy)
                                Text(product.description)
                                    .font(.caption)
                                    .foregroundStyle(GalacticTheme.mutedText)
                                    .multilineTextAlignment(.leading)
                            }
                            Spacer()
                            if purchasingProductID == product.id {
                                ProgressView()
                            } else {
                                VStack(alignment: .trailing, spacing: 2) {
                                    Text(product.displayPrice)
                                        .font(.title3.bold())
                                        .foregroundStyle(GalacticTheme.indigo)
                                    Text(periodLabel(product))
                                        .font(.caption2.weight(.semibold))
                                        .foregroundStyle(GalacticTheme.mutedText)
                                }
                            }
                        }
                        .padding(16)
                        .background(Color.white)
                        .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
                        .overlay {
                            RoundedRectangle(cornerRadius: 18, style: .continuous)
                                .stroke(product.id == SubscriptionManager.yearlyProductID ? GalacticTheme.violet.opacity(0.45) : GalacticTheme.divider, lineWidth: product.id == SubscriptionManager.yearlyProductID ? 2 : 1)
                        }
                    }
                    .buttonStyle(.plain)
                    .disabled(purchasingProductID != nil)
                }
            }

            Button("Restore Purchases") {
                Task { await subscription.restorePurchases() }
            }
            .font(.subheadline.weight(.semibold))
            .padding(.top, 4)
        }
    }

    @ViewBuilder
    private var purchaseStatus: some View {
        if subscription.isPro {
            Label("Galactic Pro is active on this Apple Account.", systemImage: "checkmark.seal.fill")
                .font(.subheadline.bold())
                .foregroundStyle(GalacticTheme.green)
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(14)
                .background(GalacticTheme.green.opacity(0.08))
                .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
        } else if let error = subscription.errorMessage {
            Text(error)
                .font(.caption)
                .foregroundStyle(GalacticTheme.pink)
                .frame(maxWidth: .infinity, alignment: .leading)
        }
    }

    private var legal: some View {
        VStack(spacing: 8) {
            Text("Payment is charged to your Apple Account at confirmation. Subscriptions renew automatically unless canceled at least 24 hours before the end of the current period. You can manage or cancel subscriptions in your Apple Account settings.")
                .font(.caption2)
                .foregroundStyle(GalacticTheme.mutedText)
                .multilineTextAlignment(.center)

            HStack(spacing: 14) {
                Link("Terms of Use", destination: URL(string: "https://www.apple.com/legal/internet-services/itunes/dev/stdeula/")!)
                Link("Privacy Policy", destination: URL(string: "https://voxelvault.io/business/privacy")!)
            }
            .font(.caption.weight(.semibold))
        }
    }

    private func benefit(_ text: String, icon: String) -> some View {
        HStack(alignment: .top, spacing: 11) {
            Image(systemName: icon)
                .font(.subheadline.bold())
                .foregroundStyle(GalacticTheme.indigo)
                .frame(width: 28)
            Text(text)
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(GalacticTheme.navy)
            Spacer(minLength: 0)
        }
    }

    private func planTitle(_ product: Product) -> String {
        product.id == SubscriptionManager.yearlyProductID ? "Annual Pro" : "Monthly Pro"
    }

    private func periodLabel(_ product: Product) -> String {
        guard let period = product.subscription?.subscriptionPeriod else { return "" }
        switch period.unit {
        case .day: return period.value == 1 ? "per day" : "every \(period.value) days"
        case .week: return period.value == 1 ? "per week" : "every \(period.value) weeks"
        case .month: return period.value == 1 ? "per month" : "every \(period.value) months"
        case .year: return period.value == 1 ? "per year" : "every \(period.value) years"
        @unknown default: return "subscription"
        }
    }
}

struct ProLockedCard: View {
    let title: String
    let detail: String
    let buttonTitle: String
    let action: () -> Void

    var body: some View {
        GalacticCard {
            VStack(spacing: 12) {
                Image(systemName: "lock.fill")
                    .font(.title2.bold())
                    .foregroundStyle(GalacticTheme.violet)
                    .frame(width: 48, height: 48)
                    .background(GalacticTheme.violet.opacity(0.10))
                    .clipShape(RoundedRectangle(cornerRadius: 15, style: .continuous))
                Text(title)
                    .font(.headline.bold())
                    .foregroundStyle(GalacticTheme.navy)
                    .multilineTextAlignment(.center)
                Text(detail)
                    .font(.subheadline)
                    .foregroundStyle(GalacticTheme.mutedText)
                    .multilineTextAlignment(.center)
                Button(buttonTitle, action: action)
                    .font(.subheadline.bold())
                    .foregroundStyle(.white)
                    .padding(.horizontal, 18)
                    .padding(.vertical, 11)
                    .background(GalacticTheme.heroGradient)
                    .clipShape(Capsule())
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 6)
        }
    }
}
