import SwiftUI

struct FirstRunGuideView: View {
    @EnvironmentObject private var store: FinancialStore
    @Binding var selection: AppTab
    let finish: () -> Void

    @State private var confirmingSampleData = false

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 18) {
                    hero

                    VStack(alignment: .leading, spacing: 10) {
                        Text("Set up in under a minute")
                            .font(.title3.bold())
                            .foregroundStyle(GalacticTheme.navy)
                        Text("Start with your real records, or explore the app safely with clearly labeled sample data.")
                            .font(.subheadline)
                            .foregroundStyle(GalacticTheme.mutedText)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)

                    Button {
                        selection = .transactions
                        finish()
                    } label: {
                        setupCard(
                            title: "Add or import transactions",
                            detail: "Enter income or expenses manually, or import a dated CSV from Files.",
                            icon: "square.and.arrow.down.fill",
                            tint: GalacticTheme.indigo,
                            badge: "Recommended"
                        )
                    }
                    .buttonStyle(.plain)

                    NavigationLink {
                        StartingCashView()
                    } label: {
                        setupCard(
                            title: "Set starting cash",
                            detail: "Record cash your business already had without counting it as revenue.",
                            icon: "banknote.fill",
                            tint: GalacticTheme.green,
                            badge: nil
                        )
                    }
                    .buttonStyle(.plain)

                    Button {
                        confirmingSampleData = true
                    } label: {
                        setupCard(
                            title: "Explore sample business data",
                            detail: "Load a bundled demo workspace so you can see charts, invoices, and AI insights immediately.",
                            icon: "sparkles",
                            tint: GalacticTheme.violet,
                            badge: "Sample only"
                        )
                    }
                    .buttonStyle(.plain)

                    trustCard

                    Button("Continue with an empty workspace") {
                        finish()
                    }
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(GalacticTheme.indigo)
                    .padding(.vertical, 8)
                }
                .frame(maxWidth: 620)
                .padding(20)
                .padding(.bottom, 24)
                .frame(maxWidth: .infinity)
            }
            .background(GalacticTheme.page.ignoresSafeArea())
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Not Now") { finish() }
                }
            }
        }
        .alert("Load sample business data?", isPresented: $confirmingSampleData) {
            Button("Cancel", role: .cancel) { }
            Button("Load Sample") {
                store.resetToDemo()
                finish()
            }
        } message: {
            Text("Your workspace is currently empty. This loads bundled example records for exploration; it does not connect to a bank or create real financial activity.")
        }
    }

    private var hero: some View {
        ZStack(alignment: .leading) {
            GalacticTheme.spaceGradient
            GalacticPlanetScene()
                .opacity(0.78)

            LinearGradient(
                colors: [GalacticTheme.navy.opacity(0.88), GalacticTheme.navy.opacity(0.28), .clear],
                startPoint: .leading,
                endPoint: .trailing
            )

            VStack(alignment: .leading, spacing: 10) {
                GalacticBrandMark(size: 52)

                Text("Welcome to\nGalactic Trust Business")
                    .font(.system(size: 28, weight: .bold, design: .rounded))
                    .foregroundStyle(.white)
                    .lineLimit(2)
                    .fixedSize(horizontal: false, vertical: true)
                    .frame(maxWidth: .infinity, alignment: .leading)

                Text("Know what came in, what went out, and what needs attention—without giving AI permission to move your money.")
                    .font(.subheadline.weight(.medium))
                    .foregroundStyle(.white.opacity(0.84))
                    .frame(maxWidth: 410, alignment: .leading)
            }
            .padding(24)
        }
        .frame(minHeight: 250)
        .clipShape(RoundedRectangle(cornerRadius: 28, style: .continuous))
        .shadow(color: GalacticTheme.indigo.opacity(0.18), radius: 18, y: 8)
    }

    private func setupCard(title: String, detail: String, icon: String, tint: Color, badge: String?) -> some View {
        GalacticCard {
            HStack(spacing: 14) {
                Image(systemName: icon)
                    .font(.headline.bold())
                    .foregroundStyle(.white)
                    .frame(width: 48, height: 48)
                    .background(tint.gradient)
                    .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))

                VStack(alignment: .leading, spacing: 5) {
                    HStack(spacing: 7) {
                        Text(title)
                            .font(.headline.bold())
                            .foregroundStyle(GalacticTheme.navy)
                        if let badge {
                            Text(badge.uppercased())
                                .font(.system(size: 8, weight: .bold))
                                .foregroundStyle(tint)
                                .padding(.horizontal, 7)
                                .padding(.vertical, 4)
                                .background(tint.opacity(0.10))
                                .clipShape(Capsule())
                        }
                    }
                    Text(detail)
                        .font(.subheadline)
                        .foregroundStyle(GalacticTheme.mutedText)
                        .multilineTextAlignment(.leading)
                }

                Spacer(minLength: 4)
                Image(systemName: "chevron.right")
                    .font(.caption.bold())
                    .foregroundStyle(GalacticTheme.mutedText)
            }
        }
    }

    private var trustCard: some View {
        VStack(alignment: .leading, spacing: 10) {
            Label("Private by design", systemImage: "lock.shield.fill")
                .font(.headline.bold())
                .foregroundStyle(GalacticTheme.navy)
            Text("Your version 1.0 business records stay in protected local app storage. The financial manager is read-only: it cannot send payments, transfer funds, trade, lend, or change a bank account.")
                .font(.caption.weight(.medium))
                .foregroundStyle(GalacticTheme.mutedText)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(16)
        .background(GalacticTheme.green.opacity(0.07))
        .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
    }
}
