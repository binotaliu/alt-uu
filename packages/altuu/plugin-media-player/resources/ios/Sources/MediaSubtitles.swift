import Foundation

// MARK: - WebVTT

/// AVPlayer cannot side-load an external WebVTT file for a progressive
/// (mp4/mp3) source, so the iOS element parses the file itself and draws the
/// active cue over the video (see `NativeVideoOverlays`). Android hands the URL
/// to Media3 instead, which renders it natively.
struct SubtitleCue: Equatable {
    let start: Double
    let end: Double
    let text: String
}

enum WebVTTParser {

    static func parse(_ source: String) -> [SubtitleCue] {
        let normalized = source
            .replacingOccurrences(of: "\r\n", with: "\n")
            .replacingOccurrences(of: "\r", with: "\n")
        var cues: [SubtitleCue] = []

        for block in normalized.components(separatedBy: "\n\n") {
            let lines = block.components(separatedBy: "\n").filter { !$0.isEmpty }

            guard let timingIndex = lines.firstIndex(where: { $0.contains("-->") }) else {
                continue
            }

            let bounds = lines[timingIndex].components(separatedBy: "-->")

            guard bounds.count == 2,
                  let start = seconds(from: bounds[0]),
                  let end = seconds(from: bounds[1]) else {
                continue
            }

            let text = lines[(timingIndex + 1)...]
                .joined(separator: "\n")
                .replacingOccurrences(of: "<[^>]+>", with: "", options: .regularExpression)
                .trimmingCharacters(in: .whitespacesAndNewlines)

            if !text.isEmpty {
                cues.append(SubtitleCue(start: start, end: end, text: text))
            }
        }

        return cues.sorted { $0.start < $1.start }
    }

    /// `hh:mm:ss.mmm` or `mm:ss.mmm`, optionally followed by cue settings.
    static func seconds(from token: String) -> Double? {
        let stamp = token.trimmingCharacters(in: .whitespaces).components(separatedBy: " ").first ?? ""
        let parts = stamp.replacingOccurrences(of: ",", with: ".").components(separatedBy: ":")

        guard parts.count == 2 || parts.count == 3 else {
            return nil
        }

        let numbers = parts.compactMap(Double.init)

        guard numbers.count == parts.count else {
            return nil
        }

        return numbers.reduce(0) { $0 * 60 + $1 }
    }

    static func cue(at time: Double, in cues: [SubtitleCue]) -> SubtitleCue? {
        cues.first { time >= $0.start && time < $0.end }
    }

    static func load(from url: URL) async -> [SubtitleCue] {
        guard let (data, _) = try? await URLSession.shared.data(from: url),
              let text = String(data: data, encoding: .utf8) else {
            return []
        }

        return parse(text)
    }
}
