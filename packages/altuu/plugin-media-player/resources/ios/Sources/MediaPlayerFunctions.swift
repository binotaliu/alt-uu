import Foundation
import AVKit
import UIKit
import MediaPlayer

// MARK: - Media Player Bridge Functions

enum MediaPlayerFunctions {

    private static func parseSessionContext(from parameters: [String: Any]) -> MediaPlayerSessionContext? {
        guard let contextDict = parameters["sessionContext"] as? [String: Any] else {
            return nil
        }

        return MediaPlayerSessionContext(
            routePath: contextDict["routePath"] as? String,
            cid: contextDict["cid"] as? String,
            activityId: contextDict["activityId"] as? String,
            href: contextDict["href"] as? String,
            startedAt: contextDict["startedAt"] as? String
        )
    }

    class SetPlayer: BridgeFunction {
        func execute(parameters: [String: Any]) throws -> [String: Any] {
            guard let url = parameters["url"] as? String else {
                throw NSError(domain: "MediaPlayer", code: 422, userInfo: [NSLocalizedDescriptionKey: "Missing url parameter"])
            }

            guard let type = parameters["type"] as? String else {
                throw NSError(domain: "MediaPlayer", code: 422, userInfo: [NSLocalizedDescriptionKey: "Missing type parameter"])
            }

            guard let frameDict = parameters["frame"] as? [String: Any] else {
                throw NSError(domain: "MediaPlayer", code: 422, userInfo: [NSLocalizedDescriptionKey: "Missing frame parameter"])
            }

            let frame = MediaPlayerFrame(
                x: (frameDict["x"] as? NSNumber)?.doubleValue ?? 0,
                y: (frameDict["y"] as? NSNumber)?.doubleValue ?? 0,
                width: (frameDict["width"] as? NSNumber)?.doubleValue ?? 320,
                height: (frameDict["height"] as? NSNumber)?.doubleValue ?? 200
            )

            let courseName = parameters["courseName"] as? String
            let materialName = parameters["materialName"] as? String
            let appearance = parameters["appearance"] as? String
            let sessionContext = MediaPlayerFunctions.parseSessionContext(from: parameters)

            // Get NativeUIState and update it
            DispatchQueue.main.async {
                NativeUIState.shared.updateMediaPlayer(url: url, type: type, frame: frame, courseName: courseName, materialName: materialName, appearance: appearance, sessionContext: sessionContext)
                MediaPlayerManager.shared.setPlayer(url: url, type: type, frame: frame, courseName: courseName, materialName: materialName, appearance: appearance, sessionContext: sessionContext)
            }

            return BridgeResponse.success(data: [
                "status": "player_set",
                "url": url,
                "type": type,
                "frame": [
                    "x": frame.x,
                    "y": frame.y,
                    "width": frame.width,
                    "height": frame.height,
                ],
            ])
        }
    }

    class Play: BridgeFunction {
        func execute(parameters: [String: Any]) throws -> [String: Any] {
            DispatchQueue.main.async {
                MediaPlayerManager.shared.play()
            }

            return BridgeResponse.success(data: [
                "status": "playing",
            ])
        }
    }

    class Pause: BridgeFunction {
        func execute(parameters: [String: Any]) throws -> [String: Any] {
            DispatchQueue.main.async {
                MediaPlayerManager.shared.pause()
            }

            return BridgeResponse.success(data: [
                "status": "paused",
            ])
        }
    }

    class Stop: BridgeFunction {
        func execute(parameters: [String: Any]) throws -> [String: Any] {
            DispatchQueue.main.async {
                MediaPlayerManager.shared.stop()
            }

            return BridgeResponse.success(data: [
                "status": "stopped",
            ])
        }
    }

    class Seek: BridgeFunction {
        func execute(parameters: [String: Any]) throws -> [String: Any] {
            guard let time = parameters["time"] as? NSNumber else {
                throw NSError(domain: "MediaPlayer", code: 422, userInfo: [NSLocalizedDescriptionKey: "Missing time parameter"])
            }

            let seekTime = CMTime(seconds: time.doubleValue, preferredTimescale: 1000)

            DispatchQueue.main.async {
                MediaPlayerManager.shared.seek(to: seekTime)
            }

            return BridgeResponse.success(data: [
                "status": "seeking",
                "time": time.doubleValue,
            ])
        }
    }

