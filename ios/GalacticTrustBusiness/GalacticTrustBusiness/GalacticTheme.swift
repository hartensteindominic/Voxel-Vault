import SwiftUI
import Foundation

private extension Color {
    static func galactic(_ hex: UInt32, alpha: Double = 1) -> Color {
        Color(
            red: Double((hex >> 16) & 0xFF) / 255,
            green: Double((hex >> 8) & 0xFF) / 255,
            blue: Double(hex & 0xFF) / 255,
            opacity: alpha
        )
    }
}

struct GalacticPalette {
    let page: Color
    let panel: Color
    let softPanel: Color
    let ink: Color
    let muted: Color
    let divider: Color
    let primary: Color
    let secondary: Color
    let tertiary: Color
    let highlight: Color
    let heroStart: Color
    let heroMid: Color
    let heroEnd: Color
    let dockStart: Color
    let dockEnd: Color
    let dockIsDark: Bool
    let glassOpacity: Double
}

enum GalacticThemeOption: String, CaseIterable, Identifiable {
    case cosmicBlue
    case nebulaPurple
    case galaxyTeal
    case solarWhite
    case stardustGold
    case auroraMint
    case cometPink
    case quantumBlue
    case neonCyber
    case celestialLight
    case sunriseNebula
    case lunarLavender
    case iceCrystal
    case peachOrbit
    case emeraldNova
    case sapphireGlass
    case roseGoldMoon
    case arcticAurora
    case champagneCosmos
    case prismSky

    static let storageKey = "galacticThemeID"
    static let defaultTheme: GalacticThemeOption = .sunriseNebula

    var id: String { rawValue }

    var name: String {
        switch self {
        case .cosmicBlue: "Cosmic Blue"
        case .nebulaPurple: "Nebula Purple"
        case .galaxyTeal: "Galaxy Teal"
        case .solarWhite: "Solar White"
        case .stardustGold: "Stardust Gold"
        case .auroraMint: "Aurora Mint"
        case .cometPink: "Comet Pink"
        case .quantumBlue: "Quantum Blue"
        case .neonCyber: "Neon Cyber"
        case .celestialLight: "Celestial Light"
        case .sunriseNebula: "Sunrise Nebula"
        case .lunarLavender: "Lunar Lavender"
        case .iceCrystal: "Ice Crystal"
        case .peachOrbit: "Peach Orbit"
        case .emeraldNova: "Emerald Nova"
        case .sapphireGlass: "Sapphire Glass"
        case .roseGoldMoon: "Rose Gold Moon"
        case .arcticAurora: "Arctic Aurora"
        case .champagneCosmos: "Champagne Cosmos"
        case .prismSky: "Prism Sky"
        }
    }

    var subtitle: String {
        switch self {
        case .cosmicBlue: "Classic deep-space blue"
        case .nebulaPurple: "Violet nebula glow"
        case .galaxyTeal: "Bright cyan + teal"
        case .solarWhite: "Clean white with sunshine"
        case .stardustGold: "Warm gold glass"
        case .auroraMint: "Fresh mint aurora"
        case .cometPink: "Playful pink comet"
        case .quantumBlue: "Electric blue clarity"
        case .neonCyber: "High-energy neon accents"
        case .celestialLight: "Soft luminous blue"
        case .sunriseNebula: "Yellow, peach + violet sky"
        case .lunarLavender: "Moonlit lavender glass"
        case .iceCrystal: "Icy crystal blue"
        case .peachOrbit: "Peach sunrise orbit"
        case .emeraldNova: "Green + blue nova"
        case .sapphireGlass: "Premium sapphire glass"
        case .roseGoldMoon: "Warm rose-gold moon"
        case .arcticAurora: "Arctic blue + mint"
        case .champagneCosmos: "Creamy champagne glow"
        case .prismSky: "Rainbow prism highlights"
        }
    }

    var usesDarkHeroText: Bool {
        switch self {
        case .solarWhite, .stardustGold, .auroraMint, .celestialLight, .sunriseNebula,
             .lunarLavender, .iceCrystal, .peachOrbit, .emeraldNova, .roseGoldMoon,
             .arcticAurora, .champagneCosmos, .prismSky:
            true
        case .cosmicBlue, .nebulaPurple, .galaxyTeal, .cometPink, .quantumBlue,
             .neonCyber, .sapphireGlass:
            false
        }
    }

