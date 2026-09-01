import SwiftUI

struct AIManagerView: View {
    @EnvironmentObject private var store: FinancialStore
    @State private var question = ""
    @State private var messages: [FinanceChatMessage] = [
        .init(role: .assistant, text: "I’m your read-only business financial manager. I can explain money received, spending changes, invoices, recurring costs, cash balance, runway, forecasts, and business health using the records in this app.")
    ]
    @State private var selectedInsight: FinancialInsight?

    private let suggestions = [
        "How healthy is my business?",
        "Why did spending change?",
        "What needs attention?",
        "How much revenue came in?",
        "What invoices are overdue?",
        "What are my recurring costs?",
        "What is my 30-day forecast?"
    ]

    var body: some View {
        VStack(spacing: 0) {
            ScrollView {
                LazyVStack(spacing: 14) {
                    intelligenceHeader
                    healthSnapshot
                    insightsStrip

                    ForEach(messages) { message in
                        chatBubble(message)
                    }

                    suggestionsView
                }
                .padding(16)
                .padding(.bottom, 8)
            }
            .background(GalacticTheme.page)

            composer
        }
        .navigationTitle("AI Financial Manager")
        .navigationBarTitleDisplayMode(.inline)
        .sheet(item: $selectedInsight) { insight in
            InsightEvidenceView(insight: insight)
        }
    }

    private var intelligenceHeader: some View {
        ZStack(alignment: .leading) {
            GalacticTheme.spaceGradient
            Circle()
                .fill(GalacticTheme.cyan.opacity(0.25))
                .frame(width: 120, height: 120)
                .offset(x: 230, y: 45)
            Circle()
                .stroke(GalacticTheme.violet.opacity(0.55), lineWidth: 12)
                .frame(width: 150, height: 52)
                .rotationEffect(.degrees(-17))
                .offset(x: 208, y: 83)

            VStack(alignment: .leading, spacing: 8) {
                Label("Galactic AI", systemImage: "sparkles")
                    .font(.headline)
                    .foregroundStyle(.white)
                Text("Business finances, explained")
                    .font(.title3.bold())
                    .foregroundStyle(.white)
                Text("Read-only analysis • Evidence-backed • On-device records")
                    .font(.caption)
                    .foregroundStyle(.white.opacity(0.72))
            }
            .padding(20)
        }
        .frame(height: 150)
        .clipShape(RoundedRectangle(cornerRadius: 26, style: .continuous))
    }

    private var healthSnapshot: some View {
        GalacticCard(padding: 16, radius: 20) {
            VStack(alignment: .leading, spacing: 12) {
                HStack(alignment: .firstTextBaseline) {
                    VStack(alignment: .leading, spacing: 3) {
                        Text("Business Health")
                            .font(.caption.weight(.semibold))
                            .foregroundStyle(GalacticTheme.mutedText)
                        Text("\(store.businessHealthScore)/100")
                            .font(.title2.bold())
                            .foregroundStyle(GalacticTheme.navy)
                    }
                    Spacer()
                    Text(store.businessHealthLabel)
                        .font(.caption.bold())
                        .foregroundStyle(healthTint)
                        .padding(.horizontal, 10)
                        .padding(.vertical, 6)
                        .background(healthTint.opacity(0.10))
                        .clipShape(Capsule())
                }

                ProgressView(value: Double(store.businessHealthScore), total: 100)
                    .tint(healthTint)

                HStack(spacing: 12) {
                    healthMetric(
                        title: "Cash flow",
                        value: store.currency(store.currentMonthNet),
                        positive: store.currentMonthNet >= 0
                    )
                    healthMetric(
                        title: "Expense coverage",
                        value: "\(store.expenseCoverageMonths.formatted(.number.precision(.fractionLength(1)))) mo",
                        positive: store.expenseCoverageMonths >= 3
                    )
                    healthMetric(
                        title: "Overdue",
                        value: store.currency(store.overdueInvoices.reduce(0) { $0 + $1.amount }),
                        positive: store.overdueInvoices.isEmpty
                    )
                }

                Text("Health is a planning signal derived only from the records stored in this app; it is not a credit score or financial guarantee.")
                    .font(.caption2)
                    .foregroundStyle(GalacticTheme.mutedText)
            }
        }
    }

