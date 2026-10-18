import { Sheet, Text } from '@altuu/ui';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import { useAccounts, useSwitchAccount } from '../services/hooks';
import { useSessionExpiryStore } from '../services/stores';
import { AccountListItem } from './AccountListItem';

/**
 * Shown when the active account's login died and other accounts exist
 * (legacy SessionExpiredPicker): switch to another account, or re-login the
 * failed one.
 */
export function SessionExpiredPicker() {
  const pickerOpen = useSessionExpiryStore((state) => state.pickerOpen);
  const failedAccountId = useSessionExpiryStore(
    (state) => state.failedAccountId,
  );
  const closePicker = useSessionExpiryStore((state) => state.closePicker);
  const setReturnTo = useSessionExpiryStore((state) => state.setReturnTo);
  const accounts = useAccounts();
  const { switchAccount, switchingAccountId } = useSwitchAccount();
  const [flash, setFlash] = useState<string | null>(null);

  const list = accounts.data ?? [];
  const failedAccount = list.find((account) => account.id === failedAccountId);
  const otherAccounts = list.filter(
    (account) => account.id !== failedAccountId,
  );
  const failedAccountName =
    failedAccount?.nickname ??
    failedAccount?.displayName ??
    failedAccount?.username ??
    '目前帳號';

  const goToReauth = (accountId: number) => {
    setReturnTo(useSessionExpiryStore.getState().currentPath);
    closePicker();
    router.push(`/reauth/${accountId}`);
  };

  const onSelectAccount = async (accountId: number) => {
    if (switchingAccountId !== null) {
      return;
    }

    setFlash(null);

    try {
      const result = await switchAccount(accountId);

      if (result.ok) {
        closePicker();

        return;
      }

      // The target account's own session is dead too: chain into the
      // same re-login screen instead of dead-ending here.
      if (result.message.includes('已失效')) {
        goToReauth(accountId);
      } else {
        setFlash(result.message);
      }
    } catch (error) {
      setFlash(error instanceof Error ? error.message : '切換帳號失敗。');
    }
  };

  return (
    <Sheet visible={pickerOpen} onClose={closePicker}>
      <View className="px-5 py-4">
        <Text className="text-lg font-semibold text-theme-900 dark:text-zinc-100">
          登入已失效
        </Text>
        <Text className="mt-1 text-sm text-theme-700 dark:text-zinc-400">
          {`「${failedAccountName}」需要重新登入，您可以切換到其他帳號繼續使用。`}
        </Text>
        {flash ? (
          <Text className="mt-2 text-sm text-rose-600 dark:text-rose-400">
            {flash}
          </Text>
        ) : null}
      </View>

      <ScrollView
        className="max-h-80 border-t border-theme-200 dark:border-zinc-700"
        bounces={false}
      >
        {otherAccounts.map((account) => (
          <AccountListItem
            key={account.id}
            account={account}
            disabled={switchingAccountId === account.id}
            onSelect={() => void onSelectAccount(account.id)}
            trailing={
              switchingAccountId === account.id ? (
                <Text className="text-xs text-theme-700 dark:text-zinc-400">
                  切換中…
                </Text>
              ) : null
            }
          />
        ))}
      </ScrollView>

      {failedAccountId !== null ? (
        <View className="border-t border-theme-200 px-5 py-3 dark:border-zinc-700">
          <Pressable
            testID="session-expired-reauth"
            accessibilityRole="button"
            onPress={() => goToReauth(failedAccountId)}
          >
            <Text className="text-center text-sm font-medium text-theme-700 dark:text-zinc-300">
              {`重新登入「${failedAccountName}」`}
            </Text>
          </Pressable>
        </View>
      ) : null}
    </Sheet>
  );
}
