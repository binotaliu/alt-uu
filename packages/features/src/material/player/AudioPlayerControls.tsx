import { Text } from '@altuu/ui';
import { VideoAirPlayButton } from 'expo-video';
import { Platform, Pressable, View } from 'react-native';

import { MaterialIcon, PlayPauseGlyph } from '../MaterialIcon';
import { PlaybackRateMenu } from './PlaybackRateMenu';
import { SKIP_SECONDS, formatPlayerTime } from './playback';
import { Scrubber } from './Scrubber';

export interface AudioPlayerControlsProps {
  title: string;
  subtitle: string;
  playing: boolean;
  currentTime: number;
  duration: number;
  rate: number;
  onTogglePlay: () => void;
  onSkip: (deltaSeconds: number) => void;
  onSeek: (seconds: number) => void;
  onRateChange: (rate: number) => void;
  onScrubbingChange?: (scrubbing: boolean) => void;
}

/**
 * The audio material card of the legacy native player: material / course
 * title, speed menu, AirPlay (iOS), ±10 s, play / pause and a seek bar.
 */
export function AudioPlayerControls({
  title,
  subtitle,
  playing,
  currentTime,
  duration,
  rate,
  onTogglePlay,
  onSkip,
  onSeek,
  onRateChange,
  onScrubbingChange,
}: AudioPlayerControlsProps) {
  return (
    <View className="gap-2 rounded-xl border border-theme-700 bg-white px-3 py-2.5 dark:border-zinc-700 dark:bg-zinc-900">
      <View className="flex-row items-center gap-2">
        <View className="min-w-0 flex-1">
          <Text
            numberOfLines={1}
            className="text-xs font-semibold text-theme-700 dark:text-theme-400"
          >
            {title || '語音課程'}
          </Text>
          {subtitle ? (
            <Text
              numberOfLines={1}
              className="text-[11px] text-black/75 dark:text-zinc-400"
            >
              {subtitle}
            </Text>
          ) : null}
        </View>
        <PlaybackRateMenu rate={rate} onSelect={onRateChange} variant="chip" />
        {Platform.OS === 'ios' ? (
          <VideoAirPlayButton style={{ width: 28, height: 28 }} />
        ) : null}
      </View>

      <View className="flex-row items-center gap-2.5">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`倒退 ${SKIP_SECONDS} 秒`}
          hitSlop={6}
          onPress={() => onSkip(-SKIP_SECONDS)}
        >
          <MaterialIcon
            name="skip-back"
            size={22}
            className="text-theme-700 dark:text-theme-400"
          />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={playing ? '暫停' : '播放'}
          hitSlop={6}
          onPress={onTogglePlay}
          className="h-8 w-8 items-center justify-center rounded-full border border-theme-700 bg-theme-700 dark:border-zinc-600 dark:bg-theme-400"
        >
          <PlayPauseGlyph playing={playing} />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`快轉 ${SKIP_SECONDS} 秒`}
          hitSlop={6}
          onPress={() => onSkip(SKIP_SECONDS)}
        >
          <MaterialIcon
            name="skip-forward"
            size={22}
            className="text-theme-700 dark:text-theme-400"
          />
        </Pressable>
        <Scrubber
          currentTime={currentTime}
          duration={duration}
          onSeek={onSeek}
          onScrubbingChange={onScrubbingChange}
        />
      </View>

      <View className="flex-row justify-between">
        <Text className="text-[11px] tabular-nums text-black/65 dark:text-zinc-400">
          {formatPlayerTime(currentTime)}
        </Text>
        <Text className="text-[11px] tabular-nums text-black/65 dark:text-zinc-400">
          {formatPlayerTime(duration)}
        </Text>
      </View>
    </View>
  );
}
