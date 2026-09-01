import SwiftUI

struct ProFeatureGateScreen: View {
    @EnvironmentObject private var subscription: SubscriptionManager
    let title: String
    let detail: String
    let icon: String

    @State private var showingPro = false

    var body: some View {
        ScrollView {
            VStack(spacing: 18) {
                Image(systemName: icon)
                    .font(.system(size: 32, weight: .bold))
                    .foregroundStyle(.white)
                    .frame(width: 72, height: 72)
                    .background(GalacticTheme.heroGradient)
                    .clipShape(RoundedRectangle(cornerRadius: 22, style: .continuous))

                Text(title)
                    .font(.title2.bold())
                    .foregroundStyle(GalacticTheme.navy)
                    .multilineTextAlignment(.center)

                Text(detail)
                    .font(.subheadline.weight(.medium))
                    .foregroundStyle(GalacticTheme.mutedText)
                    .multilineTextAlignment(.center)

                Button("Unlock Galactic Pro") {
                    showingPro = true
                }
                .font(.headline.bold())
                .foregroundStyle(.white)
                .padding(.horizontal, 20)
                .padding(.vertical, 13)
                .background(GalacticTheme.heroGradient)
                .clipShape(Capsule())
            }
            .frame(maxWidth: 520)
            .padding(28)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(GalacticTheme.page.ignoresSafeArea())
        .navigationTitle("Galactic Pro")
        .navigationBarTitleDisplayMode(.inline)
        .sheet(isPresented: $showingPro) {
            GalacticProPaywallView()
                .environmentObject(subscription)
        }
    }
}
