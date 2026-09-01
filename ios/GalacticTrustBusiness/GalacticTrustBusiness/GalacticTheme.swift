import SwiftUI

struct GalacticTheme {
    static let navy = Color(red: 0.018, green: 0.026, blue: 0.16)
    static let deepBlue = Color(red: 0.025, green: 0.07, blue: 0.47)
    static let indigo = Color(red: 0.20, green: 0.15, blue: 0.96)
    static let violet = Color(red: 0.52, green: 0.18, blue: 0.98)
    static let cyan = Color(red: 0.02, green: 0.78, blue: 0.94)
    static let green = Color(red: 0.02, green: 0.72, blue: 0.46)
    static let pink = Color(red: 0.98, green: 0.21, blue: 0.48)
    static let orange = Color(red: 1.00, green: 0.55, blue: 0.12)
    static let blue = Color(red: 0.08, green: 0.39, blue: 0.96)
    static let teal = Color(red: 0.02, green: 0.64, blue: 0.67)
    static let page = Color(red: 0.963, green: 0.968, blue: 0.995)
    static let panel = Color.white
    static let softPanel = Color(red: 0.982, green: 0.984, blue: 1.0)
    static let mutedText = Color(red: 0.39, green: 0.41, blue: 0.54)
    static let divider = Color(red: 0.89, green: 0.90, blue: 0.95)

    static let heroGradient = LinearGradient(
        colors: [deepBlue, indigo, violet],
        startPoint: .topLeading,
        endPoint: .bottomTrailing
    )

    static let spaceGradient = LinearGradient(
        colors: [navy, Color(red: 0.035, green: 0.03, blue: 0.28), deepBlue.opacity(0.92)],
        startPoint: .topLeading,
        endPoint: .bottomTrailing
    )

    static let sidebarGradient = LinearGradient(
        colors: [Color(red: 0.015, green: 0.025, blue: 0.16), Color(red: 0.04, green: 0.035, blue: 0.32)],
        startPoint: .top,
        endPoint: .bottom
    )

    static let backgroundGlow = RadialGradient(
        colors: [indigo.opacity(0.10), Color.clear],
        center: .topTrailing,
        startRadius: 20,
        endRadius: 520
    )
}

struct GalacticCard<Content: View>: View {
    let content: Content
    var padding: CGFloat = 18
    var radius: CGFloat = 20

    init(padding: CGFloat = 18, radius: CGFloat = 20, @ViewBuilder content: () -> Content) {
        self.padding = padding
        self.radius = radius
        self.content = content()
    }

    var body: some View {
        content
            .padding(padding)
            .background(GalacticTheme.panel)
            .clipShape(RoundedRectangle(cornerRadius: radius, style: .continuous))
            .overlay {
                RoundedRectangle(cornerRadius: radius, style: .continuous)
                    .stroke(GalacticTheme.divider.opacity(0.72), lineWidth: 1)
            }
            .shadow(color: GalacticTheme.navy.opacity(0.055), radius: 18, y: 8)
    }
}

struct MetricTile: View {
    let title: String
    let value: String
    let subtitle: String
    let systemImage: String
    let tint: Color

    var body: some View {
        GalacticCard(padding: 16, radius: 18) {
            HStack(alignment: .top, spacing: 13) {
                Image(systemName: systemImage)
                    .font(.subheadline.bold())
                    .foregroundStyle(.white)
                    .frame(width: 40, height: 40)
                    .background(tint.gradient)
                    .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))

                VStack(alignment: .leading, spacing: 4) {
                    Text(title)
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(GalacticTheme.mutedText)
                    Text(value)
                        .font(.title3.bold())
                        .foregroundStyle(GalacticTheme.navy)
                        .contentTransition(.numericText())
                        .minimumScaleFactor(0.72)
                        .lineLimit(1)
                    Text(subtitle)
                        .font(.caption2)
                        .foregroundStyle(GalacticTheme.mutedText)
                }
                Spacer(minLength: 0)
            }
        }
    }
}

struct SectionHeader: View {
    let title: String
    var actionTitle: String? = nil
    var action: (() -> Void)? = nil

    var body: some View {
        HStack {
            Text(title)
                .font(.headline)
                .foregroundStyle(GalacticTheme.navy)
            Spacer()
            if let actionTitle, let action {
                Button(actionTitle, action: action)
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(GalacticTheme.indigo)
            }
        }
    }
}

extension FinancialInsight {
    var color: Color {
        switch severity {
        case .positive: GalacticTheme.green
        case .information: GalacticTheme.blue
        case .warning: GalacticTheme.orange
        case .critical: GalacticTheme.pink
        }
    }

    var icon: String {
        switch severity {
        case .positive: "arrow.up.right.circle.fill"
        case .information: "sparkles"
        case .warning: "exclamationmark.triangle.fill"
        case .critical: "exclamationmark.octagon.fill"
        }
    }
}
