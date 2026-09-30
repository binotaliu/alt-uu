import AVFoundation
import CoreImage
import UIKit

// MARK: - Frame Capture Bridge Function

extension MediaPlayerFunctions {

    class CaptureFrame: BridgeFunction {
        func execute(parameters: [String: Any]) throws -> [String: Any] {
            // Legacy callers pass studentId; the element's `watermark` prop is the fallback.
            let manager = MediaPlayerManager.shared
            let passedId = (parameters["studentId"] as? String).flatMap { $0.isEmpty ? nil : $0 }

            guard let studentId = passedId ?? manager.watermarkText, !studentId.isEmpty else {
                throw NSError(domain: "MediaPlayer", code: 422, userInfo: [NSLocalizedDescriptionKey: "Missing studentId parameter"])
            }

            let courseName = (parameters["courseName"] as? String) ?? manager.currentCourseNameValue
            let materialName = (parameters["materialName"] as? String) ?? manager.currentMaterialNameValue

            let capture = {
                MediaFrameCapture.captureAndShare(
                    studentId: studentId,
                    courseName: courseName,
                    materialName: materialName
                )
            }

            let result: MediaFrameCapture.Result
            if Thread.isMainThread {
                result = capture()
            } else {
                result = DispatchQueue.main.sync(execute: capture)
            }

            switch result {
            case .success(let seconds):
                return BridgeResponse.success(data: [
                    "status": "captured",
                    "time": seconds,
                ])
            case .failure(let reason):
                throw NSError(domain: "MediaPlayer", code: 500, userInfo: [NSLocalizedDescriptionKey: reason])
            }
        }
    }
}

// MARK: - Capture, watermark and share

enum MediaFrameCapture {

    enum Result {
        case success(seconds: Double)
        case failure(String)
    }

    static let disclaimer = "此截圖僅供個人保存學術使用，請遵循合理使用原則，合法使用教材，遵守智慧財產權。此截圖由 Alt UU 產生。"

    private static let ciContext = CIContext()

    /// Must run on the main thread.
    static func captureAndShare(studentId: String, courseName: String?, materialName: String?) -> Result {
        let manager = MediaPlayerManager.shared

        guard let frame = manager.copyCurrentVideoFrame() else {
            return .failure("目前沒有可擷取的影片畫面")
        }

        let watermarked = compose(
            frame: frame.image,
            studentId: studentId,
            courseName: courseName,
            materialName: materialName,
            seconds: frame.seconds
        )

        guard let data = watermarked.jpegData(compressionQuality: 0.9) else {
            return .failure("無法產生截圖")
        }

        guard let fileURL = write(data: data, materialName: materialName, seconds: frame.seconds) else {
            return .failure("無法儲存截圖")
        }

        guard let presenter = topViewController() else {
            return .failure("無法顯示分享選單")
        }

        let activity = UIActivityViewController(activityItems: [fileURL], applicationActivities: nil)

        if let popover = activity.popoverPresentationController {
            popover.sourceView = presenter.view
            popover.sourceRect = CGRect(x: presenter.view.bounds.midX, y: presenter.view.bounds.midY, width: 1, height: 1)
            popover.permittedArrowDirections = []
        }

        presenter.present(activity, animated: true)

        return .success(seconds: frame.seconds)
    }

    // MARK: Composition

    static func timestampLabel(_ seconds: Double) -> String {
        let total = max(0, Int(seconds.rounded(.down)))

        return String(format: "%02d:%02d:%02d", total / 3600, (total % 3600) / 60, total % 60)
    }

    private static func compose(frame: CGImage, studentId: String, courseName: String?, materialName: String?, seconds: Double) -> UIImage {
        let width = CGFloat(frame.width)
        let height = CGFloat(frame.height)

        let footerFontSize = max(14, width / 55)
        let padding = footerFontSize * 0.8

        let titleParts = [courseName, materialName].compactMap { $0 }.filter { !$0.isEmpty }
        let titleLine = titleParts.joined(separator: " · ")
        let infoLine = titleLine.isEmpty
            ? timestampLabel(seconds)
            : "\(titleLine)  \(timestampLabel(seconds))"

        let infoAttributes: [NSAttributedString.Key: Any] = [
            .font: UIFont.systemFont(ofSize: footerFontSize, weight: .semibold),
            .foregroundColor: UIColor.white,
        ]
        let disclaimerAttributes: [NSAttributedString.Key: Any] = [
            .font: UIFont.systemFont(ofSize: footerFontSize * 0.8),
            .foregroundColor: UIColor(white: 1, alpha: 0.75),
        ]

        let textWidth = width - padding * 2
        let measure = { (text: String, attributes: [NSAttributedString.Key: Any]) -> CGFloat in
            ceil((text as NSString).boundingRect(
                with: CGSize(width: textWidth, height: .greatestFiniteMagnitude),
                options: [.usesLineFragmentOrigin, .usesFontLeading],
                attributes: attributes,
                context: nil
            ).height)
        }

        let infoHeight = measure(infoLine, infoAttributes)
        let disclaimerHeight = measure(disclaimer, disclaimerAttributes)
        let footerHeight = padding * 2 + infoHeight + padding * 0.4 + disclaimerHeight

        let format = UIGraphicsImageRendererFormat()
        format.scale = 1
        format.opaque = true

        let renderer = UIGraphicsImageRenderer(size: CGSize(width: width, height: height + footerHeight), format: format)

        return renderer.image { context in
            let cg = context.cgContext

            UIImage(cgImage: frame).draw(in: CGRect(x: 0, y: 0, width: width, height: height))

            drawWatermarks(studentId: studentId, in: CGRect(x: 0, y: 0, width: width, height: height), context: cg)

            UIColor(white: 0.08, alpha: 1).setFill()
            cg.fill(CGRect(x: 0, y: height, width: width, height: footerHeight))

            var y = height + padding
            (infoLine as NSString).draw(
                with: CGRect(x: padding, y: y, width: textWidth, height: infoHeight),
                options: [.usesLineFragmentOrigin, .usesFontLeading],
                attributes: infoAttributes,
                context: nil
            )

            y += infoHeight + padding * 0.4
            (disclaimer as NSString).draw(
                with: CGRect(x: padding, y: y, width: textWidth, height: disclaimerHeight),
                options: [.usesLineFragmentOrigin, .usesFontLeading],
                attributes: disclaimerAttributes,
                context: nil
            )
        }
    }

