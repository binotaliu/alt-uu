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
            let expectedURL = parameters["url"] as? String

            DispatchQueue.main.async {
                MediaPlayerManager.shared.stop(expectedURL: expectedURL)
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
            let duration = MediaPlayerManager.shared.getDuration()

            return BridgeResponse.success(data: [
                "time": currentTime,
                "duration": duration,
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
    private(set) var videoOutput: AVPlayerItemVideoOutput?
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

    // MARK: `<native:media-player>` element state

    static let playerChangedNotification = Notification.Name("AltUUMediaPlayerChanged")

    /// Text the element's `watermark` prop stamps on captured frames.
    private(set) var watermarkText: String?
    /// Callback ids of the element that currently owns the player (all 0 = nobody listens).
    let elementEvents = MediaElementEvents()
    private var appliedSourceKey: String?
    private var appliedRateProp: Float?
    private var observedPlayer: AVPlayer?
    private var statusObservation: NSKeyValueObservation?
    private var itemStatusObservation: NSKeyValueObservation?
    private var endObserver: NSObjectProtocol?
    private var lastProgressEmit: Date = .distantPast
    private var lastEmittedState: String?
    private var didPlayToEnd = false

    var currentCourseNameValue: String? { currentCourseName }
    var currentMaterialNameValue: String? { currentMaterialName }

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

    /// Detaches a torn-down `AVPlayerViewController` from the manager so no stale
    /// reference lingers for async now-playing-info updates to race against. Only
    /// clears the reference if `controller` is still the one currently registered,
    /// so a controller for a freshly mounted view isn't accidentally unregistered.
    func unregisterPlayerViewController(_ controller: AVPlayerViewController) {
        guard playerViewController === controller else {
            return
        }

        controller.player = nil
        playerViewController = nil
    }

    /// Builds (or reuses) the shared player. Returns true when a new player was built.
    @discardableResult
    func setPlayer(url: String, type: String, frame: MediaPlayerFrame, courseName: String? = nil, materialName: String? = nil, appearance: String? = nil, sessionContext: MediaPlayerSessionContext? = nil, force: Bool = false, startTime: Double? = nil) -> Bool {
        guard let sourceURL = URL(string: url) else {
            DebugLogger.shared.log("[MediaPlayer] Invalid URL: \(url)")
            return false
        }

        configureAudioSession()

        let normalizedType = type.lowercased()
        let isSameSource = !force && currentURL == sourceURL && currentType == normalizedType && player != nil

        // A forced reload (e.g. after a network failure) rebuilds the player
        // from scratch but resumes from where the previous one stopped.
        let resumeTime: Double? = force && currentURL == sourceURL ? getCurrentTime() : nil
        let shouldResumePlayback = force && (player?.timeControlStatus ?? .paused) != .paused

        self.currentType = normalizedType
        self.currentCourseName = courseName
        self.currentMaterialName = materialName
        self.currentSessionContext = sessionContext
        if isSameSource {
            if let existingPlayer = player, playerViewController?.player !== existingPlayer {
                playerViewController?.player = existingPlayer
            }

            updateNowPlayingInfo()
            DebugLogger.shared.log("[MediaPlayer] Reused existing player for \(type): \(url)")
            return false
        }

        removeNowPlayingInfoTimeObserver()
        clearNowPlayingSession()

        let asset = AVAsset(url: sourceURL)
        let playerItem = AVPlayerItem(asset: asset)

        if normalizedType == "video" {
            let output = AVPlayerItemVideoOutput(pixelBufferAttributes: [
                kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA,
            ])
            playerItem.add(output)
            self.videoOutput = output
        } else {
            self.videoOutput = nil
        }

        let player = AVPlayer(playerItem: playerItem)

        self.player = player
        self.currentURL = sourceURL

        if playerViewController?.player !== player {
            playerViewController?.player = player
        }

        if let resumeTime, resumeTime > 0 {
            player.seek(to: CMTime(seconds: resumeTime, preferredTimescale: 600), toleranceBefore: .zero, toleranceAfter: .zero)
        } else if let startTime, startTime > 0 {
            player.seek(to: CMTime(seconds: startTime, preferredTimescale: 600), toleranceBefore: .zero, toleranceAfter: .zero)
        }

        installNowPlayingInfoTimeObserver()

        if shouldResumePlayback {
            play()
        }

        if #available(iOS 16.0, *) {
            setupNowPlayingSession()  // metadata is written inside becomeActiveIfPossible callback
        } else {
            updateNowPlayingInfoFallback()
        }

        didPlayToEnd = false
        NotificationCenter.default.post(name: Self.playerChangedNotification, object: nil)

        DebugLogger.shared.log("[MediaPlayer] Player set for \(type): \(url) (appearance: \(appearance ?? "system"), route: \(sessionContext?.routePath ?? "nil"))")
        return true
    }

    func play() {
        guard let player = player else {
            return
        }

        let rateToUse = playbackRate <= 0 ? 1.0 : playbackRate
        didPlayToEnd = false
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

    func stop(expectedURL: String? = nil) {
        if let expectedURL, URL(string: expectedURL) != currentURL {
            // A newer setPlayer() call already superseded this stop request
            // (e.g. it arrived late after the user navigated to another
            // material); releasing now would tear down the new player.
            DebugLogger.shared.log("[MediaPlayer] stop: ignoring stale stop for \(expectedURL) (current=\(currentURL?.absoluteString ?? "nil"))")
            return
        }

        removeNowPlayingInfoTimeObserver()
        removeElementObservers()

        player?.pause()
        player?.seek(to: .zero)
        playerViewController?.player = nil
        player = nil
        videoOutput = nil
        currentURL = nil
        currentSessionContext = nil
        appliedSourceKey = nil
        appliedRateProp = nil
        didPlayToEnd = false

        clearNowPlayingSession()

        NotificationCenter.default.post(name: Self.playerChangedNotification, object: nil)
        DebugLogger.shared.log("[MediaPlayer] Stopped")
    }

    func seek(to time: CMTime) {
        didPlayToEnd = false
        player?.seek(to: time) { [weak self] _ in
            DispatchQueue.main.async { self?.emitProgress() }
        }
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
            self.emitProgressIfDue()
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

    func skip(by delta: Double) {
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

    func getDuration() -> Double {
        guard let seconds = player?.currentItem?.duration.seconds else {
            return 0
        }

        return seconds.isFinite && seconds > 0 ? seconds : 0
    }

    func getState() -> [String: Any] {
        var data: [String: Any] = [
            "isActive": player != nil,
            "currentTime": getCurrentTime(),
            "duration": getDuration(),
            "state": currentStateName(),
            "playbackRate": playbackRate,
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

    // MARK: - `<native:media-player>` element integration

    /// Applies the element's props. Idempotent: every PHP render re-sends every prop,
    /// so the source is only reloaded when `url`/`kind` change, the start position and
    /// autoplay only apply to a freshly built player, and the rate only when the PROP
    /// changed (a rate picked natively is never overwritten by a later render).
    func applyElement(_ config: MediaElementConfig) {
        elementEvents.bind(config)
        watermarkText = config.watermark

        let key = "\(config.url)|\(config.kind)"
        let isNewSource = key != appliedSourceKey || player == nil
        var built = false

        if isNewSource {
            appliedSourceKey = key
            appliedRateProp = nil
            built = setPlayer(
                url: config.url,
                type: config.kind,
                frame: MediaPlayerFrame(x: 0, y: 0, width: 0, height: 0),
                courseName: config.courseName,
                materialName: config.title,
                appearance: config.appearance,
                sessionContext: config.sessionContext,
                startTime: config.start
            )
        } else if currentCourseName != config.courseName || currentMaterialName != config.title {
            currentCourseName = config.courseName
            currentMaterialName = config.title
            updateNowPlayingInfo()
        }

        if observedPlayer !== player {
            installElementObservers()
        }

        if appliedRateProp != config.rate {
            appliedRateProp = config.rate
            setPlaybackRate(config.rate)
        }

        if built && config.autoplay {
            play()
        }
    }

    /// The element left the tree. Only pause and mute its events: SwiftUI also
    /// dismantles views while rebuilding them, so the real stop is PHP's
    /// (`MediaPlayback::unmount()` calls `MediaPlayer.Stop` with the URL).
    func detachElement(nodeId: Int) {
        guard elementEvents.nodeId == nodeId else {
            return
        }

        pause()
        elementEvents.clear()
    }

    func currentStateName() -> String {
        guard let player else {
            return "idle"
        }

        if didPlayToEnd {
            return "ended"
        }

        switch player.timeControlStatus {
        case .playing:
            return "playing"
        case .waitingToPlayAtSpecifiedRate:
            return "buffering"
        case .paused:
            return player.currentItem?.status == .readyToPlay ? "paused" : "idle"
        @unknown default:
            return "idle"
        }
    }

    private func installElementObservers() {
        removeElementObservers()

        guard let player else {
            return
        }

        observedPlayer = player
        lastEmittedState = nil

        // KVO callbacks arrive on arbitrary threads; everything below is main-thread.
        statusObservation = player.observe(\.timeControlStatus, options: [.new]) { [weak self] _, _ in
            DispatchQueue.main.async { self?.emitStateIfChanged() }
        }

        if let item = player.currentItem {
            itemStatusObservation = item.observe(\.status, options: [.new]) { [weak self] item, _ in
                guard item.status == .failed else {
                    return
                }

                let message = item.error?.localizedDescription ?? "無法播放此媒體"
                let code = (item.error as NSError?)?.code ?? 0
                DispatchQueue.main.async { self?.emitError(message: message, code: code) }
            }

            endObserver = NotificationCenter.default.addObserver(forName: .AVPlayerItemDidPlayToEndTime, object: item, queue: .main) { [weak self] _ in
                self?.didPlayToEnd = true
                self?.emitStateIfChanged()
                self?.emitProgress()
                self?.emitEnded()
            }
        }
    }

    private func removeElementObservers() {
        statusObservation?.invalidate()
        statusObservation = nil
        itemStatusObservation?.invalidate()
        itemStatusObservation = nil

        if let endObserver {
            NotificationCenter.default.removeObserver(endObserver)
        }

        endObserver = nil
        observedPlayer = nil
    }

    private func timingPayload() -> [String: Any] {
        ["currentTime": getCurrentTime(), "duration": getDuration()]
    }

    private func emitStateIfChanged() {
        let state = currentStateName()

        guard state != lastEmittedState else {
            return
        }

        lastEmittedState = state

        var payload = timingPayload()
        payload["state"] = state
        elementEvents.send(elementEvents.stateChangeId, payload)

        // A pause is the moment a study timer wants an up-to-date position.
        if state == "paused" {
            emitProgress()
        }
    }

    /// `progress` while playing, at most every 5 seconds (each event costs a PHP render).
    private func emitProgressIfDue() {
        guard elementEvents.progressId != 0, currentStateName() == "playing", Date().timeIntervalSince(lastProgressEmit) >= 5 else {
            return
        }

        emitProgress()
    }

    func emitProgress() {
        guard elementEvents.progressId != 0, player != nil else {
            return
        }

        lastProgressEmit = Date()

        var payload = timingPayload()
        payload["state"] = currentStateName()
        elementEvents.send(elementEvents.progressId, payload)
    }

    private func emitEnded() {
        elementEvents.send(elementEvents.endedId, timingPayload())
    }

    private func emitError(message: String, code: Int) {
        elementEvents.send(elementEvents.errorId, ["message": message, "code": code])
    }
}

// MARK: - Element config and events

/// Everything `<native:media-player>` sends, parsed once per render.
struct MediaElementConfig {
    let nodeId: Int
    let url: String
    let kind: String
    let title: String?
    let courseName: String?
    let poster: String?
    let subtitles: String?
    let start: Double?
    let rate: Float
    let appearance: String?
    let watermark: String?
    let autoplay: Bool
    let sessionContext: MediaPlayerSessionContext?
    let progressId: Int
    let stateChangeId: Int
    let endedId: Int
    let errorId: Int

    init(node: NativeUINode) {
        func optional(_ key: String) -> String? {
            let value = node.props.getString(key)
            return value.isEmpty ? nil : value
        }

        nodeId = node.id
        url = node.props.getString("src")
        kind = node.props.getString("kind") == "audio" ? "audio" : "video"
        title = optional("title")
        courseName = optional("course_name")
        poster = optional("poster")
        subtitles = optional("subtitles")
        let startSeconds = Double(node.props.getFloat("start", default: 0))
        start = startSeconds > 0 ? startSeconds : nil
        rate = Float(node.props.getFloat("rate", default: 1))
        appearance = optional("appearance")
        watermark = optional("watermark")
        autoplay = node.props.getBool("autoplay", default: false)
        progressId = node.props.getCallbackId("on_progress")
        stateChangeId = node.props.getCallbackId("on_state_change")
        endedId = node.props.getCallbackId("on_ended")
        errorId = node.props.getCallbackId("on_error")

        if let raw = optional("session_context"),
           let data = raw.data(using: .utf8),
           let dictionary = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any] {
            sessionContext = MediaPlayerSessionContext(
                routePath: dictionary["routePath"] as? String,
                cid: dictionary["cid"] as? String,
                activityId: dictionary["activityId"] as? String,
                href: dictionary["href"] as? String,
                startedAt: dictionary["startedAt"] as? String
            )
        } else {
            sessionContext = nil
        }
    }

    /// Identity of everything that should re-run `applyElement`.
    var signature: String {
        [
            url, kind, title ?? "", courseName ?? "", "\(start ?? 0)", "\(rate)", appearance ?? "",
            watermark ?? "", "\(autoplay)", "\(progressId)|\(stateChangeId)|\(endedId)|\(errorId)|\(nodeId)",
        ].joined(separator: "\u{1F}")
    }
}

/// Text-payload event dispatch to the element that owns the player (JSON strings, like html-view).
final class MediaElementEvents {
    private(set) var nodeId = 0
    private(set) var progressId = 0
    private(set) var stateChangeId = 0
    private(set) var endedId = 0
    private(set) var errorId = 0

    func bind(_ config: MediaElementConfig) {
        nodeId = config.nodeId
        progressId = config.progressId
        stateChangeId = config.stateChangeId
        endedId = config.endedId
        errorId = config.errorId
    }

    func clear() {
        nodeId = 0
        progressId = 0
        stateChangeId = 0
        endedId = 0
        errorId = 0
    }

    func send(_ callbackId: Int, _ payload: [String: Any]) {
        guard callbackId != 0,
              JSONSerialization.isValidJSONObject(payload),
              let data = try? JSONSerialization.data(withJSONObject: payload),
              let text = String(data: data, encoding: .utf8) else {
            return
        }

        NativeElementBridge.sendTextChangeEvent(callbackId, nodeId: nodeId, text: text)
    }
}
