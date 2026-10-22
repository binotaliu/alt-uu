import { captureVideoFrame } from '@altuu/attachment-bridge';
import { Button, Text } from '@altuu/ui';
import { useEventListener } from 'expo';
import * as ScreenOrientation from 'expo-screen-orientation';
import {
  VideoView,
  useVideoPlayer,
  type VideoPlayer,
  type VideoSource,
  type VideoThumbnail,
} from 'expo-video';
import {
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type ComponentRef,
  type Ref,
} from 'react';
import { View } from 'react-native';
import { captureRef } from 'react-native-view-shot';

import { AudioPlayerControls } from './AudioPlayerControls';
import { usePlaybackRateStore } from './PlaybackRateMenu';
import { clampSeek } from './playback';

export interface PlaybackProgress {
  currentTime: number;
  duration: number;
  rate: number;
  playing: boolean;
}

/** Imperative surface the material page uses (legacy MaterialViewer expose). */
export interface MaterialPlayerHandle {
  getCurrentTime(): number;
  getDuration(): number;
  isPlaying(): boolean;
  seekTo(seconds: number): void;
  togglePlay(): void;
  setRate(rate: number): void;
  /**
   * Rebuilds the source and resumes at the same position (legacy
   * `SetPlayer` with `force`, used after network failures).
   */
  reload(): Promise<void>;
  /** Pauses and rewinds (legacy `closePlayer`). */
  stop(): void;
  /** Leaves fullscreen; false when it was not fullscreen. */
  exitFullscreen(): boolean;
  /** The frame on screen, for the watermarked capture. */
  captureFrame(): Promise<{
    thumbnail: CapturedFrameImage;
    seconds: number;
  } | null>;
}

/** A decoded thumbnail, or a snapshot file of the video view (HLS fallback). */
export type CapturedFrameImage =
  VideoThumbnail | { uri: string; width: number; height: number };

export interface MaterialPlayerProps {
  videoUrl: string;
  isAudio: boolean;
  /** Now-playing title (the material). */
  title: string;
  /** Now-playing artist (the course). */
  courseTitle: string;
  onProgress?: (progress: PlaybackProgress) => void;
  /** Playback reached the end of the media. */
  onEnded?: () => void;
  /** Fill the parent (no aspect ratio, corners or shadow) instead of a 16:9 card. */
  fill?: boolean;
  /** Seconds to start from, for a player remounted by a layout change. Read once on mount. */
  getStartAt?: () => number;
  ref?: Ref<MaterialPlayerHandle>;
}

/** Player mutations live outside components (hook results are read-only to the React compiler). */
function seekPlayer(player: VideoPlayer, seconds: number): void {
  player.currentTime = seconds;
}

function setPlayerRate(player: VideoPlayer, rate: number): void {
  player.playbackRate = rate;
}

function readProgress(player: VideoPlayer): PlaybackProgress {
  return {
    currentTime: Number.isFinite(player.currentTime) ? player.currentTime : 0,
    duration: Number.isFinite(player.duration) ? player.duration : 0,
    rate: player.playbackRate,
    playing: player.playing,
  };
}

/**
 * expo-video replacement of the legacy native media player: inline video
 * with native controls, PiP (auto on background), fullscreen in landscape,
 * lock-screen / notification controls with material + course metadata,
 * background playback, and the custom audio card for 語音 courses.
 *
 * Mount with `key={videoUrl}`: the source (and its metadata) is fixed for
 * the lifetime of the player so a late title does not restart playback.
 */
