/**
 * Dev-only helper for the Maestro session-expiry flow
 * (apps/mobile/e2e/session-expiry.yaml). Opened via `altuu://dev/expire-session`,
 * it simulates a password changed elsewhere: the active account's HUNGU
 * session is dropped and its remembered password replaced, so the next
 * HUNGU call fails the remembered re-login and the app starts the
 * re-authentication flow. Nothing is reachable in release builds.
 */
import { useServiceRuntime } from '@altuu/features';
import { Screen, Text } from '@altuu/ui';
import { Redirect, router } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

const INVALID_PASSWORD = 'altuu-e2e-invalid-password';

function ExpireSession() {
  const runtime = useServiceRuntime();
  const [status, setStatus] = useState<string | null>(null);

  const expire = async () => {
    const { storage } = runtime.services;
    const accountId = await storage.activeProfile.get();
    const credentials = await storage.credentials.get();

    if (accountId === null || credentials === null) {
      setStatus('沒有登入中的帳號。');

      return;
    }

    await storage.credentials.put(
      { username: credentials.username, password: INVALID_PASSWORD },
      accountId,
    );
    await storage.hunguSessions.clear(accountId);
    await runtime.queryClient.resetQueries();
    router.replace('/courses');
  };

  return (
    <Screen className="px-4">
      <View className="gap-3 py-6">
        <Text className="text-lg font-semibold">Expire session (dev)</Text>
        <Text className="text-sm">
          Drops the active account&apos;s HUNGU session and replaces its
          remembered password, then returns to the course list.
        </Text>
        <Pressable
          testID="dev-expire-session"
          accessibilityRole="button"
          className="items-center rounded-xl bg-theme-700 px-4 py-3"
          onPress={() => void expire()}
        >
          <Text className="font-medium text-theme-50">Expire session</Text>
        </Pressable>
        {status ? <Text className="text-sm">{status}</Text> : null}
      </View>
    </Screen>
  );
}

export default function ExpireSessionRoute() {
  if (!__DEV__) {
    return <Redirect href="/" />;
  }

  return <ExpireSession />;
}
