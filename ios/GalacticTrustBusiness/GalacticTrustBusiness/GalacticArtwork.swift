import SwiftUI

struct GalacticBrandMark: View {
    var size: CGFloat = 44

    var body: some View {
        ZStack {
            Circle()
                .fill(
                    LinearGradient(
                        colors: [GalacticTheme.cyan, GalacticTheme.indigo, GalacticTheme.pink],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    )
                )
                .frame(width: size * 0.72, height: size * 0.72)

            Ellipse()
                .stroke(
                    LinearGradient(
                        colors: [.pink, .cyan],
                        startPoint: .leading,
                        endPoint: .trailing
                    ),
                    lineWidth: max(2, size * 0.08)
                )
                .frame(width: size, height: size * 0.34)
                .rotationEffect(.degrees(-18))

            Circle()
                .fill(.white.opacity(0.85))
                .frame(width: size * 0.08, height: size * 0.08)
                .offset(x: size * 0.28, y: -size * 0.31)
        }
        .frame(width: size, height: size)
        .accessibilityHidden(true)
    }
}

struct GalacticPlanetScene: View {
    var body: some View {
        GeometryReader { proxy in
            let w = proxy.size.width
            let h = proxy.size.height

            ZStack {
                ForEach(0..<14, id: \.self) { index in
                    Circle()
                        .fill(Color.white.opacity(index.isMultiple(of: 3) ? 0.9 : 0.55))
                        .frame(width: CGFloat(2 + (index % 3)), height: CGFloat(2 + (index % 3)))
                        .position(
                            x: w * CGFloat((index * 31 + 13) % 97) / 100,
                            y: h * CGFloat((index * 47 + 17) % 93) / 100
                        )
                }

                Ellipse()
                    .stroke(
                        LinearGradient(
                            colors: [GalacticTheme.pink.opacity(0.95), GalacticTheme.cyan.opacity(0.9)],
                            startPoint: .leading,
                            endPoint: .trailing
                        ),
                        lineWidth: max(9, w * 0.035)
                    )
                    .frame(width: w * 0.58, height: h * 0.25)
                    .rotationEffect(.degrees(-22))
                    .position(x: w * 0.72, y: h * 0.58)
                    .shadow(color: GalacticTheme.pink.opacity(0.35), radius: 12)

                Circle()
                    .fill(
                        RadialGradient(
                            colors: [Color.white.opacity(0.95), GalacticTheme.cyan, GalacticTheme.indigo],
                            center: .topLeading,
                            startRadius: 0,
                            endRadius: w * 0.22
                        )
                    )
                    .frame(width: min(w * 0.26, h * 0.72), height: min(w * 0.26, h * 0.72))
                    .position(x: w * 0.70, y: h * 0.48)
                    .shadow(color: GalacticTheme.cyan.opacity(0.45), radius: 22)

                Circle()
                    .fill(
                        LinearGradient(
                            colors: [GalacticTheme.pink, GalacticTheme.violet],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        )
                    )
                    .frame(width: w * 0.07, height: w * 0.07)
                    .position(x: w * 0.47, y: h * 0.69)

                Circle()
                    .fill(GalacticTheme.cyan)
                    .frame(width: w * 0.035, height: w * 0.035)
                    .position(x: w * 0.87, y: h * 0.26)
            }
        }
        .accessibilityHidden(true)
    }
}

struct GalacticRobot: View {
    var body: some View {
        GeometryReader { proxy in
            let s = min(proxy.size.width, proxy.size.height)

            ZStack {
                Ellipse()
                    .fill(GalacticTheme.indigo.opacity(0.12))
                    .frame(width: s * 0.9, height: s * 0.30)
                    .blur(radius: 8)
                    .offset(y: s * 0.33)

                RoundedRectangle(cornerRadius: s * 0.14, style: .continuous)
                    .fill(
                        LinearGradient(
                            colors: [Color.white, Color(red: 0.86, green: 0.91, blue: 1.0)],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        )
                    )
                    .frame(width: s * 0.54, height: s * 0.52)
                    .offset(y: s * 0.18)
                    .shadow(color: GalacticTheme.indigo.opacity(0.18), radius: 10, y: 8)

                Circle()
                    .fill(
                        LinearGradient(
                            colors: [Color.white, Color(red: 0.82, green: 0.88, blue: 1.0)],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        )
                    )
                    .frame(width: s * 0.64, height: s * 0.64)
                    .offset(y: -s * 0.12)
                    .shadow(color: GalacticTheme.indigo.opacity(0.20), radius: 12, y: 6)

                RoundedRectangle(cornerRadius: s * 0.16, style: .continuous)
                    .fill(
                        LinearGradient(
                            colors: [GalacticTheme.navy, GalacticTheme.deepBlue],
                            startPoint: .top,
                            endPoint: .bottom
                        )
                    )
                    .frame(width: s * 0.46, height: s * 0.30)
                    .offset(y: -s * 0.10)

                HStack(spacing: s * 0.11) {
                    Capsule()
                        .fill(GalacticTheme.cyan)
                        .frame(width: s * 0.055, height: s * 0.11)
                        .shadow(color: GalacticTheme.cyan, radius: 6)
                    Capsule()
                        .fill(GalacticTheme.cyan)
                        .frame(width: s * 0.055, height: s * 0.11)
                        .shadow(color: GalacticTheme.cyan, radius: 6)
                }
                .offset(y: -s * 0.11)

                Capsule()
                    .stroke(GalacticTheme.violet.opacity(0.8), lineWidth: max(2, s * 0.025))
                    .frame(width: s * 0.16, height: s * 0.07)
                    .offset(y: s * 0.01)

                Circle()
                    .fill(GalacticTheme.violet)
                    .frame(width: s * 0.12, height: s * 0.12)
                    .overlay {
                        Circle()
                            .fill(GalacticTheme.cyan)
                            .frame(width: s * 0.05, height: s * 0.05)
                    }
                    .offset(x: -s * 0.31, y: -s * 0.10)

                Circle()
                    .fill(GalacticTheme.violet)
                    .frame(width: s * 0.12, height: s * 0.12)
                    .overlay {
                        Circle()
                            .fill(GalacticTheme.cyan)
                            .frame(width: s * 0.05, height: s * 0.05)
                    }
                    .offset(x: s * 0.31, y: -s * 0.10)

                Image(systemName: "sparkles")
                    .font(.system(size: s * 0.10, weight: .bold))
                    .foregroundStyle(GalacticTheme.violet)
                    .offset(y: s * 0.20)
            }
        }
        .accessibilityHidden(true)
    }
}
