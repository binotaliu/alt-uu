import SwiftUI
import AVFoundation
import AVKit

/// SwiftUI view that displays a native media player (audio or video).
///
/// Two callers: the legacy WebView overlay host (`MediaPlayerOverlayHost`, plays on
/// appear, accent from `AccentPalette`) and the `<native:media-player>` element
/// (`AltUUMediaPlayerRenderer`: the element decides when to play, colours come
/// from the mobile-ui theme and the appearance override is scoped to this view).
struct NativeMediaPlayerView: View {
    let url: String
    let type: String
    let materialName: String?
    let courseName: String?
    let appearance: String?
    var poster: String?
    var subtitleURL: String?
    var playsOnAppear: Bool
    var usesNativeTheme: Bool

    @Environment(\.scenePhase) private var scenePhase
    @State private var player: AVPlayer?

    init(
        url: String,
        type: String,
        materialName: String?,
        courseName: String?,
        appearance: String?,
        poster: String? = nil,
        subtitleURL: String? = nil,
        playsOnAppear: Bool = true,
        usesNativeTheme: Bool = false
    ) {
        self.url = url
        self.type = type
        self.materialName = materialName
        self.courseName = courseName
        self.appearance = appearance
        self.poster = poster
        self.subtitleURL = subtitleURL
        self.playsOnAppear = playsOnAppear
        self.usesNativeTheme = usesNativeTheme
    }

    /// Legacy overlay entry point.
    init(data: MediaPlayerData) {
        self.init(url: data.url, type: data.type, materialName: data.materialName, courseName: data.courseName, appearance: data.appearance)
    }

    private var isAudio: Bool {
        type.lowercased() == "audio"
    }

    private var preferredColorScheme: ColorScheme? {
        switch appearance?.lowercased() {
        case "light":
            return .light
        case "dark":
            return .dark
        default:
            return nil
        }
    }

    var body: some View {
        Group {
            if let player {
                if isAudio {
                    NativeAudioPlayerControls(
                        player: player,
                        title: materialName,
                        subtitle: courseName,
                        usesNativeTheme: usesNativeTheme
                    )
                } else {
                    NativeVideoPlayerContainer(player: player)
                        .overlay(NativeVideoOverlays(player: player, poster: poster, subtitleURL: subtitleURL))
                        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                        .shadow(radius: 3)
                }
            } else {
                Color.black
            }
        }
        .onAppear {
            syncPlayerFromManager()
        }
        .onReceive(NotificationCenter.default.publisher(for: MediaPlayerManager.playerChangedNotification)) { _ in
            syncPlayerFromManager()
        }
        .onChange(of: url) { _, _ in
            syncPlayerFromManager()
        }
        .onChange(of: type) { _, _ in
            syncPlayerFromManager()
        }
        .onChange(of: scenePhase) { newPhase in
            if newPhase == .background {
                MediaPlayerManager.shared.startPictureInPictureIfNeeded()
            }
        }
        .onReceive(NotificationCenter.default.publisher(for: UIApplication.didEnterBackgroundNotification)) { _ in
            MediaPlayerManager.shared.startPictureInPictureIfNeeded()
        }
        .modifier(AppearanceModifier(scheme: preferredColorScheme, scopedToView: usesNativeTheme))
    }

    private func syncPlayerFromManager() {
        let current = MediaPlayerManager.shared.getPlayer()

        if current !== player {
            player = current
        }

        if current == nil {
            DebugLogger.shared.log("[MediaPlayer] Native view has no shared player yet for \(type): \(url)")
            return
        }

        if playsOnAppear {
            MediaPlayerManager.shared.play()
        }
    }
}

/// `.preferredColorScheme` styles the enclosing presentation, which is right for the
/// full-window overlay but would flip the whole screen for an in-tree element, so the
/// element only overrides the environment of its own subtree.
private struct AppearanceModifier: ViewModifier {
    let scheme: ColorScheme?
    let scopedToView: Bool

    @ViewBuilder
    func body(content: Content) -> some View {
        if scopedToView {
            if let scheme {
                content.environment(\.colorScheme, scheme)
            } else {
                content
            }
        } else {
            content.preferredColorScheme(scheme)
        }
    }
}

/// Poster (until playback starts) and drawn WebVTT subtitles above the video.
private struct NativeVideoOverlays: View {
    let player: AVPlayer
    let poster: String?
    let subtitleURL: String?

    @State private var cues: [SubtitleCue] = []
    @State private var activeText: String?
    @State private var hasStarted = false

    private let ticker = Timer.publish(every: 0.25, on: .main, in: .common).autoconnect()

