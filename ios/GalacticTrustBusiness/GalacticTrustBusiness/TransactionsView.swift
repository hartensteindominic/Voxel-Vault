import SwiftUI
import UniformTypeIdentifiers

struct TransactionsView: View {
    @EnvironmentObject private var store: FinancialStore
    @State private var searchText = ""
    @State private var filter: TransactionKind?
    @State private var showingAdd = false
    @State private var showingImporter = false
    @State private var importMessage: String?

    private var filtered: [BusinessTransaction] {
        store.transactions.filter { item in
            let matchesKind = filter == nil || item.kind == filter
            let term = searchText.trimmingCharacters(in: .whitespacesAndNewlines)
            let matchesSearch = term.isEmpty || item.merchant.localizedCaseInsensitiveContains(term) || item.memo.localizedCaseInsensitiveContains(term) || item.category.rawValue.localizedCaseInsensitiveContains(term)
            return matchesKind && matchesSearch
        }
    }

    var body: some View {
        List {
            Section {
                Picker("Type", selection: Binding(
                    get: { filter?.rawValue ?? "All" },
                    set: { filter = TransactionKind(rawValue: $0) }
                )) {
                    Text("All").tag("All")
                    Text("Income").tag(TransactionKind.income.rawValue)
                    Text("Expense").tag(TransactionKind.expense.rawValue)
                }
                .pickerStyle(.segmented)
                .listRowBackground(Color.clear)
            }

            Section {
                if filtered.isEmpty {
                    ContentUnavailableView.search(text: searchText)
                } else {
                    ForEach(filtered) { item in
                        transactionRow(item)
                    }
                    .onDelete { offsets in
                        store.deleteTransactions(at: offsets, from: filtered)
                    }
                }
            } header: {
                HStack {
                    Text("\(filtered.count) transactions")
                    Spacer()
                    Text("Swipe left to delete")
                }
            }
        }
        .scrollContentBackground(.hidden)
        .background(GalacticTheme.page)
        .navigationTitle("Transactions")
        .searchable(text: $searchText, prompt: "Merchant, memo, category")
        .toolbar {
            ToolbarItemGroup(placement: .topBarTrailing) {
                Button {
                    showingImporter = true
                } label: {
                    Image(systemName: "square.and.arrow.down")
                }
                .accessibilityLabel("Import CSV")

                Button {
                    showingAdd = true
                } label: {
                    Image(systemName: "plus")
                }
                .accessibilityLabel("Add transaction")
            }
        }
        .sheet(isPresented: $showingAdd) {
            AddTransactionView(defaultKind: .expense)
        }
        .fileImporter(
            isPresented: $showingImporter,
            allowedContentTypes: [.commaSeparatedText, .plainText],
            allowsMultipleSelection: false
        ) { result in
            importCSV(result)
        }
        .alert("CSV Import", isPresented: Binding(
            get: { importMessage != nil },
            set: { if !$0 { importMessage = nil } }
        )) {
            Button("OK") { importMessage = nil }
        } message: {
            Text(importMessage ?? "")
        }
    }

    private func transactionRow(_ item: BusinessTransaction) -> some View {
        HStack(spacing: 12) {
            Image(systemName: item.kind == .income ? "arrow.down.left" : "arrow.up.right")
                .font(.caption.bold())
                .foregroundStyle(item.kind == .income ? GalacticTheme.green : GalacticTheme.indigo)
                .frame(width: 38, height: 38)
                .background((item.kind == .income ? GalacticTheme.green : GalacticTheme.indigo).opacity(0.11))
                .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))

            VStack(alignment: .leading, spacing: 3) {
                HStack(spacing: 6) {
                    Text(item.merchant)
                        .font(.subheadline.bold())
                        .foregroundStyle(GalacticTheme.navy)
                    if item.isRecurring {
                        Image(systemName: "repeat")
                            .font(.caption2)
                            .foregroundStyle(GalacticTheme.violet)
                    }
                }
                Text("\(item.category.rawValue) • \(item.date.formatted(date: .abbreviated, time: .omitted))")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                if !item.memo.isEmpty {
                    Text(item.memo)
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                        .lineLimit(1)
                }
            }

            Spacer(minLength: 8)
            Text((item.kind == .income ? "+" : "−") + store.currency(item.amount))
                .font(.subheadline.bold())
                .foregroundStyle(item.kind == .income ? GalacticTheme.green : GalacticTheme.navy)
                .minimumScaleFactor(0.7)
                .lineLimit(1)
        }
        .padding(.vertical, 3)
    }

    private func importCSV(_ result: Result<[URL], Error>) {
        do {
            guard let url = try result.get().first else { return }
            let accessed = url.startAccessingSecurityScopedResource()
            defer { if accessed { url.stopAccessingSecurityScopedResource() } }
            let text = try String(contentsOf: url, encoding: .utf8)
            let transactions = try CSVImportService.parse(text)
            store.addTransactions(transactions)
            importMessage = "Imported \(transactions.count) transaction\(transactions.count == 1 ? "" : "s"). Duplicate rows are ignored when they match an existing transaction."
        } catch {
            importMessage = "Could not import that CSV: \(error.localizedDescription)"
        }
    }
}