    var palette: GalacticPalette {
        switch self {
        case .cosmicBlue:
            return GalacticPalette(page: .galactic(0xF1F6FF), panel: .galactic(0xFFFFFF), softPanel: .galactic(0xF5F8FF), ink: .galactic(0x071347), muted: .galactic(0x596487), divider: .galactic(0xD9E4FF), primary: .galactic(0x245CFF), secondary: .galactic(0x6B45FF), tertiary: .galactic(0x32C9FF), highlight: .galactic(0xA86BFF), heroStart: .galactic(0x073CD8), heroMid: .galactic(0x2B4FFF), heroEnd: .galactic(0x36C8FF), dockStart: .galactic(0x071347), dockEnd: .galactic(0x162B78), dockIsDark: true, glassOpacity: 0.94)
        case .nebulaPurple:
            return GalacticPalette(page: .galactic(0xF7F3FF), panel: .galactic(0xFFFFFF), softPanel: .galactic(0xFAF6FF), ink: .galactic(0x17083F), muted: .galactic(0x665B80), divider: .galactic(0xE6D9FF), primary: .galactic(0x7248FF), secondary: .galactic(0xB343FF), tertiary: .galactic(0x5CD7FF), highlight: .galactic(0xFF7BD5), heroStart: .galactic(0x5A25D8), heroMid: .galactic(0x8F31E8), heroEnd: .galactic(0xE45DDD), dockStart: .galactic(0x1A093E), dockEnd: .galactic(0x42206B), dockIsDark: true, glassOpacity: 0.93)
        case .galaxyTeal:
            return GalacticPalette(page: .galactic(0xEDFBFC), panel: .galactic(0xFFFFFF), softPanel: .galactic(0xF0FCFD), ink: .galactic(0x063B4A), muted: .galactic(0x4E6D75), divider: .galactic(0xCBECEF), primary: .galactic(0x00AFC1), secondary: .galactic(0x1C74E8), tertiary: .galactic(0x29E0D0), highlight: .galactic(0x70E7FF), heroStart: .galactic(0x008CA2), heroMid: .galactic(0x00B6C7), heroEnd: .galactic(0x28D7E5), dockStart: .galactic(0x053A49), dockEnd: .galactic(0x006E78), dockIsDark: true, glassOpacity: 0.94)
        case .solarWhite:
            return GalacticPalette(page: .galactic(0xFFFDF7), panel: .galactic(0xFFFFFF), softPanel: .galactic(0xFFF9EE), ink: .galactic(0x17162A), muted: .galactic(0x696478), divider: .galactic(0xF0E4CD), primary: .galactic(0xFF9E1A), secondary: .galactic(0xFFCA52), tertiary: .galactic(0x7ABEFF), highlight: .galactic(0xFF7CC8), heroStart: .galactic(0xFFF4C2), heroMid: .galactic(0xFFE2A4), heroEnd: .galactic(0xCCE7FF), dockStart: .galactic(0xFFFDF8), dockEnd: .galactic(0xFFF5E4), dockIsDark: false, glassOpacity: 0.90)
        case .stardustGold:
            return GalacticPalette(page: .galactic(0xFFF9EB), panel: .galactic(0xFFFEFB), softPanel: .galactic(0xFFF5DC), ink: .galactic(0x28200C), muted: .galactic(0x776B4E), divider: .galactic(0xECD8A8), primary: .galactic(0xE8A51B), secondary: .galactic(0xFFCA4F), tertiary: .galactic(0xF2B9FF), highlight: .galactic(0xFF8F5A), heroStart: .galactic(0xFFF0BD), heroMid: .galactic(0xFFD77A), heroEnd: .galactic(0xFAD0E9), dockStart: .galactic(0xFFF9EB), dockEnd: .galactic(0xFBEBC3), dockIsDark: false, glassOpacity: 0.91)
        case .auroraMint:
            return GalacticPalette(page: .galactic(0xEEFFFA), panel: .galactic(0xFFFFFF), softPanel: .galactic(0xF2FFFC), ink: .galactic(0x073D38), muted: .galactic(0x55756F), divider: .galactic(0xCDEEE5), primary: .galactic(0x18BF96), secondary: .galactic(0x31C8D6), tertiary: .galactic(0x6BD8FF), highlight: .galactic(0x9DE993), heroStart: .galactic(0xCFFFEF), heroMid: .galactic(0xA6F1E2), heroEnd: .galactic(0xBFE8FF), dockStart: .galactic(0xF5FFFC), dockEnd: .galactic(0xDAF8EF), dockIsDark: false, glassOpacity: 0.92)
        case .cometPink:
            return GalacticPalette(page: .galactic(0xFFF1F8), panel: .galactic(0xFFFFFF), softPanel: .galactic(0xFFF5FA), ink: .galactic(0x47142E), muted: .galactic(0x815D70), divider: .galactic(0xF5D0E2), primary: .galactic(0xFF3D8D), secondary: .galactic(0xFF6B9C), tertiary: .galactic(0x9D75FF), highlight: .galactic(0xFFB45C), heroStart: .galactic(0xF3267C), heroMid: .galactic(0xFF5B8B), heroEnd: .galactic(0xA56CFF), dockStart: .galactic(0xFFF7FB), dockEnd: .galactic(0xFFE0EC), dockIsDark: false, glassOpacity: 0.91)
        case .quantumBlue:
            return GalacticPalette(page: .galactic(0xEEF6FF), panel: .galactic(0xFFFFFF), softPanel: .galactic(0xF2F7FF), ink: .galactic(0x071E51), muted: .galactic(0x53698B), divider: .galactic(0xD3E2FF), primary: .galactic(0x137BFF), secondary: .galactic(0x3C5BFF), tertiary: .galactic(0x45D2FF), highlight: .galactic(0x8D8CFF), heroStart: .galactic(0x0666E5), heroMid: .galactic(0x187FF4), heroEnd: .galactic(0x45C8FF), dockStart: .galactic(0x08235E), dockEnd: .galactic(0x0E55AE), dockIsDark: true, glassOpacity: 0.94)
        case .neonCyber:
            return GalacticPalette(page: .galactic(0xF8F1FF), panel: .galactic(0xFFFFFF), softPanel: .galactic(0xFBF6FF), ink: .galactic(0x180927), muted: .galactic(0x6B5877), divider: .galactic(0xE9D3F5), primary: .galactic(0x1C7BFF), secondary: .galactic(0xE92BFF), tertiary: .galactic(0x1FE8F2), highlight: .galactic(0xFF3F93), heroStart: .galactic(0x161C78), heroMid: .galactic(0x6A1DC8), heroEnd: .galactic(0xE728CA), dockStart: .galactic(0x10051D), dockEnd: .galactic(0x31104C), dockIsDark: true, glassOpacity: 0.92)
        case .celestialLight:
            return GalacticPalette(page: .galactic(0xF5F8FF), panel: .galactic(0xFFFFFF), softPanel: .galactic(0xF8FAFF), ink: .galactic(0x0B194B), muted: .galactic(0x617094), divider: .galactic(0xDFE7FA), primary: .galactic(0x486DFF), secondary: .galactic(0x8A78FF), tertiary: .galactic(0x8CD9FF), highlight: .galactic(0xFFB2DE), heroStart: .galactic(0xD9ECFF), heroMid: .galactic(0xDBD9FF), heroEnd: .galactic(0xF3E8FF), dockStart: .galactic(0xFCFDFF), dockEnd: .galactic(0xEFF3FF), dockIsDark: false, glassOpacity: 0.90)
        case .sunriseNebula:
            return GalacticPalette(page: .galactic(0xFFF8F1), panel: .galactic(0xFFFFFF), softPanel: .galactic(0xFFF8FA), ink: .galactic(0x111A52), muted: .galactic(0x676784), divider: .galactic(0xF0DDE2), primary: .galactic(0x5967FF), secondary: .galactic(0xA865FF), tertiary: .galactic(0x6FDFFF), highlight: .galactic(0xFFD15D), heroStart: .galactic(0xFFE58C), heroMid: .galactic(0xFFC1D8), heroEnd: .galactic(0x9ED8FF), dockStart: .galactic(0xFFFEFC), dockEnd: .galactic(0xF7F1FF), dockIsDark: false, glassOpacity: 0.89)
        case .lunarLavender:
            return GalacticPalette(page: .galactic(0xF8F4FF), panel: .galactic(0xFFFFFF), softPanel: .galactic(0xFBF8FF), ink: .galactic(0x23154A), muted: .galactic(0x6E6285), divider: .galactic(0xE4D9F5), primary: .galactic(0x7664FF), secondary: .galactic(0xB889FF), tertiary: .galactic(0x9AD8FF), highlight: .galactic(0xFFB7E8), heroStart: .galactic(0xDED7FF), heroMid: .galactic(0xD9C7FF), heroEnd: .galactic(0xF6DAF4), dockStart: .galactic(0xFDFBFF), dockEnd: .galactic(0xF0E8FF), dockIsDark: false, glassOpacity: 0.90)
        case .iceCrystal:
            return GalacticPalette(page: .galactic(0xF2FCFF), panel: .galactic(0xFFFFFF), softPanel: .galactic(0xF5FCFF), ink: .galactic(0x10364C), muted: .galactic(0x5C7785), divider: .galactic(0xD4ECF4), primary: .galactic(0x44A8FF), secondary: .galactic(0x77C8FF), tertiary: .galactic(0x75E2ED), highlight: .galactic(0xB5BCFF), heroStart: .galactic(0xD5F4FF), heroMid: .galactic(0xC7EDFF), heroEnd: .galactic(0xE9F9FF), dockStart: .galactic(0xFCFFFF), dockEnd: .galactic(0xE9F8FF), dockIsDark: false, glassOpacity: 0.88)
        case .peachOrbit:
            return GalacticPalette(page: .galactic(0xFFF7F3), panel: .galactic(0xFFFFFF), softPanel: .galactic(0xFFF9F6), ink: .galactic(0x46261F), muted: .galactic(0x7E6860), divider: .galactic(0xF2DDD4), primary: .galactic(0xFF865F), secondary: .galactic(0xFFB16E), tertiary: .galactic(0x85C7FF), highlight: .galactic(0xFF75AF), heroStart: .galactic(0xFFE1CE), heroMid: .galactic(0xFFD3C3), heroEnd: .galactic(0xCDE6FF), dockStart: .galactic(0xFFFCFA), dockEnd: .galactic(0xFFF0EA), dockIsDark: false, glassOpacity: 0.90)
        case .emeraldNova:
            return GalacticPalette(page: .galactic(0xF1FFF8), panel: .galactic(0xFFFFFF), softPanel: .galactic(0xF4FFF9), ink: .galactic(0x0B4030), muted: .galactic(0x58766B), divider: .galactic(0xCFEBDD), primary: .galactic(0x14B97A), secondary: .galactic(0x2B91E8), tertiary: .galactic(0x53DCC4), highlight: .galactic(0xB5E764), heroStart: .galactic(0xCBF9E4), heroMid: .galactic(0xB8EFDF), heroEnd: .galactic(0xC9E8FF), dockStart: .galactic(0xF8FFFB), dockEnd: .galactic(0xE4F8EF), dockIsDark: false, glassOpacity: 0.92)
        case .sapphireGlass:
            return GalacticPalette(page: .galactic(0xEFF5FF), panel: .galactic(0xFFFFFF), softPanel: .galactic(0xF4F7FF), ink: .galactic(0x0A1B49), muted: .galactic(0x57698D), divider: .galactic(0xD4DFF5), primary: .galactic(0x315BDB), secondary: .galactic(0x5C7CFF), tertiary: .galactic(0x55C7F5), highlight: .galactic(0xA86BFF), heroStart: .galactic(0x244AB8), heroMid: .galactic(0x3862D8), heroEnd: .galactic(0x4FADEB), dockStart: .galactic(0x0A1B49), dockEnd: .galactic(0x1D3E88), dockIsDark: true, glassOpacity: 0.95)
        case .roseGoldMoon:
            return GalacticPalette(page: .galactic(0xFFF7F6), panel: .galactic(0xFFFFFF), softPanel: .galactic(0xFFF8F8), ink: .galactic(0x44272E), muted: .galactic(0x7C666A), divider: .galactic(0xEDD9DC), primary: .galactic(0xD9808D), secondary: .galactic(0xF3A5A2), tertiary: .galactic(0xA6C8FF), highlight: .galactic(0xF8C66E), heroStart: .galactic(0xF7D4D7), heroMid: .galactic(0xF9C8C0), heroEnd: .galactic(0xFBE1B5), dockStart: .galactic(0xFFFDFD), dockEnd: .galactic(0xF9ECEE), dockIsDark: false, glassOpacity: 0.90)
        case .arcticAurora:
            return GalacticPalette(page: .galactic(0xF1FAFF), panel: .galactic(0xFFFFFF), softPanel: .galactic(0xF5FBFF), ink: .galactic(0x113450), muted: .galactic(0x5B7387), divider: .galactic(0xD3E8F4), primary: .galactic(0x3699F4), secondary: .galactic(0x48C6C8), tertiary: .galactic(0x7EE7D3), highlight: .galactic(0xA9B9FF), heroStart: .galactic(0xD4F1FF), heroMid: .galactic(0xC8F3EC), heroEnd: .galactic(0xD9E5FF), dockStart: .galactic(0xFBFEFF), dockEnd: .galactic(0xEAF8F8), dockIsDark: false, glassOpacity: 0.89)
        case .champagneCosmos:
            return GalacticPalette(page: .galactic(0xFFF9F0), panel: .galactic(0xFFFFFF), softPanel: .galactic(0xFFFBF5), ink: .galactic(0x352B1F), muted: .galactic(0x776D5E), divider: .galactic(0xEDE0CB), primary: .galactic(0xC99A50), secondary: .galactic(0xE9BF77), tertiary: .galactic(0xB5CFFF), highlight: .galactic(0xFFCF7D), heroStart: .galactic(0xF8E7C3), heroMid: .galactic(0xF8DDAE), heroEnd: .galactic(0xE5E4FF), dockStart: .galactic(0xFFFDF9), dockEnd: .galactic(0xF8EFD9), dockIsDark: false, glassOpacity: 0.89)
        case .prismSky:
            return GalacticPalette(page: .galactic(0xF7FAFF), panel: .galactic(0xFFFFFF), softPanel: .galactic(0xFAFBFF), ink: .galactic(0x101B4D), muted: .galactic(0x626D90), divider: .galactic(0xDEE4F4), primary: .galactic(0x4D6CFF), secondary: .galactic(0xB15BFF), tertiary: .galactic(0x5DD7E7), highlight: .galactic(0xFFD166), heroStart: .galactic(0xD7ECFF), heroMid: .galactic(0xE2D5FF), heroEnd: .galactic(0xFFE6B0), dockStart: .galactic(0xFFFFFF), dockEnd: .galactic(0xF2F3FF), dockIsDark: false, glassOpacity: 0.88)
        }
    }
}