    var body: some View {
        ZStack(alignment: .bottom) {
            if !hasStarted, let poster, let posterURL = URL(string: poster) {
                AsyncImage(url: posterURL) { image in
                    image.resizable().scaledToFit()
                } placeholder: {
                    Color.clear
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .background(Color.black)
                .allowsHitTesting(false)
            }

            if let activeText {
                Text(activeText)
                    .font(.callout.weight(.semibold))
                    .foregroundColor(.white)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, 10)
                    .padding(.vertical, 4)
                    .background(Color.black.opacity(0.6))
                    .clipShape(RoundedRectangle(cornerRadius: 6, style: .continuous))
                    .padding(.horizontal, 12)
                    .padding(.bottom, 48)
                    .allowsHitTesting(false)
            }
        }
        .task(id: subtitleURL) {
            guard let subtitleURL, let url = URL(string: subtitleURL) else {
                cues = []
                activeText = nil
                return
            }

            cues = await WebVTTParser.load(from: url)
        }
        .onReceive(ticker) { _ in
            let seconds = player.currentTime().seconds

            if !hasStarted, player.timeControlStatus == .playing || (seconds.isFinite && seconds > 0.1) {
                hasStarted = true
            }

            guard !cues.isEmpty, seconds.isFinite else {
                return
            }

            let text = WebVTTParser.cue(at: seconds, in: cues)?.text

            if text != activeText {
                activeText = text
            }
        }
    }
}

/// `AVPlayerViewController` owns its own internal transport-chrome child controller, which
/// answers `childForStatusBarHidden`/`childForStatusBarStyle` before UIKit ever consults an
/// override placed directly on an `AVPlayerViewController` subclass — that chrome child always
/// reports light-content (white) status bar text, which reads as invisible against a light-mode
/// status bar even though the bar itself is still shown. To stop that chrome child from winning
/// the negotiation, `AVPlayerViewController` must be embedded as a *child* of a separate wrapper
/// controller that refuses to defer (`childForStatusBar... -> nil`), so the wrapper's own
/// `.default` style (which adapts to the actual system/app appearance) is used instead.
private final class InlinePlayerContainerViewController: UIViewController {
    let playerViewController = AVPlayerViewController()

    override func viewDidLoad() {
        super.viewDidLoad()

        addChild(playerViewController)
        playerViewController.view.frame = view.bounds
        playerViewController.view.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        view.addSubview(playerViewController.view)
        playerViewController.didMove(toParent: self)
    }

    override var childForStatusBarHidden: UIViewController? {
        nil
    }

    override var childForStatusBarStyle: UIViewController? {
        nil
    }

    override var prefersStatusBarHidden: Bool {
        false
    }

    override var preferredStatusBarStyle: UIStatusBarStyle {
        .default
    }
}

private struct NativeVideoPlayerContainer: UIViewControllerRepresentable {
    let player: AVPlayer

    func makeUIViewController(context: Context) -> InlinePlayerContainerViewController {
        let container = InlinePlayerContainerViewController()
        let controller = container.playerViewController
        controller.player = player
        controller.showsPlaybackControls = true
        controller.videoGravity = .resizeAspect
        controller.allowsPictureInPicturePlayback = true
        if #available(iOS 15.0, *) {
            controller.canStartPictureInPictureAutomaticallyFromInline = true
        }

        MediaPlayerManager.shared.registerPlayerViewController(controller)

        return container
    }

    func updateUIViewController(_ uiViewController: InlinePlayerContainerViewController, context: Context) {
        let controller = uiViewController.playerViewController
        if controller.player !== player {
            controller.player = player
        }
    }

    static func dismantleUIViewController(_ uiViewController: InlinePlayerContainerViewController, coordinator: Void) {
        let controller = uiViewController.playerViewController
        controller.player?.pause()

        // Detach from the manager and break the child-VC link before UIKit deallocates
        // the container, so AVKit has no dangling controller to update now-playing info
        // for from an in-flight async block (see crash: objc_retain in
        // AVNowPlayingInfoController setPlayerController:).
        MediaPlayerManager.shared.unregisterPlayerViewController(controller)
        controller.willMove(toParent: nil)
        controller.removeFromParent()
    }
}

private class NativeAudioPlayerControlsState: ObservableObject {
    @Published var showingRatePicker = false
}

private struct NativeAudioPlayerControls: View {
    let player: AVPlayer
    let title: String?
    let subtitle: String?
    var usesNativeTheme: Bool = false

    @State private var isPlaying = false
    @State private var currentTime: Double = 0
    @State private var duration: Double = 0
    @State private var playbackRate: Float = 1.0
    @State private var isSeeking = false
    @State private var timeObserverToken: Any?
    @StateObject private var uiState = NativeAudioPlayerControlsState()

