import SwiftUI

struct MoreView: View {
    @EnvironmentObject private var store: FinancialStore

    var body: some View {
        List {
            Section {
                NavigationLink {
                    BusinessProfileView()
                } label: {
                    moreRow("Business profile", icon: "building.2.fill", tint: GalacticTheme.indigo)
                }

                NavigationLink {
                    InvoicesView()
                } label: {
                    moreRow("Invoices & receivables", icon: "doc.text.fill", tint: GalacticTheme.violet)
                }
            } header: {
                Text("Business")
            }

            Section {
                NavigationLink {
                    ThemeStudioView()
                } label: {
                    moreRow("Theme Studio", icon: "paintpalette.fill", tint: GalacticTheme.palette.highlight)
                }

                NavigationLink {
                    ImportGuideView()
                } label: {
                    moreRow("Import financial data", icon: "square.and.arrow.down.fill", tint: GalacticTheme.green)
                }

                NavigationLink {
                    SecurityPrivacyView()
                } label: {
                    moreRow("Security & privacy", icon: "lock.shield.fill", tint: GalacticTheme.cyan)
                }
            } header: {
                Text("Personalize & Data")
            }

            Section {
                NavigationLink {
                    AboutView()
                } label: {
                    moreRow("About Galactic Trust Business", icon: "sparkles", tint: GalacticTheme.pink)
                }
            } header: {
                Text("App")
            }
        }
        .scrollContentBackground(.hidden)
        .background {
            ZStack {
                GalacticTheme.page
                GalacticTheme.backgroundGlow
            }
        }
        .navigationTitle("More")
    }

    private func moreRow(_ title: String, icon: String, tint: Color) -> some View {
        Label {
            Text(title)
                .foregroundStyle(GalacticTheme.navy)
        } icon: {
            Image(systemName: icon)
                .foregroundStyle(.white)
                .frame(width: 30, height: 30)
                .background(tint.gradient)
                .clipShape(RoundedRectangle(cornerRadius: 9, style: .continuous))
        }
    }
}

struct ThemeStudioView: View {
    @AppStorage(GalacticThemeOption.storageKey) private var selectedThemeID = GalacticThemeOption.defaultTheme.rawValue
    @AppStorage(GalacticLayoutStyle.storageKey) private var selectedLayoutID = GalacticLayoutStyle.defaultLayout.rawValue