    class GetCurrentTime: BridgeFunction {
        func execute(parameters: [String: Any]) throws -> [String: Any] {
            let currentTime = MediaPlayerManager.shared.getCurrentTime()

            return BridgeResponse.success(data: [
                "time": currentTime,
            ])
        }
    }

    class SetPlaybackRate: BridgeFunction {
        func execute(parameters: [String: Any]) throws -> [String: Any] {
            guard let rateNumber = parameters["rate"] as? NSNumber else {
                throw NSError(domain: "MediaPlayer", code: 422, userInfo: [NSLocalizedDescriptionKey: "Missing rate parameter"])
            }

            let rate = Float(rateNumber.floatValue)

            DispatchQueue.main.async {
                MediaPlayerManager.shared.setPlaybackRate(rate)
            }

            return BridgeResponse.success(data: [
                "status": "rate_set",
                "rate": rate,
            ])
        }
    }

    class GetPlaybackRate: BridgeFunction {
        func execute(parameters: [String: Any]) throws -> [String: Any] {
            let currentRate = MediaPlayerManager.shared.getPlaybackRate()

            return BridgeResponse.success(data: [
                "rate": currentRate,
            ])
        }
    }

    class GetState: BridgeFunction {
        func execute(parameters: [String: Any]) throws -> [String: Any] {
            BridgeResponse.success(data: MediaPlayerManager.shared.getState())
        }
    }
}

// MARK: - Media Player Manager (Singleton)

class MediaPlayerManager: NSObject {
    static let shared = MediaPlayerManager()

    private static let skipIntervalSeconds: NSNumber = 10

    private var player: AVPlayer?
    private var playerViewController: AVPlayerViewController?
    private var nowPlayingSession: MPNowPlayingSession?
    private var currentURL: URL?
    private var currentType: String = "audio"

    private var currentCourseName: String?
    private var currentMaterialName: String?
    private var currentSessionContext: MediaPlayerSessionContext?
    private var playbackRate: Float = 1.0
    private var nowPlayingTimeObserverToken: Any?
    private var nowPlayingTimeObserverPlayer: AVPlayer?

    override private init() {
        super.init()

        configureAudioSession()
        setupRemoteCommandCenter()

        NotificationCenter.default.addObserver(self,
                                               selector: #selector(handleAppDidEnterBackground),
                                               name: UIApplication.didEnterBackgroundNotification,
                                               object: nil)
    }

    private func configureAudioSession() {
        let session = AVAudioSession.sharedInstance()

        do {
            try session.setCategory(.playback,
                                     mode: .default,
                                     options: [.allowAirPlay])
            try session.setActive(true, options: .notifyOthersOnDeactivation)
            DebugLogger.shared.log("[MediaPlayer] Audio session configured for background playback and PiP")
        } catch {
            DebugLogger.shared.log("[MediaPlayer] Failed to configure AVAudioSession: \(error.localizedDescription)")
        }
    }

    @available(iOS 16.0, *)
    private func setupNowPlayingSession() {
        guard let player = player else {
            return
        }

        nowPlayingSession = MPNowPlayingSession(players: [player])
        nowPlayingSession?.automaticallyPublishesNowPlayingInfo = false
        setupRemoteCommandCenter(nowPlayingSession?.remoteCommandCenter)
        nowPlayingSession?.becomeActiveIfPossible { [weak self] success in
            DebugLogger.shared.log("[MediaPlayer] MPNowPlayingSession becomeActiveIfPossible: \(success)")
            if success {
                // Write metadata only AFTER session is active, otherwise Lock Screen ignores it
                DispatchQueue.main.async {
                    self?.updateNowPlayingInfo()
                }
            } else {
                DebugLogger.shared.log("[MediaPlayer] MPNowPlayingSession could not become active — falling back to default center")
                DispatchQueue.main.async {
                    self?.updateNowPlayingInfoFallback()
                }
            }
        }
    }

    func registerPlayerViewController(_ controller: AVPlayerViewController) {
        playerViewController = controller
        controller.allowsPictureInPicturePlayback = true
        if #available(iOS 15.0, *) {
            controller.canStartPictureInPictureAutomaticallyFromInline = true
        }