enum GalacticLayoutStyle: String, CaseIterable, Identifiable {
    case airyGlass
    case softRounded
    case compactPro
    case crystalEdge
    case boldGlow

    static let storageKey = "galacticLayoutID"
    static let defaultLayout: GalacticLayoutStyle = .softRounded

    var id: String { rawValue }

    var name: String {
        switch self {
        case .airyGlass: "Airy Glass"
        case .softRounded: "Soft Rounded"
        case .compactPro: "Compact Pro"
        case .crystalEdge: "Crystal Edge"
        case .boldGlow: "Bold Glow"
        }
    }

    var subtitle: String {
        switch self {
        case .airyGlass: "More breathing room"
        case .softRounded: "Friendly iPhone feel"
        case .compactPro: "More data on screen"
        case .crystalEdge: "Sharper glass panels"
        case .boldGlow: "Bigger glow + depth"
        }
    }

    var icon: String {
        switch self {
        case .airyGlass: "rectangle.inset.filled"
        case .softRounded: "square.on.circle"
        case .compactPro: "rectangle.grid.2x2.fill"
        case .crystalEdge: "diamond.fill"
        case .boldGlow: "sparkles"
        }
    }

    var cardRadius: CGFloat {
        switch self {
        case .airyGlass: 26
        case .softRounded: 22
        case .compactPro: 16
        case .crystalEdge: 18
        case .boldGlow: 24
        }
    }