    private let themeColumns = [
        GridItem(.flexible(), spacing: 10),
        GridItem(.flexible(), spacing: 10)
    ]

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 22) {
                heroPreview
                layoutPicker

                VStack(alignment: .leading, spacing: 5) {
                    Text("20 Galactic color worlds")
                        .font(.title3.bold())
                        .foregroundStyle(GalacticTheme.navy)
                    Text("Tap any theme to recolor the app instantly. Your choice stays selected when you reopen the app.")
                        .font(.caption)
                        .foregroundStyle(GalacticTheme.mutedText)
                }

                LazyVGrid(columns: themeColumns, spacing: 10) {
                    ForEach(GalacticThemeOption.allCases) { option in
                        themeCard(option)
                    }
                }

                Label("Themes change appearance only. They never change financial data, calculations, privacy, or app permissions.", systemImage: "checkmark.shield.fill")
                    .font(.caption)
                    .foregroundStyle(GalacticTheme.mutedText)
                    .padding(14)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(GalacticTheme.glassGradient)
                    .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
                    .overlay {
                        RoundedRectangle(cornerRadius: 18, style: .continuous)
                            .stroke(GalacticTheme.cardBorderGradient, lineWidth: 1)
                    }
            }
            .padding(16)
            .padding(.bottom, 18)
        }
        .background {
            ZStack {
                GalacticTheme.page
                GalacticTheme.backgroundGlow
            }
            .ignoresSafeArea()
        }
        .navigationTitle("Theme Studio")
        .navigationBarTitleDisplayMode(.inline)
    }

    private var selectedTheme: GalacticThemeOption {
        GalacticThemeOption(rawValue: selectedThemeID) ?? GalacticThemeOption.defaultTheme
    }

    private var selectedLayout: GalacticLayoutStyle {
        GalacticLayoutStyle(rawValue: selectedLayoutID) ?? GalacticLayoutStyle.defaultLayout
    }

    private var heroPreview: some View {
        let palette = selectedTheme.palette

        return VStack(alignment: .leading, spacing: 14) {
            HStack {
                VStack(alignment: .leading, spacing: 3) {
                    Text("YOUR GALACTIC LOOK")
                        .font(.system(size: 9, weight: .bold))
                        .tracking(1.2)
                    Text(selectedTheme.name)
                        .font(.title2.bold())
                    Text("\(selectedLayout.name) • \(selectedTheme.subtitle)")
                        .font(.caption)
                }
                .foregroundStyle(selectedTheme.usesDarkHeroText ? palette.ink : Color.white)

                Spacer()
                miniMoon(palette: palette, size: 70)
            }

            HStack(spacing: 10) {
                previewPill("Balance", value: "$249K", palette: palette)
                previewPill("Net", value: "+$45K", palette: palette)
                previewPill("AI", value: "Ready", palette: palette)
            }
        }
        .padding(18)
        .background {
            ZStack {
                LinearGradient(
                    colors: [palette.heroStart, palette.heroMid, palette.heroEnd],
                    startPoint: .topLeading,
                    endPoint: .bottomTrailing
                )

                RadialGradient(
                    colors: [palette.highlight.opacity(0.42), Color.clear],
                    center: .topTrailing,
                    startRadius: 0,
                    endRadius: 180
                )

                LinearGradient(
                    colors: [Color.white.opacity(0.16), Color.clear, Color.white.opacity(0.08)],
                    startPoint: .topLeading,
                    endPoint: .bottomTrailing
                )
            }
        }
        .clipShape(RoundedRectangle(cornerRadius: selectedLayout.cardRadius + 4, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: selectedLayout.cardRadius + 4, style: .continuous)
                .stroke(Color.white.opacity(0.70), lineWidth: selectedLayout.strokeWidth)
        }
        .shadow(color: palette.primary.opacity(0.16), radius: selectedLayout.shadowRadius, y: 10)
    }

    private var layoutPicker: some View {
        VStack(alignment: .leading, spacing: 10) {
            VStack(alignment: .leading, spacing: 4) {
                Text("Choose your layout")
                    .font(.headline)
                    .foregroundStyle(GalacticTheme.navy)
                Text("Five shapes × twenty colors = 100 possible Galactic combinations.")
                    .font(.caption)
                    .foregroundStyle(GalacticTheme.mutedText)
            }

            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 10) {
                    ForEach(GalacticLayoutStyle.allCases) { layout in
                        Button {
                            withAnimation(.snappy(duration: 0.24)) {
                                selectedLayoutID = layout.rawValue
                            }
                        } label: {
                            VStack(alignment: .leading, spacing: 8) {
                                HStack {
                                    Image(systemName: layout.icon)
                                        .font(.headline)
                                    Spacer()
                                    if selectedLayoutID == layout.rawValue {
                                        Image(systemName: "checkmark.circle.fill")
                                    }
                                }
                                Text(layout.name)
                                    .font(.subheadline.bold())
                                Text(layout.subtitle)
                                    .font(.caption2)
                                    .foregroundStyle(GalacticTheme.mutedText)
                            }
                            .foregroundStyle(GalacticTheme.navy)
                            .frame(width: 128, height: 88, alignment: .leading)
                            .padding(12)
                            .background {
                                RoundedRectangle(cornerRadius: layout.cardRadius, style: .continuous)
                                    .fill(selectedLayoutID == layout.rawValue ? GalacticTheme.softPanel : Color.white.opacity(0.78))
                            }
                            .overlay {
                                RoundedRectangle(cornerRadius: layout.cardRadius, style: .continuous)
                                    .stroke(selectedLayoutID == layout.rawValue ? GalacticTheme.indigo : GalacticTheme.divider, lineWidth: selectedLayoutID == layout.rawValue ? 1.7 : 1)
                            }
                        }
                        .buttonStyle(.plain)
                    }
                }
                .padding(.vertical, 2)
            }
        }
    }

    private func themeCard(_ option: GalacticThemeOption) -> some View {
        let palette = option.palette
        let selected = selectedThemeID == option.rawValue

        return Button {
            withAnimation(.easeInOut(duration: 0.30)) {
                selectedThemeID = option.rawValue
            }
        } label: {
            VStack(alignment: .leading, spacing: 9) {
                ZStack(alignment: .bottomLeading) {
                    LinearGradient(
                        colors: [palette.heroStart, palette.heroMid, palette.heroEnd],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    )

                    RadialGradient(
                        colors: [palette.highlight.opacity(0.50), Color.clear],
                        center: .topTrailing,
                        startRadius: 0,
                        endRadius: 100
                    )

                    miniMoon(palette: palette, size: 48)
                        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topTrailing)
                        .padding(8)

                    HStack(spacing: 5) {
                        Circle().fill(palette.primary).frame(width: 8, height: 8)
                        Circle().fill(palette.secondary).frame(width: 8, height: 8)
                        Circle().fill(palette.tertiary).frame(width: 8, height: 8)
                        Circle().fill(palette.highlight).frame(width: 8, height: 8)
                    }
                    .padding(9)
                }
                .frame(height: 92)
                .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
                .overlay {
                    RoundedRectangle(cornerRadius: 16, style: .continuous)
                        .stroke(Color.white.opacity(0.70), lineWidth: 1)
                }

                HStack(alignment: .top, spacing: 6) {
                    VStack(alignment: .leading, spacing: 2) {
                        Text(option.name)
                            .font(.caption.bold())
                            .foregroundStyle(GalacticTheme.navy)
                        Text(option.subtitle)
                            .font(.system(size: 9.5, weight: .medium))
                            .foregroundStyle(GalacticTheme.mutedText)
                            .lineLimit(2)
                    }
                    Spacer(minLength: 2)
                    if selected {
                        Image(systemName: "checkmark.circle.fill")
                            .foregroundStyle(GalacticTheme.indigo)
                    }
                }
            }
            .padding(8)
            .background(Color.white.opacity(selected ? 0.94 : 0.70))
            .clipShape(RoundedRectangle(cornerRadius: 20, style: .continuous))
            .overlay {
                RoundedRectangle(cornerRadius: 20, style: .continuous)
                    .stroke(selected ? GalacticTheme.indigo : GalacticTheme.divider.opacity(0.85), lineWidth: selected ? 1.7 : 1)
            }
            .shadow(color: selected ? GalacticTheme.indigo.opacity(0.12) : .clear, radius: 12, y: 5)
        }
        .buttonStyle(.plain)
        .accessibilityLabel("\(option.name), \(option.subtitle)\(selected ? ", selected" : "")")
    }

    private func miniMoon(palette: GalacticPalette, size: CGFloat) -> some View {
        ZStack {
            Circle()
                .fill(
                    RadialGradient(
                        colors: [Color.white, palette.heroEnd, palette.secondary.opacity(0.88)],
                        center: .topLeading,
                        startRadius: 1,
                        endRadius: size * 0.78
                    )
                )
                .overlay {
                    Circle()
                        .stroke(Color.white.opacity(0.78), lineWidth: 1)
                }
                .shadow(color: palette.tertiary.opacity(0.42), radius: 10)

            Circle()
                .fill(palette.ink.opacity(0.10))
                .frame(width: size * 0.18, height: size * 0.18)
                .offset(x: -size * 0.16, y: -size * 0.08)

            Circle()
                .fill(Color.white.opacity(0.24))
                .frame(width: size * 0.13, height: size * 0.13)
                .offset(x: size * 0.15, y: size * 0.13)

            Ellipse()
                .stroke(
                    LinearGradient(colors: [palette.highlight, palette.tertiary], startPoint: .leading, endPoint: .trailing),
                    lineWidth: max(2, size * 0.045)
                )
                .frame(width: size * 1.14, height: size * 0.38)
                .rotationEffect(.degrees(-13))
        }
        .frame(width: size, height: size)
    }

    private func previewPill(_ title: String, value: String, palette: GalacticPalette) -> some View {
        VStack(alignment: .leading, spacing: 1) {
            Text(title)
                .font(.system(size: 8, weight: .semibold))
            Text(value)
                .font(.caption.bold())
        }
        .foregroundStyle(selectedTheme.usesDarkHeroText ? palette.ink : Color.white)
        .padding(.horizontal, 10)
        .padding(.vertical, 7)
        .background(Color.white.opacity(selectedTheme.usesDarkHeroText ? 0.48 : 0.14))
        .clipShape(Capsule())
        .overlay {
            Capsule().stroke(Color.white.opacity(0.46), lineWidth: 0.8)
        }
    }
}