struct AddTransactionView: View {
    @EnvironmentObject private var store: FinancialStore
    @Environment(\.dismiss) private var dismiss

    @State private var date = Date()
    @State private var merchant = ""
    @State private var memo = ""
    @State private var amountText = ""
    @State private var kind: TransactionKind
    @State private var category: FinanceCategory
    @State private var recurring = false

    init(defaultKind: TransactionKind) {
        _kind = State(initialValue: defaultKind)
        _category = State(initialValue: defaultKind == .income ? .services : .software)
    }

    private var amount: Double? {
        Double(amountText.replacingOccurrences(of: ",", with: "").replacingOccurrences(of: "$", with: ""))
    }

    private var canSave: Bool {
        !merchant.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty && (amount ?? 0) > 0
    }

    var body: some View {
        NavigationStack {
            Form {
                Section("Transaction") {
                    Picker("Type", selection: $kind) {
                        ForEach(TransactionKind.allCases) { type in
                            Text(type.rawValue).tag(type)
                        }
                    }
                    .pickerStyle(.segmented)

                    TextField("Merchant or customer", text: $merchant)
                    TextField("Amount", text: $amountText)
                        .keyboardType(.decimalPad)
                    DatePicker("Date", selection: $date, displayedComponents: .date)
                    Picker("Category", selection: $category) {
                        ForEach(FinanceCategory.allCases) { category in
                            Text(category.rawValue).tag(category)
                        }
                    }
                    Toggle("Recurring", isOn: $recurring)
                    TextField("Memo (optional)", text: $memo, axis: .vertical)
                        .lineLimit(2...4)
                }

                Section {
                    Label("Galactic AI analyzes this record but does not move money or authorize payments.", systemImage: "lock.shield.fill")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }
            .navigationTitle(kind == .income ? "Add Income" : "Add Expense")
            .navigationBarTitleDisplayMode(.inline)
            .onChange(of: kind) { _, newValue in
                if newValue == .income && ![FinanceCategory.sales, .services, .other].contains(category) {
                    category = .services
                }
            }
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") {
                        guard let amount else { return }
                        store.addTransaction(BusinessTransaction(
                            date: date,
                            merchant: merchant.trimmingCharacters(in: .whitespacesAndNewlines),
                            memo: memo.trimmingCharacters(in: .whitespacesAndNewlines),
                            amount: amount,
                            kind: kind,
                            category: category,
                            isRecurring: recurring,
                            source: "Manual"
                        ))
                        dismiss()
                    }
                    .disabled(!canSave)
                }
            }
        }
    }
}

enum CSVImportError: LocalizedError {
    case missingHeader
    case missingAmount
    case noValidRows

    var errorDescription: String? {
        switch self {
        case .missingHeader: "The CSV does not contain a header row."
        case .missingAmount: "The CSV needs an amount column, or separate debit/credit columns."
        case .noValidRows: "No valid transaction rows were found."
        }
    }
}