    private func healthMetric(title: String, value: String, positive: Bool) -> some View {
        VStack(alignment: .leading, spacing: 3) {
            Text(title)
                .font(.caption2)
                .foregroundStyle(GalacticTheme.mutedText)
                .lineLimit(1)
            Text(value)
                .font(.caption.bold())
                .foregroundStyle(positive ? GalacticTheme.green : GalacticTheme.orange)
                .lineLimit(1)
                .minimumScaleFactor(0.65)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private var healthTint: Color {
        switch store.businessHealthScore {
        case 80...: GalacticTheme.green
        case 65..<80: GalacticTheme.teal
        case 50..<65: GalacticTheme.orange
        default: GalacticTheme.pink
        }
    }

    private var insightsStrip: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                Text("What needs attention")
                    .font(.headline)
                    .foregroundStyle(GalacticTheme.navy)
                Spacer()
                Text("Tap for evidence")
                    .font(.caption2)
                    .foregroundStyle(.secondary)
            }

            if store.insights.isEmpty {
                Text("No significant insights yet. Add or import more transactions to build a stronger baseline.")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            } else {
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 10) {
                        ForEach(store.insights) { insight in
                            Button {
                                selectedInsight = insight
                            } label: {
                                VStack(alignment: .leading, spacing: 8) {
                                    Image(systemName: insight.icon)
                                        .foregroundStyle(insight.color)
                                    Text(insight.title)
                                        .font(.caption.bold())
                                        .foregroundStyle(GalacticTheme.navy)
                                        .multilineTextAlignment(.leading)
                                        .lineLimit(2)
                                    Text("Show evidence")
                                        .font(.caption2.weight(.semibold))
                                        .foregroundStyle(GalacticTheme.indigo)
                                }
                                .frame(width: 155, height: 110, alignment: .topLeading)
                                .padding(13)
                                .background(.white)
                                .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
                                .overlay {
                                    RoundedRectangle(cornerRadius: 18, style: .continuous)
                                        .stroke(insight.color.opacity(0.15), lineWidth: 1)
                                }
                            }
                            .buttonStyle(.plain)
                        }
                    }
                }
            }
        }
    }

    private func chatBubble(_ message: FinanceChatMessage) -> some View {
        HStack(alignment: .bottom) {
            if message.role == .user { Spacer(minLength: 48) }

            if message.role == .assistant {
                Image(systemName: "sparkles")
                    .font(.caption.bold())
                    .foregroundStyle(.white)
                    .frame(width: 30, height: 30)
                    .background(GalacticTheme.heroGradient)
                    .clipShape(Circle())
            }

            Text(message.text)
                .font(.subheadline)
                .foregroundStyle(message.role == .user ? .white : GalacticTheme.navy)
                .padding(.horizontal, 14)
                .padding(.vertical, 11)
                .background(message.role == .user ? AnyShapeStyle(GalacticTheme.heroGradient) : AnyShapeStyle(Color.white))
                .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
                .shadow(color: GalacticTheme.indigo.opacity(message.role == .assistant ? 0.06 : 0), radius: 8, y: 4)

            if message.role == .assistant { Spacer(minLength: 34) }
        }
    }

    private var suggestionsView: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Try asking")
                .font(.caption.weight(.semibold))
                .foregroundStyle(.secondary)
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 8) {
                    ForEach(suggestions, id: \.self) { suggestion in
                        Button(suggestion) {
                            ask(suggestion)
                        }
                        .buttonStyle(.bordered)
                        .buttonBorderShape(.capsule)
                        .font(.caption)
                        .tint(GalacticTheme.indigo)
                    }
                }
            }
        }
    }

    private var composer: some View {
        HStack(spacing: 10) {
            TextField("Ask about your business finances…", text: $question, axis: .vertical)
                .lineLimit(1...4)
                .textFieldStyle(.plain)
                .padding(.horizontal, 14)
                .padding(.vertical, 11)
                .background(Color.secondary.opacity(0.08))
                .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
                .onSubmit { submit() }

            Button(action: submit) {
                Image(systemName: "arrow.up")
                    .font(.headline.bold())
                    .foregroundStyle(.white)
                    .frame(width: 44, height: 44)
                    .background(GalacticTheme.heroGradient)
                    .clipShape(Circle())
            }
            .disabled(question.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
            .opacity(question.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? 0.45 : 1)
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 10)
        .background(.ultraThinMaterial)
        .overlay(alignment: .top) { Divider() }
    }

    private func submit() {
        let clean = question.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !clean.isEmpty else { return }
        question = ""
        ask(clean)
    }

    private func ask(_ text: String) {
        messages.append(.init(role: .user, text: text))
        messages.append(.init(role: .assistant, text: store.smartAnswer(text)))
    }
}

struct FinanceChatMessage: Identifiable, Equatable {
    enum Role { case user, assistant }
    let id = UUID()
    let role: Role
    let text: String
}
