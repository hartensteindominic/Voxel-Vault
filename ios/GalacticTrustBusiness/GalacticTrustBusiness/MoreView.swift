import SwiftUI

struct MoreView: View {
    @EnvironmentObject private var store: FinancialStore
    @EnvironmentObject private var subscription: SubscriptionManager
    @State private var showingPro = false

    var body: some View {
        List {
            Section {
                Button {
                    showingPro = true
                } label: {
                    HStack(spacing: 12) {
                        Image(systemName: subscription.isPro ? "checkmark.seal.fill" : "sparkles")
                            .foregroundStyle(.white)
                            .frame(width: 34, height: 34)
                            .background(GalacticTheme.heroGradient)
                            .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
                        VStack(alignment: .leading, spacing: 2) {
                            Text(subscription.isPro ? "Galactic Pro active" : "Upgrade to Galactic Pro")
                                .font(.subheadline.bold())
                                .foregroundStyle(GalacticTheme.navy)
                            Text(subscription.isPro ? "Your premium finance tools are unlocked" : "Unlimited AI, forecasts, reports, and alerts")
                                .font(.caption)
                                .foregroundStyle(GalacticTheme.mutedText)
                        }
                        Spacer()
                        Image(systemName: "chevron.right")
                            .font(.caption.bold())
                            .foregroundStyle(GalacticTheme.mutedText)
                    }
                }
                .buttonStyle(.plain)

                if subscription.isPro {
                    Link(destination: URL(string: "https://apps.apple.com/account/subscriptions")!) {
                        Label("Manage Apple subscription", systemImage: "creditcard.fill")
                    }
                }
            } header: {
                Text("Subscription")
            }

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
        .sheet(isPresented: $showingPro) {
            GalacticProPaywallView()
                .environmentObject(subscription)
        }
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
    @State private var showingAddInvoice = false

    var body: some View {
        List {
            Section {
                HStack {
                    VStack(alignment: .leading, spacing: 3) {
                        Text("Outstanding")
                            .font(.caption.weight(.medium))
                            .foregroundStyle(GalacticTheme.mutedText)
                        Text(store.currency(store.outstandingInvoices))
                            .font(.title2.bold())
                            .foregroundStyle(GalacticTheme.navy)
                    }
                    Spacer()
                    VStack(alignment: .trailing, spacing: 3) {
                        Text("Overdue")
                            .font(.caption.weight(.medium))
                            .foregroundStyle(GalacticTheme.mutedText)
                        Text(store.currency(store.overdueInvoices.reduce(0) { $0 + $1.amount }))
                            .font(.title3.bold())
                            .foregroundStyle(GalacticTheme.pink)
                    }
                }
                .padding(.vertical, 8)
            }

            Section("Receivables") {
                if store.invoices.isEmpty {
                    ContentUnavailableView(
                        "No invoices yet",
                        systemImage: "doc.text",
                        description: Text("Add an invoice to monitor what customers owe and when payment is due.")
                    )
                } else {
                    ForEach(store.invoices) { invoice in
                        HStack(spacing: 12) {
                            VStack(alignment: .leading, spacing: 4) {
                                Text(invoice.client)
                                    .font(.subheadline.bold())
                                    .foregroundStyle(GalacticTheme.navy)
                                Text("\(invoice.invoiceNumber) • due \(invoice.dueDate.formatted(date: .abbreviated, time: .omitted))")
                                    .font(.caption)
                                    .foregroundStyle(GalacticTheme.mutedText)
                            }

                            Spacer(minLength: 8)

                            VStack(alignment: .trailing, spacing: 5) {
                                Text(store.currency(invoice.amount))
                                    .font(.subheadline.bold())
                                    .foregroundStyle(GalacticTheme.navy)

                                Menu {
                                    ForEach(BusinessInvoice.Status.allCases, id: \.self) { status in
                                        Button {
                                            store.updateInvoiceStatus(id: invoice.id, status: status)
                                        } label: {
                                            if status == invoice.status {
                                                Label(status.rawValue, systemImage: "checkmark")
                                            } else {
                                                Text(status.rawValue)
                                            }
                                        }
                                    }
                                } label: {
                                    HStack(spacing: 4) {
                                        Text(invoice.status.rawValue)
                                        Image(systemName: "chevron.down")
                                            .font(.system(size: 8, weight: .bold))
                                    }
                                    .font(.caption2.bold())
                                    .foregroundStyle(statusColor(invoice.status))
                                }
                            }
                        }
                        .padding(.vertical, 4)
                        .swipeActions(edge: .trailing) {
                            Button(role: .destructive) {
                                store.deleteInvoice(id: invoice.id)
                            } label: {
                                Label("Delete", systemImage: "trash")
                            }
                        }
                    }
                }
            }

            Section {
                Label("Invoice monitoring is read-only. Adding or updating an invoice here does not send it, debit a customer, or initiate payment.", systemImage: "info.circle.fill")
                    .font(.caption.weight(.medium))
                    .foregroundStyle(GalacticTheme.mutedText)
            }
        }
        .navigationTitle("Invoices")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button {
                    showingAddInvoice = true
                } label: {
                    Image(systemName: "plus")
                }
                .accessibilityLabel("Add invoice")
            }
        }
        .sheet(isPresented: $showingAddInvoice) {
            AddInvoiceView()
                .environmentObject(store)
        }
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

struct AddInvoiceView: View {
    @EnvironmentObject private var store: FinancialStore
    @Environment(\.dismiss) private var dismiss

    @State private var client = ""
    @State private var invoiceNumber = ""
    @State private var amountText = ""
    @State private var dueDate = Calendar.current.date(byAdding: .day, value: 30, to: Date()) ?? Date()
    @State private var status: BusinessInvoice.Status = .sent

    private var amount: Double? {
        Double(
            amountText
                .replacingOccurrences(of: ",", with: "")
                .replacingOccurrences(of: "$", with: "")
                .trimmingCharacters(in: .whitespacesAndNewlines)
        )
    }

    private var canSave: Bool {
        !client.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty &&
        !invoiceNumber.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty &&
        (amount ?? 0) > 0
    }

    var body: some View {
        NavigationStack {
            Form {
                Section("Invoice") {
                    TextField("Customer or client", text: $client)
                    TextField("Invoice number", text: $invoiceNumber)
                        .textInputAutocapitalization(.characters)
                    TextField("Amount", text: $amountText)
                        .keyboardType(.decimalPad)
                    DatePicker("Due date", selection: $dueDate, displayedComponents: .date)
                    Picker("Status", selection: $status) {
                        ForEach(BusinessInvoice.Status.allCases, id: \.self) { status in
                            Text(status.rawValue).tag(status)
                        }
                    }
                }

                Section {
                    Label("This creates a local tracking record only. Galactic Trust Business does not send the invoice or collect payment.", systemImage: "lock.shield.fill")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }
            .navigationTitle("Add Invoice")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") {
                        guard let amount else { return }
                        store.addInvoice(BusinessInvoice(
                            client: client.trimmingCharacters(in: .whitespacesAndNewlines),
                            invoiceNumber: invoiceNumber.trimmingCharacters(in: .whitespacesAndNewlines),
                            amount: amount,
                            dueDate: dueDate,
                            status: status
                        ))
                        dismiss()
                    }
                    .disabled(!canSave)
                }
            }
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

            Section("Policies & support") {
                Link(destination: URL(string: "https://voxelvault.io/business/privacy")!) {
                    Label("Privacy Policy", systemImage: "doc.text.fill")
                }
                Link(destination: URL(string: "https://voxelvault.io/business/support")!) {
                    Label("Support", systemImage: "questionmark.circle.fill")
                }
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
