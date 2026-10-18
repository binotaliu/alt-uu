import { Sheet, Text } from '@altuu/ui';
import { useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

function PromptActions({
  primaryLabel,
  secondaryLabel,
  onPrimary,
  onSecondary,
}: {
  primaryLabel: string;
  secondaryLabel: string;
  onPrimary: () => void;
  onSecondary: () => void;
}) {
  return (
    <View className="mt-4 flex-row gap-3">
      <Pressable
        accessibilityRole="button"
        onPress={onPrimary}
        className="flex-1 items-center rounded-xl bg-theme-900 px-4 py-2.5 active:bg-theme-700"
      >
        <Text className="text-sm font-medium text-white">{primaryLabel}</Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        onPress={onSecondary}
        className="flex-1 items-center rounded-xl border border-theme-200 px-4 py-2.5 active:border-theme-400 dark:border-zinc-700"
      >
        <Text className="text-sm font-medium text-theme-700 dark:text-zinc-300">
          {secondaryLabel}
        </Text>
      </Pressable>
    </View>
  );
}

export interface ResumePromptProps {
  /** Formatted position (`formatDurationLabel`), null when closed. */
  label: string | null;
  onResume: () => void;
  onRestart: () => void;
}

/** 「接續上次播放？」 (legacy resume prompt). */
export function ResumePrompt({
  label,
  onResume,
  onRestart,
}: ResumePromptProps) {
  return (
    <Sheet visible={label !== null} onClose={onRestart}>
      <View className="px-5 py-5">
        <Text className="text-sm font-semibold text-theme-900 dark:text-zinc-100">
          接續上次播放？
        </Text>
        <Text className="mt-1 text-sm text-theme-700 dark:text-zinc-400">
          上次播放到
          <Text className="text-sm font-medium text-theme-900 dark:text-zinc-100">
            {label}
          </Text>
          ，是否從此處繼續？
        </Text>
        <PromptActions
          primaryLabel="接續播放"
          secondaryLabel="從頭開始"
          onPrimary={onResume}
          onSecondary={onRestart}
        />
      </View>
    </Sheet>
  );
}

export interface CellularPromptProps {
  visible: boolean;
  onResolve: (allowed: boolean, dontAskAgain: boolean) => void;
}

/** 「使用行動網路播放？」 (legacy cellular confirmation). */
export function CellularPrompt({ visible, onResolve }: CellularPromptProps) {
  const [dontAskAgain, setDontAskAgain] = useState(false);

  const resolve = (allowed: boolean) => {
    const remember = dontAskAgain;

    setDontAskAgain(false);
    onResolve(allowed, remember);
  };

  return (
    <Sheet
      visible={visible}
      onClose={() => resolve(false)}
      dismissOnBackdrop={false}
    >
      <View className="px-5 py-5">
        <Text className="text-sm font-semibold text-theme-900 dark:text-zinc-100">
          使用行動網路播放？
        </Text>
        <Text className="mt-1 text-sm text-theme-700 dark:text-zinc-400">
          您目前透過行動網路（非
          Wi-Fi）連線，播放教材影音可能會消耗較多行動數據，是否繼續播放？
        </Text>
        <Pressable
          accessibilityRole="checkbox"
          accessibilityState={{ checked: dontAskAgain }}
          onPress={() => setDontAskAgain((value) => !value)}
          className="mt-3 flex-row items-center gap-2"
        >
          <View
            className={`h-4 w-4 items-center justify-center rounded border ${dontAskAgain ? 'border-theme-700 bg-theme-700' : 'border-theme-300 dark:border-zinc-600'}`}
          >
            {dontAskAgain ? (
              <Text className="text-[10px] font-bold leading-none text-white">
                ✓
              </Text>
            ) : null}
          </View>
          <Text className="text-sm text-theme-700 dark:text-zinc-300">
            不再詢問（可於設定頁面重新開啟）
          </Text>
        </Pressable>
        <PromptActions
          primaryLabel="繼續播放"
          secondaryLabel="返回課程"
          onPrimary={() => resolve(true)}
          onSecondary={() => resolve(false)}
        />
      </View>
    </Sheet>
  );
}

/** Top toast while the visit is being reported (legacy slide-down card). */
export function SavingProgressToast({ visible }: { visible: boolean }) {
  const insets = useSafeAreaInsets();

  if (!visible) {
    return null;
  }

  return (
    <View
      pointerEvents="none"
      className="absolute left-0 right-0 items-center px-4"
      style={{ top: insets.top + 8 }}
      accessibilityLiveRegion="polite"
    >
      <View className="w-full max-w-md flex-row items-center gap-3 rounded-2xl border border-theme-200 bg-white/95 px-4 py-3 shadow-lg dark:border-zinc-700 dark:bg-zinc-900/95">
        <ActivityIndicator size="small" />
        <View>
          <Text className="text-sm font-semibold text-theme-900 dark:text-zinc-100">
            正在保存學習進度
          </Text>
          <Text className="text-xs text-theme-700 dark:text-zinc-400">
            已儲存最新位置，請稍候…
          </Text>
        </View>
      </View>
    </View>
  );
}