        if let existingPlayer = player {
            controller.player = existingPlayer
        }
    }

    func setPlayer(url: String, type: String, frame: MediaPlayerFrame, courseName: String? = nil, materialName: String? = nil, appearance: String? = nil, sessionContext: MediaPlayerSessionContext? = nil) {
        guard let sourceURL = URL(string: url) else {
            DebugLogger.shared.log("[MediaPlayer] Invalid URL: \(url)")
            return
        }

        configureAudioSession()

        let normalizedType = type.lowercased()
        let isSameSource = currentURL == sourceURL && currentType == normalizedType && player != nil

        self.currentType = normalizedType
        self.currentCourseName = courseName
        self.currentMaterialName = materialName
        self.currentSessionContext = sessionContext
        if isSameSource {
            if let existingPlayer = player, playerViewController?.player !== existingPlayer {
                playerViewController?.player = existingPlayer
            }

            DispatchQueue.main.async {
                NativeUIState.shared.updateMediaPlayer(url: url, type: type, frame: frame, courseName: courseName, materialName: materialName, appearance: appearance, sessionContext: sessionContext)
            }

            updateNowPlayingInfo()
            DebugLogger.shared.log("[MediaPlayer] Reused existing player for \(type): \(url)")
            return
        }

        removeNowPlayingInfoTimeObserver()
        clearNowPlayingSession()

        let asset = AVAsset(url: sourceURL)
        let playerItem = AVPlayerItem(asset: asset)
        let player = AVPlayer(playerItem: playerItem)

        self.player = player
        self.currentURL = sourceURL

        if playerViewController?.player !== player {
            playerViewController?.player = player
        }

        installNowPlayingInfoTimeObserver()

        if #available(iOS 16.0, *) {
            setupNowPlayingSession()  // metadata is written inside becomeActiveIfPossible callback
        } else {
            updateNowPlayingInfoFallback()
        }

        // Store player and frame info for UI to use
        DispatchQueue.main.async {
            NativeUIState.shared.updateMediaPlayer(url: url, type: type, frame: frame, courseName: courseName, materialName: materialName, appearance: appearance, sessionContext: sessionContext)
        }

        DebugLogger.shared.log("[MediaPlayer] Player set for \(type): \(url) (appearance: \(appearance ?? "system"), route: \(sessionContext?.routePath ?? "nil"))")
    }

    func play() {
        guard let player = player else {
            return
        }

        let rateToUse = playbackRate <= 0 ? 1.0 : playbackRate
        if #available(iOS 16.0, *) {
            player.defaultRate = rateToUse
        }

        if player.timeControlStatus == .playing {
            if player.rate != rateToUse {
                player.rate = rateToUse
            }
        } else {
            player.play()
        }

        updateNowPlayingInfo()
        DebugLogger.shared.log("[MediaPlayer] Playing at rate=\(rateToUse)")
    }

    func pause() {
        player?.pause()
        updateNowPlayingInfo()
        DebugLogger.shared.log("[MediaPlayer] Paused")
    }

    func stop() {
        removeNowPlayingInfoTimeObserver()

        player?.pause()
        player?.seek(to: .zero)
        playerViewController?.player = nil
        player = nil
        currentURL = nil
        currentSessionContext = nil

        clearNowPlayingSession()

        DispatchQueue.main.async {
            NativeUIState.shared.clearMediaPlayer()
        }
        DebugLogger.shared.log("[MediaPlayer] Stopped")
    }

    func seek(to time: CMTime) {
        player?.seek(to: time)
        updateNowPlayingInfo()
        DebugLogger.shared.log("[MediaPlayer] Seeking to \(time.seconds)s")
    }

    func startPictureInPictureIfNeeded() {
        guard currentType == "video" else {
            return
        }

        guard let controller = playerViewController,
              controller.allowsPictureInPicturePlayback else {
            DebugLogger.shared.log("[MediaPlayer] PiP not supported or controller unavailable")
            return
        }

        if #available(iOS 15.0, *) {
            controller.canStartPictureInPictureAutomaticallyFromInline = true
        }

        DebugLogger.shared.log("[MediaPlayer] Picture-in-Picture already active or not possible yet")
    }

    @objc private func handleAppDidEnterBackground() {
        startPictureInPictureIfNeeded()
    }

    private func setupRemoteCommandCenter() {
        setupRemoteCommandCenter(MPRemoteCommandCenter.shared())
    }

    private func setupRemoteCommandCenter(_ commandCenter: MPRemoteCommandCenter?) {
        guard let commandCenter = commandCenter else {
            return
        }

        commandCenter.playCommand.removeTarget(nil)
        commandCenter.pauseCommand.removeTarget(nil)
        commandCenter.togglePlayPauseCommand.removeTarget(nil)
        commandCenter.skipForwardCommand.removeTarget(nil)
        commandCenter.skipBackwardCommand.removeTarget(nil)
        commandCenter.nextTrackCommand.removeTarget(nil)
        commandCenter.previousTrackCommand.removeTarget(nil)

        commandCenter.playCommand.isEnabled = true
        commandCenter.pauseCommand.isEnabled = true
        commandCenter.togglePlayPauseCommand.isEnabled = true
        commandCenter.skipForwardCommand.isEnabled = true
        commandCenter.skipBackwardCommand.isEnabled = true
        commandCenter.skipForwardCommand.preferredIntervals = [Self.skipIntervalSeconds]
        commandCenter.skipBackwardCommand.preferredIntervals = [Self.skipIntervalSeconds]
        commandCenter.nextTrackCommand.isEnabled = false
        commandCenter.previousTrackCommand.isEnabled = false

        commandCenter.playCommand.addTarget { [weak self] _ in
            self?.play()
            return .success
        }

        commandCenter.pauseCommand.addTarget { [weak self] _ in
            self?.pause()
            return .success
        }

        commandCenter.togglePlayPauseCommand.addTarget { [weak self] _ in
            guard let player = self?.player else {
                return .commandFailed
            }

            if player.timeControlStatus == .playing {
                self?.pause()
            } else {
                self?.play()
            }

            return .success
        }

        commandCenter.skipForwardCommand.addTarget { [weak self] _ in
            guard let self = self else {
                return .commandFailed
            }

            self.skip(by: 10)
            return .success
        }

        commandCenter.skipBackwardCommand.addTarget { [weak self] _ in
            guard let self = self else {
                return .commandFailed
            }

            self.skip(by: -10)
            return .success
        }
    }

    private func installNowPlayingInfoTimeObserver() {
        guard let player = player else {
            return
        }

        removeNowPlayingInfoTimeObserver()

        let interval = CMTime(seconds: 1, preferredTimescale: 1)
        nowPlayingTimeObserverPlayer = player
        nowPlayingTimeObserverToken = player.addPeriodicTimeObserver(forInterval: interval, queue: .main) { [weak self] _ in
            guard let self = self else {
                return
            }

            self.updateNowPlayingInfo()
        }
    }

    private func removeNowPlayingInfoTimeObserver() {
        guard let token = nowPlayingTimeObserverToken, let observerPlayer = nowPlayingTimeObserverPlayer else {
            nowPlayingTimeObserverToken = nil
            nowPlayingTimeObserverPlayer = nil
            return
        }

        observerPlayer.removeTimeObserver(token)
        nowPlayingTimeObserverToken = nil
        nowPlayingTimeObserverPlayer = nil
    }

    private func clearNowPlayingSession() {
        if #available(iOS 16.0, *) {
            nowPlayingSession?.nowPlayingInfoCenter.nowPlayingInfo = nil
            nowPlayingSession = nil
        }

        MPNowPlayingInfoCenter.default().nowPlayingInfo = nil
    }

    /// Write now-playing metadata to the correct info center.
    /// When an MPNowPlayingSession is active (iOS 16+) use its dedicated
    /// nowPlayingInfoCenter; otherwise fall back to the global default center.
    private func updateNowPlayingInfo(courseName: String? = nil, materialName: String? = nil) {
        guard let player = player else {
            return
        }

        let infoCenter: MPNowPlayingInfoCenter
        if #available(iOS 16.0, *), let session = nowPlayingSession {
            infoCenter = session.nowPlayingInfoCenter
        } else {
            infoCenter = MPNowPlayingInfoCenter.default()
        }

        let title = materialName ?? currentMaterialName
        let album = courseName ?? currentCourseName

        var nowPlayingInfo: [String: Any] = infoCenter.nowPlayingInfo ?? [:]

        if let title = title, !title.isEmpty {
            nowPlayingInfo[MPMediaItemPropertyTitle] = title
        }

        if let album = album, !album.isEmpty {
            nowPlayingInfo[MPMediaItemPropertyAlbumTitle] = album
        }

        if let duration = player.currentItem?.duration.seconds, duration.isFinite && duration > 0 {
            nowPlayingInfo[MPMediaItemPropertyPlaybackDuration] = duration
        }

        nowPlayingInfo[MPNowPlayingInfoPropertyElapsedPlaybackTime] = player.currentTime().seconds
        nowPlayingInfo[MPNowPlayingInfoPropertyPlaybackRate] = player.rate
        nowPlayingInfo[MPNowPlayingInfoPropertyDefaultPlaybackRate] = 1.0

        infoCenter.nowPlayingInfo = nowPlayingInfo
    }

    /// iOS < 16 fallback: write directly to MPNowPlayingInfoCenter.default().
    private func updateNowPlayingInfoFallback() {
        guard let player = player else {
            return
        }

        let title = currentMaterialName
        let album = currentCourseName

        var nowPlayingInfo: [String: Any] = MPNowPlayingInfoCenter.default().nowPlayingInfo ?? [:]

        if let title = title, !title.isEmpty {
            nowPlayingInfo[MPMediaItemPropertyTitle] = title
        }

        if let album = album, !album.isEmpty {
            nowPlayingInfo[MPMediaItemPropertyAlbumTitle] = album
        }

        if let duration = player.currentItem?.duration.seconds, duration.isFinite && duration > 0 {
            nowPlayingInfo[MPMediaItemPropertyPlaybackDuration] = duration
        }

        nowPlayingInfo[MPNowPlayingInfoPropertyElapsedPlaybackTime] = player.currentTime().seconds
        nowPlayingInfo[MPNowPlayingInfoPropertyPlaybackRate] = player.rate
        nowPlayingInfo[MPNowPlayingInfoPropertyDefaultPlaybackRate] = 1.0

        MPNowPlayingInfoCenter.default().nowPlayingInfo = nowPlayingInfo
    }

    private func skip(by delta: Double) {
        guard let player = player else {
            return
        }

        let currentSeconds = player.currentTime().seconds
        guard currentSeconds.isFinite else {
            return
        }

        let durationSeconds = player.currentItem?.duration.seconds
        var targetSeconds = max(0, currentSeconds + delta)

        if let durationSeconds, durationSeconds.isFinite, durationSeconds > 0 {
            targetSeconds = min(targetSeconds, durationSeconds)
        }

        seek(to: CMTime(seconds: targetSeconds, preferredTimescale: 1000))
    }

    func getPlayer() -> AVPlayer? {
        return player
    }

    func getCurrentTime() -> Double {
        guard let player = player else {
            return 0
        }
        let seconds = player.currentTime().seconds
        return seconds.isFinite ? seconds : 0
    }

    func getState() -> [String: Any] {
        var data: [String: Any] = [
            "isActive": player != nil,
            "currentTime": getCurrentTime(),
            "type": currentType,
        ]

        if let currentURL {
            data["url"] = currentURL.absoluteString
        }

        if let currentSessionContext {
            data["sessionContext"] = currentSessionContext.asDictionary()
        }

        return data
    }

    func setPlaybackRate(_ rate: Float) {
        guard let player = player else {
            return
        }

        let clampedRate = max(0.0, min(rate, 3.0))
        playbackRate = clampedRate

        if #available(iOS 16.0, *) {
            player.defaultRate = clampedRate == 0 ? 1.0 : clampedRate
        }

        if clampedRate == 0 {
            player.pause()
        } else {
            if player.timeControlStatus == .playing {
                player.rate = clampedRate
            }
        }

        updateNowPlayingInfo()
        DebugLogger.shared.log("[MediaPlayer] Playback rate set to \(clampedRate)")
    }

    func getPlaybackRate() -> Float {
        return playbackRate
    }
}
