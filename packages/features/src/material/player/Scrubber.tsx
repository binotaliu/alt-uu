import { useState } from 'react';
import { View, type GestureResponderEvent } from 'react-native';

import { SKIP_SECONDS, clampSeek, formatPlayerTime } from './playback';

export interface ScrubberProps {
    currentTime: number;
    duration: number;
    onSeek: (seconds: number) => void;
    /** Called with true while the user drags (pause UI time updates). */
    onScrubbingChange?: (scrubbing: boolean) => void;
}

/** Seek bar of the audio controls (legacy SwiftUI Slider). */
export function Scrubber({
    currentTime,
    duration,
    onSeek,
    onScrubbingChange,
}: ScrubberProps) {
    const [width, setWidth] = useState(0);
    const [dragTime, setDragTime] = useState<number | null>(null);
    const max = duration > 0 ? duration : 1;
    const shown = dragTime ?? currentTime;
    const progress = Math.max(0, Math.min(1, shown / max));

    const timeAt = (event: GestureResponderEvent) => {
        if (width <= 0) {
            return 0;
        }

        return (
            Math.max(0, Math.min(1, event.nativeEvent.locationX / width)) * max
        );
    };

    const finish = (event: GestureResponderEvent | null) => {
        const target = event === null ? null : timeAt(event);

        setDragTime(null);
        onScrubbingChange?.(false);

        if (target !== null) {
            onSeek(target);
        }
    };

    return (
        <View
            accessible
            accessibilityRole="adjustable"
            accessibilityLabel="播放進度"
            accessibilityValue={{
                text: `${formatPlayerTime(shown)} / ${formatPlayerTime(duration)}`,
            }}
            accessibilityActions={[
                { name: 'increment' },
                { name: 'decrement' },
            ]}
            onAccessibilityAction={(event) => {
                const delta =
                    event.nativeEvent.actionName === 'increment'
                        ? SKIP_SECONDS
                        : -SKIP_SECONDS;

                onSeek(clampSeek(currentTime + delta, duration));
            }}
            className="h-7 flex-1 justify-center"
            onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
            onStartShouldSetResponder={() => true}
            onMoveShouldSetResponder={() => true}
            onResponderTerminationRequest={() => false}
            onResponderGrant={(event) => {
                onScrubbingChange?.(true);
                setDragTime(timeAt(event));
            }}
            onResponderMove={(event) => setDragTime(timeAt(event))}
            onResponderRelease={(event) => finish(event)}
            onResponderTerminate={() => finish(null)}
            testID="audio-scrubber"
        >
            <View
                pointerEvents="none"
                className="h-1 overflow-hidden rounded-full bg-theme-200 dark:bg-zinc-700"
            >
                <View
                    className="h-1 bg-theme-700 dark:bg-theme-400"
                    style={{ width: `${progress * 100}%` }}
                />
            </View>
            <View
                pointerEvents="none"
                className="absolute h-4 w-4 rounded-full border border-theme-300 bg-white shadow dark:border-zinc-500"
                style={{ left: `${progress * 100}%`, marginLeft: -8 }}
            />
        </View>
    );
}
