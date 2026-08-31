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
                Text("Data")
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
        .background(GalacticTheme.page)
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
