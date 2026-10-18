import { Sheet, Text } from '@altuu/ui';
import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { Alert, Pressable, ScrollView, View } from 'react-native';

import { useAccounts, useSwitchAccount } from '../../services/hooks';
import {
  useClientConfigStore,
  useSessionExpiryStore,
} from '../../services/stores';
import { AccountListItem } from '../../shell/AccountListItem';
import { Avatar } from './primitives';

const LONG_PRESS_MS = 500;

/**
 * Legacy header action: the active account as a pill. Tap opens the account
 * tab; a long press (with more than one account) opens the quick switcher.
 *
 * @example
 * <TransparentPageHeader title="我的課程" actions={<AccountSwitcherButton />} />
 */
export function AccountSwitcherButton() {
  const profile = useClientConfigStore((state) => state.profile);
  const accounts = useAccounts();
  const { switchAccount, switchingAccountId } = useSwitchAccount();
  const [menuOpen, setMenuOpen] = useState(false);
  const longPressed = useRef(false);

  const list = accounts.data ?? [];
  const canQuickSwitch = list.length > 1;
  const label =
    profile?.nickname ?? profile?.username ?? profile?.displayName ?? '帳號';

  const onPress = () => {
    if (longPressed.current) {
      longPressed.current = false;

      return;
    }

    router.push('/courses/account');
  };

  const onLongPress = () => {
    if (canQuickSwitch) {
      longPressed.current = true;
      setMenuOpen(true);
    }
  };

  const onSelectAccount = async (accountId: number, isActive: boolean) => {
    if (isActive || switchingAccountId !== null) {
      setMenuOpen(false);

      return;
    }

    try {
      const result = await switchAccount(accountId);

      if (result.ok) {
        setMenuOpen(false);

        return;
      }

      if (result.message.includes('已失效')) {
        setMenuOpen(false);
        useSessionExpiryStore
          .getState()
          .setReturnTo(useSessionExpiryStore.getState().currentPath);
        router.push(`/reauth/${accountId}`);

        return;
      }

      Alert.alert('切換帳號失敗', result.message);
    } catch (error) {
      Alert.alert(
        '切換帳號失敗',
        error instanceof Error ? error.message : '切換帳號失敗，請稍後再試。',
      );
    }
  };

  return (
    <>
      <Pressable
        testID="account-switcher"
        accessibilityRole="button"
        accessibilityLabel={`帳號：${label}`}
        accessibilityHint={canQuickSwitch ? '長按可快速切換帳號' : undefined}
        delayLongPress={LONG_PRESS_MS}
        onPress={onPress}
        onLongPress={onLongPress}
        className="max-w-[10rem] flex-row items-center gap-2 rounded-full border border-theme-300 bg-white py-1 pl-1 pr-3 active:bg-theme-50 dark:border-zinc-600 dark:bg-zinc-800 dark:active:bg-zinc-700"
      >
        {profile === null ? (
          <>
            <View className="size-6 rounded-full bg-theme-200 dark:bg-zinc-700" />
            <View className="h-4 w-12 rounded bg-theme-200 dark:bg-zinc-700" />
          </>
        ) : (
          <>
            <Avatar picture={profile.picture} size={24} />
            <Text
              numberOfLines={1}
              className="shrink text-sm font-medium text-theme-700 dark:text-zinc-300"
            >
              {label}
            </Text>
          </>
        )}
      </Pressable>

      <Sheet visible={menuOpen} onClose={() => setMenuOpen(false)}>
        <View className="px-5 py-4">
          <Text className="text-lg font-semibold text-theme-900 dark:text-zinc-100">
            切換帳號
          </Text>
        </View>

        <ScrollView
          className="max-h-80 border-t border-theme-200 dark:border-zinc-700"
          bounces={false}
        >
          {list.map((account) => (
            <AccountListItem
              key={account.id}
              account={account}
              disabled={switchingAccountId === account.id}
              onSelect={() =>
                void onSelectAccount(account.id, account.isActive)
              }
              trailing={
                account.isActive ? (
                  <View className="rounded-full bg-amber-700 px-2 py-0.5">
                    <Text className="text-xs font-semibold text-white">
                      目前帳號
                    </Text>
                  </View>
                ) : switchingAccountId === account.id ? (
                  <Text className="text-xs text-theme-700 dark:text-zinc-400">
                    切換中…
                  </Text>
                ) : null
              }
            />
          ))}
        </ScrollView>

        <View className="border-t border-theme-200 px-5 py-3 dark:border-zinc-700">
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              setMenuOpen(false);
              router.push('/courses/account');
            }}
          >
            <Text className="text-center text-sm font-medium text-theme-700 dark:text-zinc-300">
              管理帳號
            </Text>
          </Pressable>
        </View>
      </Sheet>
    </>
  );
}
