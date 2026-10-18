import { accentPalettes, Text, type AccentName, Icon } from '@altuu/ui';
import { router } from 'expo-router';
import { useEffect } from 'react';
import { Pressable, View } from 'react-native';

import {
  useAccounts,
  useAppPreferences,
  useUpdatePreferences,
} from '../../services/hooks';
import { asServiceError } from '../../services/serviceError';
import {
  Card,
  CardDescription,
  CardTitle,
  FlashBanner,
  PremiumBadge,
  useFlash,
} from './primitives';
import { useSubscriptionStatus } from '../hooks/useSubscriptionStatus';

const DEFAULT_ACCENT: AccentName = 'warm';

const APPEARANCE_OPTIONS = [
  { value: 'system', label: '自動' },
  { value: 'light', label: '淺色' },
  { value: 'dark', label: '深色' },
] as const;

export const ACCENT_OPTIONS: ReadonlyArray<{ id: AccentName; label: string }> =
  [
    { id: 'warm', label: '暖橘' },
    { id: 'ocean', label: '海藍' },
    { id: 'forest', label: '森綠' },
    { id: 'purple', label: '皇紫' },
    { id: 'pink', label: '粉紅' },
    { id: 'red', label: '緋紅' },
    { id: 'grey', label: '銀灰' },
  ];

/** Legacy ThemeSettings: appearance picker and (Alt UU+) accent colours. */
export function ThemeSettings() {
  const { appearance, accentColor, altUuPlusDisabled } = useAppPreferences();
  const updatePreferences = useUpdatePreferences();
  const accounts = useAccounts();
  const subscription = useSubscriptionStatus({ refreshOnMount: false });
  const { flash, show } = useFlash();

  // Settings is reachable before login; only talk to the subscription
  // backend once an account exists.
  const hasAccounts = (accounts.data?.length ?? 0) > 0;
  const { refresh } = subscription;

  useEffect(() => {
    if (hasAccounts) {
      void refresh();
    }
  }, [hasAccounts, refresh]);

  const goToSubscription = () => router.push('/courses/account/subscription');

  const setAppearance = async (
    value: (typeof APPEARANCE_OPTIONS)[number]['value'],
  ) => {
    try {
      await updatePreferences.mutateAsync({ appearance: value });
    } catch {
      show('儲存設定失敗，請稍後再試。', 'error');
    }
  };

  const setAccent = async (value: AccentName) => {
    if (value === accentColor) {
      return;
    }

    if (value !== DEFAULT_ACCENT) {
      if (!hasAccounts) {
        show('登入並訂閱 Alt UU+ 後即可更換主題色。', 'error');

        return;
      }

      if (!subscription.active) {
        goToSubscription();

        return;
      }
    }

    try {
      await updatePreferences.mutateAsync({ accentColor: value });
    } catch (error) {
      if (asServiceError(error)?.status === 402) {
        // The backend disagrees with the cached entitlement: resync,
        // then let the user subscribe.
        void refresh();
        goToSubscription();
      } else {
        show('儲存設定失敗，請稍後再試。', 'error');
      }
    }
  };

  return (
    <Card>
      <FlashBanner flash={flash} />
      <CardTitle>外觀</CardTitle>
      <CardDescription className="mt-1">
        選擇深色或淺色模式，或依照系統設定自動切換。
      </CardDescription>

      <View className="mt-3 flex-row rounded-xl border border-theme-200 bg-theme-50 p-1 dark:border-zinc-700 dark:bg-zinc-800">
        {APPEARANCE_OPTIONS.map((option) => {
          const selected = appearance === option.value;

          return (
            <Pressable
              key={option.value}
              accessibilityRole="button"
              accessibilityState={{
                selected,
                disabled: updatePreferences.isPending,
              }}
              testID={`appearance-${option.value}`}
              disabled={updatePreferences.isPending}
              onPress={() => void setAppearance(option.value)}
              className={`flex-1 items-center rounded-lg px-3 py-2 ${
                selected ? 'bg-white dark:bg-zinc-700' : ''
              }`}
            >
              <Text
                className={`text-sm font-medium ${
                  selected
                    ? 'text-theme-900 dark:text-zinc-100'
                    : 'text-theme-700 dark:text-zinc-400'
                }`}
              >
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {altUuPlusDisabled ? null : (
        <>
          <View className="mt-4 flex-row items-center gap-2">
            <Text className="text-xs font-medium text-theme-700 dark:text-zinc-400">
              主題色
            </Text>
            {subscription.active ? null : <PremiumBadge />}
          </View>
          <View className="mt-2 flex-row flex-wrap items-center justify-between gap-2">
            {ACCENT_OPTIONS.map((option) => {
              const selected = accentColor === option.id;

              return (
                <Pressable
                  key={option.id}
                  accessibilityRole="button"
                  accessibilityLabel={option.label}
                  accessibilityState={{
                    selected,
                    disabled: updatePreferences.isPending,
                  }}
                  testID={`accent-${option.id}`}
                  disabled={updatePreferences.isPending}
                  onPress={() => void setAccent(option.id)}
                  style={{
                    backgroundColor: accentPalettes[option.id]['400'],
                  }}
                  className={`size-9 items-center justify-center rounded-xl border-2 ${
                    selected ? 'border-theme-500' : 'border-transparent'
                  }`}
                >
                  {selected ? (
                    <Icon solid name="check" size={20} className="text-white" />
                  ) : !subscription.active && option.id !== DEFAULT_ACCENT ? (
                    <Icon
                      name="lock-closed"
                      size={16}
                      className="text-white/90"
                    />
                  ) : null}
                </Pressable>
              );
            })}
          </View>
        </>
      )}
    </Card>
  );
}
