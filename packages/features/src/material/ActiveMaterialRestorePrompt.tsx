import { Sheet, Text } from '@altuu/ui';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';

import { useServiceRuntime } from '../services/AppServicesProvider';
import type { ServiceRuntime } from '../services/runtime';
import {
  clearActiveMaterialSession,
  pendingStudyTimeInput,
  readActiveMaterialSession,
  type ActiveMaterialSession,
} from './activeMaterialSession';

let restoreCheckDone = false;

/** Test hook: lets the once-per-launch check run again. */
export function resetActiveMaterialRestoreForTests(): void {
  restoreCheckDone = false;
}

/**
 * Handles a material visit interrupted by the app being killed: reports
 * its study time (start → last checkpoint), clears it, and returns it when
 * media was playing for the same account so the user can be offered to go
 * back (legacy `restoreActiveMediaRoute`). Runs once per app launch.
 */
export async function recoverActiveMaterialSession(
  runtime: Pick<ServiceRuntime, 'run' | 'services'>,
): Promise<ActiveMaterialSession | null> {
  const { services } = runtime;
  const keyValues = services.storage.keyValues;
  const session = await readActiveMaterialSession(keyValues);

  if (session === null) {
    return null;
  }

  const activeAccountId = await services.storage.activeProfile.get();
  const sameAccount = session.accountId === activeAccountId;
  const pending = pendingStudyTimeInput(session);

  if (sameAccount && pending !== null) {
    try {
      await runtime.run('studyTime.record', () =>
        services.studyTime.record(pending),
      );
    } catch {
      // Lost like a failed legacy beacon.
    }
  }

  await clearActiveMaterialSession(keyValues);

  return sameAccount && session.wasPlaying ? session : null;
}

export interface RestoreActiveMediaRoute {
  /** The interrupted visit to offer, or null. */
  session: ActiveMaterialSession | null;
  /** Navigates back to the material and closes the offer. */
  resume: () => void;
  dismiss: () => void;
}

/**
 * Legacy `restoreActiveMediaRoute`: on the first mount per app launch it
 * recovers an interrupted material visit (reporting its study time) and,
 * when media was playing, exposes it so the caller can offer to go back.
 */
export function useRestoreActiveMediaRoute(): RestoreActiveMediaRoute {
  const runtime = useServiceRuntime();
  const [session, setSession] = useState<ActiveMaterialSession | null>(null);

  useEffect(() => {
    if (restoreCheckDone) {
      return;
    }

    restoreCheckDone = true;
    let cancelled = false;

    void recoverActiveMaterialSession(runtime)
      .then((recovered) => {
        if (!cancelled) {
          setSession(recovered);
        }
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [runtime]);

  return {
    session,
    resume: () => {
      const routePath = session?.routePath;

      setSession(null);

      if (routePath) {
        router.push(routePath as never);
      }
    },
    dismiss: () => setSession(null),
  };
}

/**
 * Mount once on the courses screen (or the app shell after sign-in): the
 * sheet asking whether to return to the material that was playing.
 */
export function ActiveMaterialRestorePrompt() {
  const { session, resume, dismiss: close } = useRestoreActiveMediaRoute();

  return (
    <Sheet visible={session !== null} onClose={close}>
      <View className="px-5 py-5">
        <Text className="text-sm font-semibold text-theme-900 dark:text-zinc-100">
          回到上次播放的教材？
        </Text>
        <Text className="mt-1 text-sm text-theme-700 dark:text-zinc-400">
          {session
            ? `上次正在播放「${session.materialName || '教材'}」${session.courseName ? `（${session.courseName}）` : ''}，是否返回繼續學習？`
            : ''}
        </Text>
        <View className="mt-4 flex-row gap-3">
          <Pressable
            accessibilityRole="button"
            onPress={resume}
            className="flex-1 items-center rounded-xl bg-theme-900 px-4 py-2.5 active:bg-theme-700"
          >
            <Text className="text-sm font-medium text-white">返回教材</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={close}
            className="flex-1 items-center rounded-xl border border-theme-200 px-4 py-2.5 dark:border-zinc-700"
          >
            <Text className="text-sm font-medium text-theme-700 dark:text-zinc-300">
              稍後再說
            </Text>
          </Pressable>
        </View>
      </View>
    </Sheet>
  );
}
