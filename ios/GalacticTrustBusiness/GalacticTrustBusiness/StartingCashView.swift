import SwiftUI
import Foundation

struct StartingCashView: View {
    @EnvironmentObject private var store: FinancialStore
    @Environment(\.dismiss) private var dismiss

    @State private var amountText = ""
    @State private var showingSaved = false

    private var amount: Double? {
        Double(
            amountText
                .replacingOccurrences(of: ",", with: "")
                .replacingOccurrences(of: "$", with: "")
                .trimmingCharacters(in: .whitespacesAndNewlines)
        )
    }

    private var canSave: Bool {
        guard let amount else { return false }
        return amount >= 0 && amount.isFinite
    }

    var body: some View {
        Form {
            Section("Starting cash") {
                TextField("0.00", text: $amountText)
                    .keyboardType(.decimalPad)

                LabeledContent("Current starting cash", value: store.currency(store.openingBalance))
                LabeledContent("Recorded cash now", value: store.currency(store.balance))
            }

            Section {
                Text("Use the cash your business already had before the transactions stored in this app. This amount is not counted as revenue and does not create a transaction.")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }

            Section {
                Button("Save starting cash") {
                    guard let amount else { return }
                    store.updateOpeningBalance(amount)
                    showingSaved = true
                }
                .disabled(!canSave)

                if store.openingBalance != 0 {
                    Button("Reset starting cash to $0", role: .destructive) {
                        store.updateOpeningBalance(0)
                        amountText = "0"
                        showingSaved = true
                    }
                }
            }
        }
        .navigationTitle("Starting Cash")
        .navigationBarTitleDisplayMode(.inline)
        .onAppear {
            amountText = store.openingBalance == 0 ? "0" : String(format: "%.2f", store.openingBalance)
        }
        .alert("Starting cash updated", isPresented: $showingSaved) {
            Button("Done") { dismiss() }
        } message: {
            Text("Recorded cash has been recalculated without changing revenue or expenses.")
        }
    }
}
