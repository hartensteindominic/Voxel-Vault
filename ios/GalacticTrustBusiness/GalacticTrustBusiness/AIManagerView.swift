import SwiftUI

struct AIManagerView: View {
    @EnvironmentObject private var store: FinancialStore
    @State private var question = ""
    @State private var messages: [FinanceChatMessage] = [
        .init(role: .assistant, text: "I’m your read-only business financial manager. I can explain money received, spending, invoices, recurring costs, cash balance, and runway using the records in this app.")
    ]
    @State private var selectedInsight: FinancialInsight?

    private let suggestions = [
        "Why did spending change?",
        "How much revenue came in?",
        "What invoices are overdue?",
        "What are my recurring costs?",
        "How long is my cash runway?"
    ]

    var body: some View {
        VStack(spacing: 0) {
            ScrollView {
                LazyVStack(spacing: 14) {
                    intelligenceHeader
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
        messages.append(.init(role: .assistant, text: store.answer(text)))
    }
}

struct FinanceChatMessage: Identifiable, Equatable {
    enum Role { case user, assistant }
    let id = UUID()
    let role: Role
    let text: String
}