    @Environment(\.colorScheme) private var colorScheme
    @ObservedObject private var accentPalette = AccentPalette.shared
    @ObservedObject private var nativeTheme = NativeUITheme.shared

    /// Element: the pushed mobile-ui `accent` token (follows `NativeAccent::apply`).
    /// Legacy overlay: the AppAccent.SetColor palette.
    private var themeColor: Color {
        if usesNativeTheme {
            return nativeTheme.resolve(for: colorScheme).accent
        }

        return AccentPalette.color(for: accentPalette.accentId, isDark: colorScheme == .dark)
    }

    private var onThemeColor: Color {
        usesNativeTheme ? nativeTheme.resolve(for: colorScheme).onAccent : (colorScheme == .dark ? .black : .white)
    }

    private var cardBackground: Color {
        usesNativeTheme ? nativeTheme.resolve(for: colorScheme).surface : Color(.systemBackground)
    }

    private var subtitleColor: Color {
        colorScheme == .dark
            ? Color(.secondaryLabel)
            : Color.black.opacity(0.75)
    }

    private var borderColor: Color {
        colorScheme == .dark
            ? Color(.separator).opacity(0.75)
            : themeColor.opacity(0.25)
    }

    private var shadowColor: Color {
        colorScheme == .dark
            ? Color(.secondaryLabel).opacity(0.35)
            : themeColor.opacity(0.15)
    }

    private var buttonBorderColor: Color {
        colorScheme == .dark
            ? Color(.separator).opacity(0.65)
            : themeColor.opacity(0.35)
    }

    private var buttonShadowColor: Color {
        colorScheme == .dark
            ? Color(.secondaryLabel).opacity(0.30)
            : themeColor.opacity(0.25)
    }

