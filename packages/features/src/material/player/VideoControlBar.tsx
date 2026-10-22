import { Text } from '@altuu/ui';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MaterialIcon, PlayPauseGlyph } from '../MaterialIcon';
import { PlaybackRateMenu } from './PlaybackRateMenu';
import { SKIP_SECONDS, formatPlayerTime } from './playback';
import { Scrubber } from './Scrubber';

export interface VideoControlBarProps {
  playing: boolean;
  currentTime: number;
  duration: number;
  rate: number;
  onTogglePlay: () => void;
  onSkip: (deltaSeconds: number) => void;
  onSeek: (seconds: number) => void;
  onRateChange: (rate: number) => void;
}

/**
 * Seek bar and play controls pinned to the bottom of the screen while the video fills the
 * top half of a folded iPhone Duo: the lower half is the one to reach with a thumb.
 */
export function VideoControlBar({
  playing,
  currentTime,
  duration,
  rate,
  onTogglePlay,
  onSkip,
  onSeek,
  onRateChange,
}: VideoControlBarProps) {
  const insets = useSafeAreaInsets();

  return (
    <View
      testID="video-control-bar"
      className="gap-1 border-t border-theme-200 bg-white px-8 pt-2 dark:border-zinc-700 dark:bg-zinc-900"
      style={{ paddingBottom: Math.max(insets.bottom, 12) }}
    >
      <View className="flex-row items-center gap-3">
        <Text className="w-12 text-xs tabular-nums text-black/65 dark:text-zinc-400">
          {formatPlayerTime(currentTime)}
        </Text>
        <Scrubber
          currentTime={currentTime}
          duration={duration}
          onSeek={onSeek}
        />
        <Text className="w-12 text-right text-xs tabular-nums text-black/65 dark:text-zinc-400">
          {formatPlayerTime(duration)}
        </Text>
      </View>

      <View className="flex-row items-center justify-center gap-8">
        <PlaybackRateMenu rate={rate} onSelect={onRateChange} variant="chip" />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`倒退 ${SKIP_SECONDS} 秒`}
          hitSlop={10}
          onPress={() => onSkip(-SKIP_SECONDS)}
        >
          <MaterialIcon
            name="skip-back"
            size={28}
            className="text-theme-700 dark:text-theme-400"
          />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={playing ? '暫停' : '播放'}
          hitSlop={8}
          onPress={onTogglePlay}
          className="h-12 w-12 items-center justify-center rounded-full border border-theme-700 bg-theme-700 dark:border-zinc-600 dark:bg-theme-400"
        >
          <PlayPauseGlyph playing={playing} />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`快轉 ${SKIP_SECONDS} 秒`}
          hitSlop={10}
          onPress={() => onSkip(SKIP_SECONDS)}
        >
          <MaterialIcon
            name="skip-forward"
            size={28}
            className="text-theme-700 dark:text-theme-400"
          />
        </Pressable>
        <View className="w-12" />
      </View>
    </View>
  );
}