    var cardPadding: CGFloat {
        switch self {
        case .airyGlass: 20
        case .softRounded: 18
        case .compactPro: 14
        case .crystalEdge: 16
        case .boldGlow: 18
        }
    }

    var strokeWidth: CGFloat {
        switch self {
        case .airyGlass: 1.0
        case .softRounded: 1.15
        case .compactPro: 0.85
        case .crystalEdge: 1.4
        case .boldGlow: 1.3
        }
    }

    var shadowRadius: CGFloat {
        switch self {
        case .airyGlass: 16
        case .softRounded: 22
        case .compactPro: 10
        case .crystalEdge: 14
        case .boldGlow: 28
        }
    }
}

struct GalacticTheme {
    static var selectedOption: GalacticThemeOption {
        guard let raw = UserDefaults.standard.string(forKey: GalacticThemeOption.storageKey),
              let option = GalacticThemeOption(rawValue: raw) else {
            return GalacticThemeOption.defaultTheme
        }
        return option
    }

    static var selectedLayout: GalacticLayoutStyle {
        guard let raw = UserDefaults.standard.string(forKey: GalacticLayoutStyle.storageKey),
              let layout = GalacticLayoutStyle(rawValue: raw) else {
            return GalacticLayoutStyle.defaultLayout
        }
        return layout
    }