export function MaterialPlayer({
  videoUrl,
  isAudio,
  title,
  courseTitle,
  onProgress,
  onEnded,
  fill = false,
  getStartAt,
  ref,
}: MaterialPlayerProps) {
  const [source] = useState<VideoSource>(() => ({
    uri: videoUrl,
    metadata: { title, artist: courseTitle },
  }));
  const storedRate = usePlaybackRateStore((state) => state.rate);
  const setStoredRate = usePlaybackRateStore((state) => state.setRate);
  const [initialRate] = useState(storedRate);
  const [initialTime] = useState(() => getStartAt?.() ?? 0);
  const player = useVideoPlayer(source, (created) => {
    created.timeUpdateEventInterval = 1;
    created.showNowPlayingNotification = true;
    created.staysActiveInBackground = true;
    created.playbackRate = initialRate;

    if (initialTime > 0) {
      seekPlayer(created, initialTime);
    }

    created.play();
  });
  const videoViewRef = useRef<VideoView>(null);
  const videoFrameRef = useRef<ComponentRef<typeof View>>(null);
  const isFullscreenRef = useRef(false);
  const scrubbingRef = useRef(false);
  const [progress, setProgress] = useState<PlaybackProgress>({
    currentTime: 0,
    duration: 0,
    rate: initialRate,
    playing: false,
  });
  const [failed, setFailed] = useState(false);
  const [reloading, setReloading] = useState(false);
  const onProgressRef = useRef(onProgress);
  const onEndedRef = useRef(onEnded);

  useEffect(() => {
    onProgressRef.current = onProgress;
    onEndedRef.current = onEnded;
  }, [onProgress, onEnded]);

  const publish = useCallback(() => {
    const next = readProgress(player);

    if (!scrubbingRef.current) {
      setProgress(next);
    }

    onProgressRef.current?.(next);
  }, [player]);

  useEventListener(player, 'timeUpdate', publish);
  useEventListener(player, 'playingChange', publish);
  useEventListener(player, 'sourceLoad', publish);
  useEventListener(player, 'playToEnd', () => onEndedRef.current?.());
  useEventListener(player, 'playbackRateChange', ({ playbackRate }) => {
    if (playbackRate > 0) {
      setStoredRate(playbackRate);
    }

    publish();
  });
  useEventListener(player, 'statusChange', ({ status }) => {
    if (status === 'error') {
      setFailed(true);
    } else if (status === 'readyToPlay') {
      setFailed(false);
    }
  });

  useEffect(
    () => () => {
      if (isFullscreenRef.current) {
        void ScreenOrientation.unlockAsync().catch(() => undefined);
      }
    },
    [],
  );

  const seekTo = useCallback(
    (seconds: number) => {
      seekPlayer(player, clampSeek(seconds, player.duration));
      player.play();
      publish();
    },
    [player, publish],
  );

  const reload = useCallback(async () => {
    const resumeAt = player.currentTime;
    const wasPlaying = player.playing;

    setReloading(true);

    try {
      await player.replaceAsync(source);

      if (resumeAt > 0) {
        seekPlayer(player, resumeAt);
      }

      if (wasPlaying || failed) {
        player.play();
      }

      setFailed(false);
    } finally {
      setReloading(false);
    }
  }, [failed, player, source]);

  const setRate = useCallback(
    (rate: number) => {
      setPlayerRate(player, rate);
      setStoredRate(rate);
      publish();
    },
    [player, publish, setStoredRate],
  );

  useImperativeHandle(
    ref,
    () => ({
      getCurrentTime: () => readProgress(player).currentTime,
      getDuration: () => readProgress(player).duration,
      isPlaying: () => player.playing,
      seekTo,
      togglePlay: () => {
        if (player.playing) {
          player.pause();
        } else {
          player.play();
        }
      },
      setRate,
      reload,
      stop: () => {
        player.pause();
        seekPlayer(player, 0);
      },
      exitFullscreen: () => {
        if (!isFullscreenRef.current) {
          return false;
        }

        void videoViewRef.current?.exitFullscreen();

        return true;
      },
      captureFrame: async () => {
        if (isAudio) {
          return null;
        }

        const seconds = player.currentTime;

        try {
          const [thumbnail] = await player.generateThumbnailsAsync([seconds], {
            maxWidth: 1920,
          });

          if (thumbnail !== undefined) {
            return { thumbnail, seconds };
          }
        } catch {
          // AVAssetImageGenerator cannot read HLS (.m3u8) streams.
        }

        try {
          const frame = await captureVideoFrame(videoUrl, seconds);

          return { thumbnail: frame, seconds };
        } catch {
          // Android has no native grabber yet: snapshot the video view (needs the textureView below).
        }

        const target = videoFrameRef.current;

        if (!target) {
          return null;
        }

        const { width, height } = await new Promise<{
          width: number;
          height: number;
        }>((resolve) =>
          target.measure((_x, _y, w, h) => resolve({ width: w, height: h })),
        );
        const uri = await captureRef(target, {
          format: 'jpg',
          quality: 0.9,
          result: 'tmpfile',
        });

        return { thumbnail: { uri, width, height }, seconds };
      },
    }),
    [isAudio, player, reload, seekTo, setRate, videoUrl],
  );

  const errorBanner = failed ? (
    <View className="bg-theme-900/90 mt-2 flex-row items-center justify-between gap-3 rounded-xl px-3 py-2">
      <Text className="flex-1 text-xs text-theme-100">
        影音播放失敗，請檢查網路後重新載入。
      </Text>
      <Button
        label="重新載入"
        variant="secondary"
        loading={reloading}
        onPress={() => void reload()}
      />
    </View>
  ) : null;

  if (isAudio) {
    return (
      <View>
        <AudioPlayerControls
          title={title}
          subtitle={courseTitle}
          playing={progress.playing}
          currentTime={progress.currentTime}
          duration={progress.duration}
          rate={progress.rate}
          onTogglePlay={() => {
            if (player.playing) {
              player.pause();
            } else {
              player.play();
            }
          }}
          onSkip={(delta) => seekTo(player.currentTime + delta)}
          onSeek={seekTo}
          onRateChange={setRate}
          onScrubbingChange={(scrubbing) => {
            scrubbingRef.current = scrubbing;
          }}
        />
        {errorBanner}
      </View>
    );
  }

  return (
    <View className={fill ? 'flex-1' : ''}>
      <View
        ref={videoFrameRef}
        collapsable={false}
        className={
          fill
            ? 'w-full flex-1 overflow-hidden bg-black'
            : 'aspect-video w-full overflow-hidden rounded-xl bg-black shadow'
        }
      >
        <VideoView
          ref={videoViewRef}
          player={player}
          style={{ width: '100%', height: '100%' }}
          contentFit="contain"
          // The default SurfaceView renders outside the view tree, so captureRef sees a blank frame.
          surfaceType="textureView"
          nativeControls
          allowsPictureInPicture
          startsPictureInPictureAutomatically
          fullscreenOptions={{
            enable: true,
            orientation: 'landscape',
          }}
          onFullscreenEnter={() => {
            isFullscreenRef.current = true;
          }}
          onFullscreenExit={() => {
            isFullscreenRef.current = false;
            void ScreenOrientation.unlockAsync().catch(() => undefined);
          }}
          accessibilityLabel={title}
        />
      </View>
      {errorBanner}
    </View>
  );
}