struct CSVImportService {
    static func parse(_ text: String) throws -> [BusinessTransaction] {
        let rows = csvRows(text)
        guard let first = rows.first, !first.isEmpty else { throw CSVImportError.missingHeader }
        let headers = first.map(normalize)

        func index(_ candidates: [String]) -> Int? {
            headers.firstIndex { header in candidates.contains(where: { header == $0 || header.contains($0) }) }
        }

        let dateIndex = index(["date", "posted date", "transaction date"])
        let descriptionIndex = index(["description", "merchant", "name", "payee", "memo"])
        let amountIndex = index(["amount", "transaction amount"])
        let debitIndex = index(["debit", "withdrawal", "money out"])
        let creditIndex = index(["credit", "deposit", "money in"])
        let typeIndex = index(["type", "transaction type"])
        let categoryIndex = index(["category"])

        guard amountIndex != nil || debitIndex != nil || creditIndex != nil else {
            throw CSVImportError.missingAmount
        }

        var output: [BusinessTransaction] = []
        for fields in rows.dropFirst() where !fields.allSatisfy({ $0.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty }) {
            func value(_ idx: Int?) -> String {
                guard let idx, fields.indices.contains(idx) else { return "" }
                return fields[idx].trimmingCharacters(in: .whitespacesAndNewlines)
            }

            let description = value(descriptionIndex).isEmpty ? "Imported transaction" : value(descriptionIndex)
            let amountValue = parseMoney(value(amountIndex))
            let debit = parseMoney(value(debitIndex))
            let credit = parseMoney(value(creditIndex))
            let typeText = value(typeIndex).lowercased()

            let kind: TransactionKind
            let rawAmount: Double
            if let amountValue {
                rawAmount = abs(amountValue)
                if typeText.contains("debit") || typeText.contains("expense") || typeText.contains("withdraw") {
                    kind = .expense
                } else if typeText.contains("credit") || typeText.contains("income") || typeText.contains("deposit") {
                    kind = .income
                } else {
                    kind = amountValue < 0 ? .expense : .income
                }
            } else if let debit, debit != 0 {
                rawAmount = abs(debit)
                kind = .expense
            } else if let credit, credit != 0 {
                rawAmount = abs(credit)
                kind = .income
            } else {
                continue
            }

            guard rawAmount > 0 else { continue }
            let date = parseDate(value(dateIndex)) ?? Date()
            let categoryText = value(categoryIndex)
            let category = categoryFrom(categoryText.isEmpty ? description : categoryText, kind: kind)

            output.append(BusinessTransaction(
                date: date,
                merchant: description,
                memo: "Imported from CSV",
                amount: rawAmount,
                kind: kind,
                category: category,
                isRecurring: false,
                source: "CSV"
            ))
        }

        guard !output.isEmpty else { throw CSVImportError.noValidRows }
        return output
    }

    private static func normalize(_ text: String) -> String {
        text.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
    }

    private static func parseMoney(_ value: String) -> Double? {
        guard !value.isEmpty else { return nil }
        let negativeByParentheses = value.contains("(") && value.contains(")")
        let cleaned = value
            .replacingOccurrences(of: "$", with: "")
            .replacingOccurrences(of: ",", with: "")
            .replacingOccurrences(of: "(", with: "")
            .replacingOccurrences(of: ")", with: "")
            .trimmingCharacters(in: .whitespacesAndNewlines)
        guard let number = Double(cleaned) else { return nil }
        return negativeByParentheses ? -abs(number) : number
    }

    private static func parseDate(_ value: String) -> Date? {
        guard !value.isEmpty else { return nil }
        let formats = ["M/d/yyyy", "MM/dd/yyyy", "yyyy-MM-dd", "M/d/yy", "MM/dd/yy", "yyyy-MM-dd'T'HH:mm:ssZ"]
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        for format in formats {
            formatter.dateFormat = format
            if let date = formatter.date(from: value) { return date }
        }
        return nil
    }

    private static func categoryFrom(_ text: String, kind: TransactionKind) -> FinanceCategory {
        let value = text.lowercased()
        if kind == .income {
            if value.contains("sale") || value.contains("shop") || value.contains("store") { return .sales }
            return .services
        }
        if value.contains("payroll") || value.contains("salary") || value.contains("wage") { return .payroll }
        if value.contains("aws") || value.contains("software") || value.contains("notion") || value.contains("figma") || value.contains("slack") || value.contains("zoom") || value.contains("google workspace") { return .software }
        if value.contains("ad") || value.contains("marketing") || value.contains("meta") { return .marketing }
        if value.contains("rent") || value.contains("electric") || value.contains("utility") || value.contains("internet") { return .rentUtilities }
        if value.contains("office") || value.contains("amazon") || value.contains("supply") { return .office }
        if value.contains("travel") || value.contains("hotel") || value.contains("airline") || value.contains("uber") { return .travel }
        if value.contains("tax") { return .taxes }
        if value.contains("fee") { return .fees }
        return .other
    }

    private static func csvRows(_ text: String) -> [[String]] {
        var rows: [[String]] = []
        var row: [String] = []
        var field = ""
        var inQuotes = false
        let chars = Array(text.replacingOccurrences(of: "\r\n", with: "\n").replacingOccurrences(of: "\r", with: "\n"))
        var i = 0

        while i < chars.count {
            let char = chars[i]
            if char == "\"" {
                if inQuotes && i + 1 < chars.count && chars[i + 1] == "\"" {
                    field.append("\"")
                    i += 1
                } else {
                    inQuotes.toggle()
                }
            } else if char == "," && !inQuotes {
                row.append(field)
                field = ""
            } else if char == "\n" && !inQuotes {
                row.append(field)
                rows.append(row)
                row = []
                field = ""
            } else {
                field.append(char)
            }
            i += 1
        }

        if !field.isEmpty || !row.isEmpty {
            row.append(field)
            rows.append(row)
        }
        return rows
    }
}