    static var palette: GalacticPalette { selectedOption.palette }

    static var navy: Color { palette.ink }
    static var deepBlue: Color { palette.heroMid }
    static var indigo: Color { palette.primary }
    static var violet: Color { palette.secondary }
    static var cyan: Color { palette.tertiary }
    static let green = Color(red: 0.02, green: 0.72, blue: 0.46)
    static let pink = Color(red: 0.98, green: 0.21, blue: 0.48)
    static let orange = Color(red: 1.00, green: 0.55, blue: 0.12)
    static var blue: Color { palette.primary }
    static var teal: Color { palette.tertiary }

    static var page: Color { palette.page }
    static var panel: Color { palette.panel }
    static var softPanel: Color { palette.softPanel }
    static var mutedText: Color { palette.muted }
    static var divider: Color { palette.divider }
    static var heroForeground: Color { selectedOption.usesDarkHeroText ? palette.ink : .white }
    static var heroMutedForeground: Color { heroForeground.opacity(selectedOption.usesDarkHeroText ? 0.62 : 0.70) }
    static var dockForeground: Color { palette.dockIsDark ? .white : palette.ink }
    static var dockSecondaryForeground: Color { dockForeground.opacity(palette.dockIsDark ? 0.64 : 0.58) }

    static var cardRadius: CGFloat { selectedLayout.cardRadius }
    static var cardPadding: CGFloat { selectedLayout.cardPadding }
    static var cardStrokeWidth: CGFloat { selectedLayout.strokeWidth }
    static var cardShadowRadius: CGFloat { selectedLayout.shadowRadius }

