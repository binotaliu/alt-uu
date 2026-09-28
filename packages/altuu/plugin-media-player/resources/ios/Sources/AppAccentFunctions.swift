import Foundation
import SwiftUI
import UIKit

// MARK: - Accent palette

/// Mirrors the accent list in `resources/js/lib/accents.ts` and the `html[data-accent]` palettes in
/// `resources/css/app.css`. Keep the three in sync. Light mode uses the accent's theme-600 shade and
/// dark mode uses theme-400, converted from OKLCH to sRGB.
final class AccentPalette: ObservableObject {
    static let shared = AccentPalette()

    static let defaultAccentId = "warm"

    private static let colors: [String: (light: (Double, Double, Double), dark: (Double, Double, Double))] = [
        "warm": ((0.857, 0.409, 0.298), (1.000, 0.637, 0.509)),
        "ocean": ((0.000, 0.609, 0.865), (0.375, 0.799, 0.988)),
        "forest": ((0.292, 0.652, 0.319), (0.512, 0.830, 0.582)),
        "purple": ((0.591, 0.477, 0.878), (0.790, 0.674, 1.000)),
        "pink": ((0.885, 0.308, 0.636), (1.000, 0.562, 0.793)),
        "red": ((0.894, 0.360, 0.370), (1.000, 0.595, 0.569)),
        "grey": ((0.535, 0.565, 0.597), (0.722, 0.747, 0.774)),
    ]

    @Published private(set) var accentId: String = AccentPalette.defaultAccentId

    static func isKnown(_ id: String) -> Bool {
        colors[id] != nil
    }

    /// Publishes changes to SwiftUI observers, so call it on the main thread.
    func setAccent(_ id: String) {
        guard AccentPalette.isKnown(id) else {
            return
        }

        accentId = id
    }

    /// A dynamic color that follows the trait collection's light/dark style.
    static func uiColor(for id: String) -> UIColor {
        let pair = colors[id] ?? colors[defaultAccentId]!

        return UIColor { traits in
            let rgb = traits.userInterfaceStyle == .dark ? pair.dark : pair.light
            return UIColor(red: rgb.0, green: rgb.1, blue: rgb.2, alpha: 1)
        }
    }

    /// A fixed color for SwiftUI views that already resolve their own color scheme.
    static func color(for id: String, isDark: Bool) -> Color {
        let pair = colors[id] ?? colors[defaultAccentId]!
        let rgb = isDark ? pair.dark : pair.light

        return Color(red: rgb.0, green: rgb.1, blue: rgb.2)
    }
}

// MARK: - Bridge functions

enum AppAccentFunctions {

    /// Sets the app-wide iOS tint (text selection handles, caret, native controls, alerts, etc.)
    /// and the accent used by the native media player.
    class SetColor: BridgeFunction {
        func execute(parameters: [String: Any]) throws -> [String: Any] {
            guard let accent = parameters["accent"] as? String else {
                throw NSError(domain: "AppAccent", code: 422, userInfo: [NSLocalizedDescriptionKey: "Missing accent parameter"])
            }

            guard AccentPalette.isKnown(accent) else {
                throw NSError(domain: "AppAccent", code: 422, userInfo: [NSLocalizedDescriptionKey: "Unknown accent: \(accent)"])
            }

            DispatchQueue.main.async {
                AccentPalette.shared.setAccent(accent)

                let tint = AccentPalette.uiColor(for: accent)

                UIApplication.shared.connectedScenes
                    .compactMap { $0 as? UIWindowScene }
                    .flatMap { $0.windows }
                    .forEach { $0.tintColor = tint }
            }

            return BridgeResponse.success(data: [
                "status": "accent_set",
                "accent": accent,
            ])
        }
    }
}
