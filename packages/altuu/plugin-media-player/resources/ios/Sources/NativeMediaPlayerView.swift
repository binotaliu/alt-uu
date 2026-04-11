import SwiftUI
import AVFoundation
import AVKit

/// SwiftUI view that displays a native media player (audio or video).
struct NativeMediaPlayerView: View {
    let data: MediaPlayerData

    @Environment(\.scenePhase) private var scenePhase
    @State private var player: AVPlayer?

    private var isAudio: Bool {
        data.type.lowercased() == "audio"
    }

    private var preferredColorScheme: ColorScheme? {
        switch data.appearance?.lowercased() {
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
                        title: data.materialName,
                        subtitle: data.courseName
                    )
                } else {
                    NativeVideoPlayerContainer(player: player)
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
        .onChange(of: data.url) { _, _ in
            syncPlayerFromManager()
        }
        .onChange(of: data.type) { _, _ in
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
        .preferredColorScheme(preferredColorScheme)
    }

    private func syncPlayerFromManager() {
        player = MediaPlayerManager.shared.getPlayer()
        if player == nil {
            DebugLogger.shared.log("[MediaPlayer] Native view missing shared player for \(data.type): \(data.url)")
            return
        }

        MediaPlayerManager.shared.play()
    }
}

private struct NativeVideoPlayerContainer: UIViewControllerRepresentable {
    let player: AVPlayer

    func makeUIViewController(context: Context) -> AVPlayerViewController {
        let controller = AVPlayerViewController()
        controller.player = player
        controller.showsPlaybackControls = true
        controller.videoGravity = .resizeAspect
        controller.allowsPictureInPicturePlayback = true
        if #available(iOS 15.0, *) {
            controller.canStartPictureInPictureAutomaticallyFromInline = true
        }

        MediaPlayerManager.shared.registerPlayerViewController(controller)

        return controller
    }

    func updateUIViewController(_ uiViewController: AVPlayerViewController, context: Context) {
        if uiViewController.player !== player {
            uiViewController.player = player
        }
    }

    static func dismantleUIViewController(_ uiViewController: AVPlayerViewController, coordinator: Void) {
        uiViewController.player?.pause()
    }
}

private class NativeAudioPlayerControlsState: ObservableObject {
    @Published var showingRatePicker = false
}

private struct NativeAudioPlayerControls: View {
    let player: AVPlayer
    let title: String?
    let subtitle: String?

    @State private var isPlaying = false
    @State private var currentTime: Double = 0
    @State private var duration: Double = 0
    @State private var playbackRate: Float = 1.0
    @State private var isSeeking = false
    @State private var timeObserverToken: Any?
    @StateObject private var uiState = NativeAudioPlayerControlsState()

    @Environment(\.colorScheme) private var colorScheme

    private var themeColor: Color {
        if colorScheme == .dark {
            // Dark mode accent color: deeper/muted orange for better readability
            return Color(red: 0.76, green: 0.34, blue: 0.20)
        }

        return Color(red: 0.94, green: 0.50, blue: 0.34)
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
                            .foregroundColor(colorScheme == .dark ? .black : .white)
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
                        .background(Color(.systemBackground))
                }
            }

            HStack(spacing: 10) {
                Button(action: togglePlayback) {
                    Image(systemName: isPlaying ? "pause.fill" : "play.fill")
                        .font(.callout.weight(.semibold))
                        .foregroundColor(.white)
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
        .background(Color(.systemBackground))
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
        NativeMediaPlayerView(data: MediaPlayerData(
            url: "https://example.com/video.mp4",
            type: "video",
            frame: MediaPlayerFrame(x: 0, y: 0, width: 320, height: 180),
            courseName: "Demo 課程",
            materialName: "Demo 視頻",
            appearance: "system",
            sessionContext: nil
        ))
        .frame(width: 320, height: 180)
        .previewLayout(.sizeThatFits)

        NativeMediaPlayerView(data: MediaPlayerData(
            url: "https://example.com/audio.mp3",
            type: "audio",
            frame: MediaPlayerFrame(x: 0, y: 0, width: 320, height: 96),
            courseName: "Demo 課程",
            materialName: "Demo 音訊",
            appearance: "dark",
            sessionContext: nil
        ))
        .frame(width: 320, height: 96)
        .previewLayout(.sizeThatFits)
    }
}
#endif