    static var heroGradient: LinearGradient {
        LinearGradient(
            colors: [palette.heroStart, palette.heroMid, palette.heroEnd],
            startPoint: .topLeading,
            endPoint: .bottomTrailing
        )
    }

    static var accentGradient: LinearGradient {
        LinearGradient(
            colors: [palette.primary, palette.secondary, palette.tertiary, palette.highlight],
            startPoint: .leading,
            endPoint: .trailing
        )
    }

    static var glassGradient: LinearGradient {
        LinearGradient(
            colors: [
                palette.panel.opacity(palette.glassOpacity),
                Color.white.opacity(max(0.76, palette.glassOpacity - 0.08)),
                palette.softPanel.opacity(min(0.98, palette.glassOpacity + 0.03))
            ],
            startPoint: .topLeading,
            endPoint: .bottomTrailing
        )
    }

    static var cardBorderGradient: LinearGradient {
        LinearGradient(
            colors: [
                Color.white.opacity(0.94),
                palette.highlight.opacity(0.26),
                palette.tertiary.opacity(0.20),
                palette.secondary.opacity(0.22)
            ],
            startPoint: .topLeading,
            endPoint: .bottomTrailing
        )
    }

    static var spaceGradient: LinearGradient {
        LinearGradient(
            colors: [
                palette.ink,
                palette.heroStart,
                palette.heroMid,
                palette.heroEnd
            ],
            startPoint: .topLeading,
            endPoint: .bottomTrailing
        )
    }

