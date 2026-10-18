import AVFoundation
import CoreImage
import UIKit

/// Grabs one frame of a remote video through a hidden muted AVPlayer and `AVPlayerItemVideoOutput`.
/// `AVAssetImageGenerator` (what expo-video's thumbnails use) cannot read HLS streams.
internal final class VideoFrameGrabber {
  private let player = AVPlayer()
  private var output: AVPlayerItemVideoOutput?
  private var timer: Timer?
  private var completion: ((Result<URL, AttachmentBridgeException>) -> Void)?
  private var targetSeconds: Double = 0
  private var deadline = Date()
  private var outputDirectory: URL

  init(outputDirectory: URL) {
    self.outputDirectory = outputDirectory
  }

  /// Must be called on the main queue. Retains itself until `completion` runs.
  func grab(
    url: URL,
    seconds: Double,
    timeout: TimeInterval = 20,
    completion: @escaping (Result<URL, AttachmentBridgeException>) -> Void
  ) {
    self.completion = completion
    targetSeconds = max(0, seconds)
    deadline = Date().addingTimeInterval(timeout)

    let item = AVPlayerItem(url: url)
    let output = AVPlayerItemVideoOutput(pixelBufferAttributes: [
      kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA,
    ])
    item.add(output)
    self.output = output
    player.isMuted = true
    player.replaceCurrentItem(with: item)

    let target = CMTime(seconds: targetSeconds, preferredTimescale: 600)
    player.seek(to: target, toleranceBefore: .zero, toleranceAfter: .zero) { [weak self] _ in
      guard let self else { return }
      // A paused item may never deliver a buffer; a muted play() starts the pipeline.
      self.player.play()
      self.startPolling()
    }
  }

  private func startPolling() {
    timer = Timer.scheduledTimer(withTimeInterval: 0.1, repeats: true) { [weak self] _ in
      self?.poll()
    }
  }

  private func poll() {
    guard let item = player.currentItem, let output else { return }

    if item.status == .failed {
      finish(.failure(.frameCaptureFailed(item.error?.localizedDescription)))
      return
    }

    let itemTime = item.currentTime()

    // Accept the first frame at or after the target, so a stale pre-seek frame is never used.
    if itemTime.seconds >= targetSeconds - 0.05,
       output.hasNewPixelBuffer(forItemTime: itemTime),
       let buffer = output.copyPixelBuffer(forItemTime: itemTime, itemTimeForDisplay: nil) {
      do {
        finish(.success(try writeJPEG(buffer)))
      } catch {
        finish(.failure(.frameCaptureFailed(error.localizedDescription)))
      }
      return
    }

    if Date() > deadline {
      finish(.failure(.frameCaptureFailed("逾時")))
    }
  }

  private func writeJPEG(_ buffer: CVPixelBuffer) throws -> URL {
    let context = CIContext()
    let image = CIImage(cvPixelBuffer: buffer)
    guard let cgImage = context.createCGImage(image, from: image.extent),
          let data = UIImage(cgImage: cgImage).jpegData(compressionQuality: 0.95) else {
      throw AttachmentBridgeException.frameCaptureFailed("無法編碼影像")
    }
    try FileManager.default.createDirectory(at: outputDirectory, withIntermediateDirectories: true)
    let fileURL = outputDirectory.appendingPathComponent("frame-\(UUID().uuidString).jpg")
    try data.write(to: fileURL)
    return fileURL
  }

  private func finish(_ result: Result<URL, AttachmentBridgeException>) {
    guard let completion else { return }
    self.completion = nil
    timer?.invalidate()
    timer = nil
    player.pause()
    player.replaceCurrentItem(with: nil)
    output = nil
    completion(result)
  }
}