    private var timeColor: Color {
        // Match dark mode time text color to subtitle for better contrast
        colorScheme == .dark
            ? subtitleColor
            : Color.black.opacity(0.65)
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(alignment: .center) {
                VStack(alignment: .leading, spacing: 2) {
                    Text(title ?? "語音課程")
                        .font(.caption.weight(.semibold))
                        .foregroundColor(themeColor)
                        .lineLimit(1)

                    if let subtitle, !subtitle.isEmpty {
                        Text(subtitle)
                            .font(.caption2)
                            .foregroundColor(subtitleColor)
                            .lineLimit(1)
                    }
                }

                Spacer()

                HStack(alignment: .center, spacing: 8) {
                    Button(action: { uiState.showingRatePicker = true }) {
                        Text(formatRate(playbackRate))
                            .font(.caption2.weight(.semibold))
                            .foregroundColor(onThemeColor)
                            .padding(.vertical, 4)
                            .padding(.horizontal, 8)
                            .background(themeColor)
                            .clipShape(Capsule())
                    }
                    .buttonStyle(.plain)
                    .confirmationDialog("播放速度", isPresented: $uiState.showingRatePicker, titleVisibility: .visible) {
                        ForEach([2.0, 1.5, 1.25, 1, 0.5], id: \.self) { value in
                            Button(formatRate(Float(value))) {
                                setPlaybackRate(Float(value))
                            }
                        }
                        Button("取消", role: .cancel) { }
                    }

                    AirPlayButton()
                        .frame(width: 28, height: 28)
                        .background(cardBackground)
                }
            }

            HStack(spacing: 10) {
                Button(action: { skip(by: -10) }) {
                    Image(systemName: "gobackward.10")
                        .font(.callout)
                        .foregroundColor(themeColor)
                        .frame(width: 24, height: 24)
                }
                .buttonStyle(.plain)

                Button(action: togglePlayback) {
                    Image(systemName: isPlaying ? "pause.fill" : "play.fill")
                        .font(.callout.weight(.semibold))
                        .foregroundColor(usesNativeTheme ? onThemeColor : .white)
                        .frame(width: 28, height: 28)
                        .background(themeColor)
                        .clipShape(Circle())
                        .shadow(color: buttonShadowColor, radius: 2, x: 0, y: 1)
                        .overlay(
                            Circle()
                                .stroke(buttonBorderColor, lineWidth: 1)
                        )
                }
                .buttonStyle(.plain)

                Button(action: { skip(by: 10) }) {
                    Image(systemName: "goforward.10")
                        .font(.callout)
                        .foregroundColor(themeColor)
                        .frame(width: 24, height: 24)
                }
                .buttonStyle(.plain)

                Slider(
                    value: Binding(
                        get: { currentTime },
                        set: { currentTime = $0 }
                    ),
                    in: 0...max(duration, 1),
                    onEditingChanged: { editing in
                        isSeeking = editing
                        if !editing {
                            let seekTime = CMTime(seconds: currentTime, preferredTimescale: 600)
                            player.seek(to: seekTime)
                        }
                    }
                )
                .tint(themeColor)
                .accentColor(themeColor)
            }

            HStack {
                Text(formatTime(currentTime))
                    .foregroundColor(timeColor)
                Spacer()
                Text(formatTime(duration))
                    .foregroundColor(timeColor)
            }
            .font(.caption2)
        }
        .padding(.horizontal, 10)
        .padding(.vertical, 8)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
        .background(cardBackground)
        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 12, style: .continuous)
                .stroke(borderColor, lineWidth: 1)
        )
        .shadow(color: shadowColor, radius: 1, x: 0, y: 1)
        .onAppear {
            installTimeObserverIfNeeded()
            refreshState()
        }
        .onDisappear {
            removeTimeObserver()
        }
    }

    private func togglePlayback() {
        if isPlaying {
            player.pause()
        } else {
            MediaPlayerManager.shared.play()
        }

        refreshState()
    }

    private func skip(by delta: Double) {
        MediaPlayerManager.shared.skip(by: delta)
        refreshState()
    }

    private func refreshState() {
        isPlaying = player.rate > 0

        // Keep last selected rate when paused (player.rate becomes 0 during pause).
        let currentPlaybackRate = player.rate == 0 ? playbackRate : player.rate
        if playbackRate != currentPlaybackRate {
            playbackRate = currentPlaybackRate
        }

        let current = player.currentTime().seconds
        if current.isFinite {
            currentTime = max(0, current)
        }

        if let itemDuration = player.currentItem?.duration.seconds, itemDuration.isFinite, itemDuration > 0 {
            duration = itemDuration
        } else {
            duration = max(duration, 0)
        }
    }

    private func setPlaybackRate(_ rate: Float) {
        playbackRate = rate
        player.rate = rate

        // Force media player manager to refresh now playing info.
        MediaPlayerManager.shared.setPlaybackRate(rate)
    }

    private func installTimeObserverIfNeeded() {
        if timeObserverToken != nil {
            return
        }

        let interval = CMTime(seconds: 0.4, preferredTimescale: 600)
        timeObserverToken = player.addPeriodicTimeObserver(forInterval: interval, queue: .main) { _ in
            if uiState.showingRatePicker {
                return
            }

            if !isSeeking {
                let current = player.currentTime().seconds
                if current.isFinite {
                    currentTime = max(0, current)
                }
            }

            if let itemDuration = player.currentItem?.duration.seconds, itemDuration.isFinite, itemDuration > 0 {
                duration = itemDuration
            }

            isPlaying = player.rate > 0
        }
    }

    private func removeTimeObserver() {
        guard let token = timeObserverToken else {
            return
        }

        player.removeTimeObserver(token)
        timeObserverToken = nil
    }

    private func formatRate(_ rate: Float) -> String {
        let formatter = NumberFormatter()
        formatter.numberStyle = .decimal
        formatter.minimumFractionDigits = 0
        formatter.maximumFractionDigits = 2

        if let formatted = formatter.string(from: NSNumber(value: Double(rate))) {
            return "\(formatted)x"
        }

        // Fallback for unexpected values
        return String(format: "%.2fx", rate)
    }

    private func formatTime(_ seconds: Double) -> String {
        guard seconds.isFinite, seconds > 0 else {
            return "0:00"
        }

        let total = Int(seconds.rounded(.down))
        let minutes = total / 60
        let remainingSeconds = total % 60

        return String(format: "%d:%02d", minutes, remainingSeconds)
    }
}

private struct AirPlayButton: UIViewRepresentable {
    func makeUIView(context: Context) -> AVRoutePickerView {
        let view = AVRoutePickerView()
        view.backgroundColor = .clear
        view.prioritizesVideoDevices = true
        view.activeTintColor = UIColor.systemBlue
        view.tintColor = UIColor.label
        return view
    }

    func updateUIView(_ uiView: AVRoutePickerView, context: Context) {
        // No dynamic updates needed.
    }
}

#if DEBUG
struct NativeMediaPlayerView_Previews: PreviewProvider {
    static var previews: some View {
        NativeMediaPlayerView(url: "https://example.com/video.mp4", type: "video", materialName: "Demo 視頻", courseName: "Demo 課程", appearance: "system")
            .frame(width: 320, height: 180)
            .previewLayout(.sizeThatFits)

        NativeMediaPlayerView(url: "https://example.com/audio.mp3", type: "audio", materialName: "Demo 音訊", courseName: "Demo 課程", appearance: "dark", playsOnAppear: false, usesNativeTheme: true)
            .frame(width: 320, height: 96)
            .previewLayout(.sizeThatFits)
    }
}
#endif