    static var sidebarGradient: LinearGradient {
        LinearGradient(
            colors: [palette.dockStart, palette.dockEnd],
            startPoint: .topLeading,
            endPoint: .bottomTrailing
        )
    }

    static var backgroundGlow: RadialGradient {
        RadialGradient(
            colors: [
                palette.highlight.opacity(0.16),
                palette.tertiary.opacity(0.13),
                palette.secondary.opacity(0.10),
                Color.clear
            ],
            center: .topTrailing,
            startRadius: 8,
            endRadius: 610
        )
    }
}

struct GalacticCard<Content: View>: View {
    let content: Content
    var padding: CGFloat?
    var radius: CGFloat?

    init(padding: CGFloat? = nil, radius: CGFloat? = nil, @ViewBuilder content: () -> Content) {
        self.padding = padding
        self.radius = radius
        self.content = content()
    }

    var body: some View {
        let resolvedRadius = radius ?? GalacticTheme.cardRadius
        let resolvedPadding = padding ?? GalacticTheme.cardPadding

        content
            .padding(resolvedPadding)
            .background {
                ZStack {
                    GalacticTheme.glassGradient

                    RadialGradient(
                        colors: [GalacticTheme.cyan.opacity(0.075), Color.clear],
                        center: .topTrailing,
                        startRadius: 0,
                        endRadius: 190
                    )

                    RadialGradient(
                        colors: [GalacticTheme.violet.opacity(0.060), GalacticTheme.palette.highlight.opacity(0.035), Color.clear],
                        center: .bottomLeading,
                        startRadius: 0,
                        endRadius: 180
                    )
                }
            }
            .clipShape(RoundedRectangle(cornerRadius: resolvedRadius, style: .continuous))
            .overlay {
                RoundedRectangle(cornerRadius: resolvedRadius, style: .continuous)
                    .stroke(GalacticTheme.cardBorderGradient, lineWidth: GalacticTheme.cardStrokeWidth)
            }
            .shadow(color: GalacticTheme.indigo.opacity(0.10), radius: GalacticTheme.cardShadowRadius, y: GalacticTheme.selectedLayout == .boldGlow ? 12 : 9)
            .shadow(color: GalacticTheme.palette.highlight.opacity(0.08), radius: GalacticTheme.selectedLayout == .boldGlow ? 14 : 7, y: 2)
    }
}

struct MetricTile: View {
    let title: String
    let value: String
    let subtitle: String
    let systemImage: String
    let tint: Color

    var body: some View {
        GalacticCard {
            HStack(alignment: .top, spacing: 13) {
                Image(systemName: systemImage)
                    .font(.subheadline.bold())
                    .symbolRenderingMode(.hierarchical)
                    .foregroundStyle(.white)
                    .frame(width: 42, height: 42)
                    .background {
                        RoundedRectangle(cornerRadius: 13, style: .continuous)
                            .fill(tint.gradient)
                    }
                    .overlay {
                        RoundedRectangle(cornerRadius: 13, style: .continuous)
                            .stroke(Color.white.opacity(0.34), lineWidth: 0.8)
                    }
                    .shadow(color: tint.opacity(0.30), radius: 10, y: 5)

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
            HStack(spacing: 7) {
                Circle()
                    .fill(GalacticTheme.accentGradient)
                    .frame(width: 7, height: 7)
                    .shadow(color: GalacticTheme.cyan.opacity(0.40), radius: 4)

                Text(title)
                    .font(.headline)
                    .foregroundStyle(GalacticTheme.navy)
            }

            Spacer()

            if let actionTitle, let action {
                Button(actionTitle, action: action)
                    .font(.caption.weight(.bold))
                    .foregroundStyle(GalacticTheme.indigo)
                    .padding(.horizontal, 10)
                    .padding(.vertical, 6)
                    .background(GalacticTheme.indigo.opacity(0.075))
                    .clipShape(Capsule())
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
