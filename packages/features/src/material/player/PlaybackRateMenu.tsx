import { Sheet, Text } from '@altuu/ui';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { create } from 'zustand';

import { PLAYBACK_RATES, formatPlaybackRate } from './playback';

interface PlaybackRateState {
    rate: number;
    setRate: (rate: number) => void;
}

/**
 * The chosen speed outlives a material (the legacy native player kept it
 * across `SetPlayer` calls).
 */
export const usePlaybackRateStore = create<PlaybackRateState>()((set) => ({
    rate: 1,
    setRate: (rate) => set({ rate }),
}));

export interface PlaybackRateMenuProps {
    rate: number;
    onSelect: (rate: number) => void;
    /** `chip`: filled pill (audio card); `button`: toolbar button (video). */
    variant?: 'chip' | 'button';
}

/** Speed button + picker (legacy confirmation dialog 「播放速度」). */
export function PlaybackRateMenu({
    rate,
    onSelect,
    variant = 'button',
}: PlaybackRateMenuProps) {
    const [open, setOpen] = useState(false);
    const label = formatPlaybackRate(rate);

    return (
        <>
            <Pressable
                accessibilityRole="button"
                accessibilityLabel={`播放速度 ${label}`}
                onPress={() => setOpen(true)}
                hitSlop={6}
                className={
                    variant === 'chip'
                        ? 'rounded-full bg-theme-700 px-2 py-1 dark:bg-theme-400'
                        : 'h-10 min-w-12 items-center justify-center rounded-lg border border-theme-200 bg-white px-2 dark:border-zinc-600 dark:bg-zinc-700'
                }
            >
                <Text
                    className={
                        variant === 'chip'
                            ? 'text-xs font-semibold text-white dark:text-black'
                            : 'text-sm font-semibold tabular-nums text-theme-900 dark:text-zinc-100'
                    }
                >
                    {label}
                </Text>
            </Pressable>
            <Sheet visible={open} onClose={() => setOpen(false)}>
                <View className="border-b border-theme-200 px-5 py-3 dark:border-zinc-700">
                    <Text className="text-center text-sm font-semibold text-theme-700 dark:text-zinc-300">
                        播放速度
                    </Text>
                </View>
                {[...PLAYBACK_RATES].reverse().map((option) => {
                    const selected = Math.abs(option - rate) < 0.01;

                    return (
                        <Pressable
                            key={option}
                            accessibilityRole="button"
                            accessibilityState={{ selected }}
                            onPress={() => {
                                setOpen(false);
                                onSelect(option);
                            }}
                            className="border-b border-theme-100 px-5 py-3 active:bg-theme-50 dark:border-zinc-800 dark:active:bg-zinc-800"
                        >
                            <Text
                                className={`text-center text-base ${selected ? 'font-bold text-theme-700 dark:text-theme-400' : 'text-theme-900 dark:text-zinc-100'}`}
                            >
                                {formatPlaybackRate(option)}
                            </Text>
                        </Pressable>
                    );
                })}
                <Pressable
                    accessibilityRole="button"
                    onPress={() => setOpen(false)}
                    className="px-5 py-3 active:bg-theme-50 dark:active:bg-zinc-800"
                >
                    <Text className="text-center text-base font-semibold text-theme-700 dark:text-zinc-300">
                        取消
                    </Text>
                </Pressable>
            </Sheet>
        </>
    );
}
