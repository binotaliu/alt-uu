import { Icon, Sheet, Text } from '@altuu/ui';
import { useEffect } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import { useServiceRuntime } from '../services/AppServicesProvider';
import { useWhatsNewStore } from '../services/stores';
import { openInAppBrowser } from './openUrl';
import { findRelease, releases } from './releaseNotes';

const CHANGELOG_BASE_URL =
  'https://alt-uu-statics.wcsvdzeimhwq.workers.dev/changelog';

function PremiumBadge() {
  return (
    <View className="flex-row items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 dark:bg-amber-900/40">
      <Icon
        name="lock-closed"
        size={12}
        className="text-amber-700 dark:text-amber-400"
      />
      <Text className="text-[10px] font-semibold text-amber-700 dark:text-amber-400">
        Alt UU+
      </Text>
    </View>
  );
}

/** Release highlights sheet (legacy WhatsNewSheet), opened via `useWhatsNew()`. */
export function WhatsNewSheet() {
  const isOpen = useWhatsNewStore((state) => state.isOpen);
  const close = useWhatsNewStore((state) => state.close);
  const runtime = useServiceRuntime();
  const { appVersion } = runtime.services.buildConfig;
  // Development builds have no entry of their own, so fall back to the
  // newest release rather than showing an empty sheet.
  const release = findRelease(appVersion) ?? releases[0];

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    void runtime
      .loadPreferences()
      .then((preferences) => {
        if (
          findRelease(appVersion) !== undefined &&
          preferences.whatsNewSeenVersion !== appVersion
        ) {
          return runtime.updatePreferences({
            whatsNewSeenVersion: appVersion,
          });
        }

        return undefined;
      })
      .catch(() => {
        // Failing to record the visit only means the sheet shows
        // again next launch.
      });
  }, [isOpen, runtime, appVersion]);

  if (release === undefined) {
    return null;
  }

  const openChangelog = () => {
    close();
    openInAppBrowser(
      `${CHANGELOG_BASE_URL}?version=${encodeURIComponent(release.version)}`,
    );
  };

  return (
    <Sheet visible={isOpen} onClose={close} className="max-h-[85%] rounded-3xl">
      <ScrollView className="px-6 pt-8" bounces={false}>
        <View className="items-center">
          <Text className="text-sm font-semibold text-theme-700 dark:text-theme-400">
            {`v${release.version}`}
          </Text>
          <Text className="mt-1 text-center text-2xl font-extrabold text-zinc-900 dark:text-zinc-50">
            Alt UU 有新功能了
          </Text>
        </View>

        <View className="mt-8 gap-6 pb-2">
          {release.highlights.map((highlight) => (
            <View key={highlight.title} className="flex-row items-start gap-4">
              <View className="dark:bg-theme-900/40 size-11 items-center justify-center rounded-2xl bg-theme-100">
                <Icon
                  name={highlight.icon}
                  size={24}
                  className="text-theme-700 dark:text-theme-400"
                />
              </View>
              <View className="min-w-0 flex-1 pt-0.5">
                <View className="flex-row items-center gap-2">
                  <Text className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
                    {highlight.title}
                  </Text>
                  {highlight.plus ? <PremiumBadge /> : null}
                </View>
                <Text className="mt-0.5 text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">
                  {highlight.description}
                </Text>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>

      <View className="gap-2 px-6 pb-6 pt-4">
        <Pressable
          accessibilityRole="button"
          onPress={close}
          className="h-12 items-center justify-center rounded-2xl bg-theme-800 active:bg-theme-900"
        >
          <Text className="text-sm font-semibold text-white">好</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={openChangelog}
          className="h-10 items-center justify-center rounded-2xl active:bg-theme-50 dark:active:bg-zinc-800"
        >
          <Text className="text-sm font-medium text-theme-700 dark:text-theme-400">
            完整版本更新說明
          </Text>
        </Pressable>
      </View>
    </Sheet>
  );
}