struct BusinessProfileView: View {
    @EnvironmentObject private var store: FinancialStore
    @State private var name = ""
    @State private var saved = false

    var body: some View {
        Form {
            Section("Business identity") {
                TextField("Business name", text: $name)
                LabeledContent("Currency", value: store.profile.currencyCode)
            }

            Section {
                Button("Save business name") {
                    store.updateProfile(name: name)
                    saved = true
                }
                .disabled(name.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
            }

            Section("How it is used") {
                Text("Your business name appears on the dashboard and stays in the protected app data file on this device.")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
        }
        .navigationTitle("Business Profile")
        .navigationBarTitleDisplayMode(.inline)
        .onAppear { name = store.profile.name }
        .alert("Saved", isPresented: $saved) {
            Button("OK", role: .cancel) { }
        } message: {
            Text("Your business profile was updated.")
        }
    }
}

struct InvoicesView: View {
    @EnvironmentObject private var store: FinancialStore

    var body: some View {
        List {
            Section {
                HStack {
                    VStack(alignment: .leading, spacing: 3) {
                        Text("Outstanding")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                        Text(store.currency(store.outstandingInvoices))
                            .font(.title2.bold())
                            .foregroundStyle(GalacticTheme.navy)
                    }
                    Spacer()
                    VStack(alignment: .trailing, spacing: 3) {
                        Text("Overdue")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                        Text(store.currency(store.overdueInvoices.reduce(0) { $0 + $1.amount }))
                            .font(.title3.bold())
                            .foregroundStyle(GalacticTheme.pink)
                    }
                }
                .padding(.vertical, 8)
            }

            Section("Receivables") {
                if store.invoices.isEmpty {
                    ContentUnavailableView("No invoices", systemImage: "doc.text")
                } else {
                    ForEach(store.invoices) { invoice in
                        HStack {
                            VStack(alignment: .leading, spacing: 4) {
                                Text(invoice.client)
                                    .font(.subheadline.bold())
                                Text("\(invoice.invoiceNumber) • due \(invoice.dueDate.formatted(date: .abbreviated, time: .omitted))")
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                            }
                            Spacer()
                            VStack(alignment: .trailing, spacing: 4) {
                                Text(store.currency(invoice.amount))
                                    .font(.subheadline.bold())
                                Text(invoice.status.rawValue)
                                    .font(.caption2.bold())
                                    .foregroundStyle(statusColor(invoice.status))
                            }
                        }
                        .padding(.vertical, 3)
                    }
                }
            }

            Section {
                Label("Invoice monitoring is read-only in this first App Store build. It does not send invoices, debit customers, or initiate payments.", systemImage: "info.circle.fill")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
        }
        .navigationTitle("Invoices")
        .navigationBarTitleDisplayMode(.inline)
    }

    private func statusColor(_ status: BusinessInvoice.Status) -> Color {
        switch status {
        case .paid: GalacticTheme.green
        case .sent: GalacticTheme.indigo
        case .overdue: GalacticTheme.pink
        case .draft: .secondary
        }
    }
}

struct ImportGuideView: View {
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                guideCard(
                    number: "1",
                    title: "Export CSV from your bank or bookkeeping tool",
                    text: "The importer recognizes common Date, Description/Merchant, Amount, Debit, Credit, Type, and Category columns."
                )
                guideCard(
                    number: "2",
                    title: "Open Transactions → Import",
                    text: "Tap the download icon in the Transactions screen and choose the CSV file from Files."
                )
                guideCard(
                    number: "3",
                    title: "Review AI categories and insights",
                    text: "Imported rows are classified locally using transaction descriptions. Review your records before using any forecast for a business decision."
                )

                Label("CSV data is copied into this app’s protected local storage. This build does not upload imported financial records to a Galactic server.", systemImage: "lock.shield.fill")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .padding(14)
                    .background(GalacticTheme.indigo.opacity(0.06))
                    .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
            }
            .padding(16)
        }
        .background(GalacticTheme.page.ignoresSafeArea())
        .navigationTitle("Import Data")
        .navigationBarTitleDisplayMode(.inline)
    }