    /// Draws the student ID at a handful of random positions and angles so it can't be
    /// removed by a single crop.
    private static func drawWatermarks(studentId: String, in rect: CGRect, context: CGContext) {
        let fontSize = max(11, rect.width / 60)

        let shadow = NSShadow()
        shadow.shadowColor = UIColor(white: 0, alpha: 0.35)
        shadow.shadowBlurRadius = fontSize * 0.08
        shadow.shadowOffset = CGSize(width: 0, height: fontSize * 0.04)

        let attributes: [NSAttributedString.Key: Any] = [
            .font: UIFont.systemFont(ofSize: fontSize, weight: .semibold),
            .foregroundColor: UIColor(white: 1, alpha: 0.22),
            .shadow: shadow,
        ]

        let textSize = (studentId as NSString).size(withAttributes: attributes)
        let count = Int.random(in: 4...6)

        for index in 0..<count {
            // One watermark per horizontal band keeps them spread out while the
            // exact position and angle within each band stay random.
            let bandHeight = rect.height / CGFloat(count)
            let centerX = CGFloat.random(in: (textSize.width / 2)...(max(textSize.width / 2, rect.width - textSize.width / 2)))
            let centerY = rect.minY + bandHeight * (CGFloat(index) + CGFloat.random(in: 0.2...0.8))
            let angle = CGFloat.random(in: -0.5...0.5)

            context.saveGState()
            context.translateBy(x: centerX, y: centerY)
            context.rotate(by: angle)
            (studentId as NSString).draw(
                at: CGPoint(x: -textSize.width / 2, y: -textSize.height / 2),
                withAttributes: attributes
            )
            context.restoreGState()
        }
    }

    // MARK: File output

    private static func write(data: Data, materialName: String?, seconds: Double) -> URL? {
        let directory = FileManager.default.temporaryDirectory.appendingPathComponent("AltUUCaptures", isDirectory: true)

        do {
            try? FileManager.default.removeItem(at: directory)
            try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)

            let invalid = CharacterSet(charactersIn: "/\\:?%*|\"<>").union(.newlines)
            let safeName = (materialName ?? "")
                .components(separatedBy: invalid)
                .joined(separator: "_")
                .trimmingCharacters(in: .whitespaces)
            let prefix = safeName.isEmpty ? "AltUU" : String(safeName.prefix(40))
            let stamp = timestampLabel(seconds).replacingOccurrences(of: ":", with: "-")
            let fileURL = directory.appendingPathComponent("\(prefix)_\(stamp).jpg")

            try data.write(to: fileURL, options: .atomic)

            return fileURL
        } catch {
            DebugLogger.shared.log("[MediaPlayer] Failed to write capture: \(error.localizedDescription)")

            return nil
        }
    }

    // MARK: Presenter

    private static func topViewController(base: UIViewController? = nil) -> UIViewController? {
        let root = base ?? UIApplication.shared
            .connectedScenes
            .compactMap { $0 as? UIWindowScene }
            .flatMap { $0.windows }
            .first(where: { $0.isKeyWindow })?
            .rootViewController

        if let navigation = root as? UINavigationController {
            return topViewController(base: navigation.visibleViewController) ?? navigation
        }

        if let tab = root as? UITabBarController {
            return topViewController(base: tab.selectedViewController) ?? tab
        }

        if let presented = root?.presentedViewController {
            return topViewController(base: presented)
        }

        return root
    }

    // MARK: Pixel buffer conversion

    static func makeImage(from pixelBuffer: CVPixelBuffer) -> CGImage? {
        let image = CIImage(cvPixelBuffer: pixelBuffer)

        return ciContext.createCGImage(image, from: image.extent)
    }
}

// MARK: - Manager frame access

extension MediaPlayerManager {

    /// Copies the frame currently on screen. Prefers the `AVPlayerItemVideoOutput`
    /// (works with HLS); falls back to `AVAssetImageGenerator` for progressive files.
    func copyCurrentVideoFrame() -> (image: CGImage, seconds: Double)? {
        guard let item = getPlayer()?.currentItem else {
            return nil
        }

        let itemTime = item.currentTime()
        let seconds = itemTime.seconds.isFinite ? itemTime.seconds : 0

        if let output = videoOutput,
           let buffer = output.copyPixelBuffer(forItemTime: itemTime, itemTimeForDisplay: nil),
           let image = MediaFrameCapture.makeImage(from: buffer) {
            return (image, seconds)
        }

        let generator = AVAssetImageGenerator(asset: item.asset)
        generator.appliesPreferredTrackTransform = true
        generator.requestedTimeToleranceBefore = .zero
        generator.requestedTimeToleranceAfter = .zero

        if let image = try? generator.copyCGImage(at: itemTime, actualTime: nil) {
            return (image, seconds)
        }

        return nil
    }
}