    private func guideCard(number: String, title: String, text: String) -> some View {
        GalacticCard {
            HStack(alignment: .top, spacing: 14) {
                Text(number)
                    .font(.headline.bold())
                    .foregroundStyle(.white)
                    .frame(width: 36, height: 36)
                    .background(GalacticTheme.heroGradient)
                    .clipShape(Circle())
                VStack(alignment: .leading, spacing: 5) {
                    Text(title)
                        .font(.headline)
                        .foregroundStyle(GalacticTheme.navy)
                    Text(text)
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }
            }
        }
    }
}

struct SecurityPrivacyView: View {
    @EnvironmentObject private var store: FinancialStore
    @State private var confirmingClear = false

    var body: some View {
        List {
            Section("Data protection") {
                privacyRow("Protected local file", detail: "Financial records are stored in the app container with iOS complete file protection.", icon: "lock.fill")
                privacyRow("Read-only intelligence", detail: "The AI manager analyzes and explains records. It cannot send money or approve payments.", icon: "sparkles")
                privacyRow("No ad tracking", detail: "This native build includes no advertising SDK or cross-app tracking.", icon: "hand.raised.fill")
            }

            Section("Your data") {
                Button("Clear local financial data", role: .destructive) {
                    confirmingClear = true
                }
                Text("This removes transactions, invoices, and the opening balance stored by this app. Your business display name stays in place.")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }

            Section("Important") {
                Text("Galactic Trust Business is financial-management software, not a bank, accountant, tax preparer, lender, or investment adviser. Its forecasts and AI summaries are planning aids and can be incomplete if your imported data is incomplete.")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
        }
        .navigationTitle("Security & Privacy")
        .navigationBarTitleDisplayMode(.inline)
        .alert("Clear local financial data?", isPresented: $confirmingClear) {
            Button("Cancel", role: .cancel) { }
            Button("Clear Data", role: .destructive) {
                store.clearFinancialData()
            }
        } message: {
            Text("This cannot be undone. Imported and manually entered financial records will be removed from this device.")
        }
    }

    private func privacyRow(_ title: String, detail: String, icon: String) -> some View {
        HStack(alignment: .top, spacing: 12) {
            Image(systemName: icon)
                .foregroundStyle(GalacticTheme.indigo)
                .frame(width: 30)
            VStack(alignment: .leading, spacing: 3) {
                Text(title).font(.subheadline.bold())
                Text(detail).font(.caption).foregroundStyle(.secondary)
            }
        }
        .padding(.vertical, 4)
    }
}

struct AboutView: View {
    @EnvironmentObject private var store: FinancialStore
    @State private var confirmingReset = false

    var body: some View {
        List {
            Section {
                VStack(spacing: 12) {
                    Image(systemName: "sparkles")
                        .font(.system(size: 34, weight: .bold))
                        .foregroundStyle(.white)
                        .frame(width: 76, height: 76)
                        .background(GalacticTheme.heroGradient)
                        .clipShape(RoundedRectangle(cornerRadius: 22, style: .continuous))
                    Text("Galactic Trust Business")
                        .font(.title3.bold())
                    Text("AI-powered business financial monitoring")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, 12)
            }

            Section("Version") {
                LabeledContent("App", value: "1.0.0")
                LabeledContent("Data mode", value: "Local")
            }

            Section("Demo") {
                Button("Restore sample business data", role: .destructive) {
                    confirmingReset = true
                }
            }
        }
        .navigationTitle("About")
        .navigationBarTitleDisplayMode(.inline)
        .alert("Restore sample data?", isPresented: $confirmingReset) {
            Button("Cancel", role: .cancel) { }
            Button("Restore", role: .destructive) { store.resetToDemo() }
        } message: {
            Text("This replaces your current local workspace with the bundled sample data.")
        }
    }
}
