import type { Announcement, AppStatus, AppUpdate } from '@altuu/core';
import { Icon, Text, type IconName } from '@altuu/ui';
import { useQueryClient } from '@tanstack/react-query';
import { Pressable, View } from 'react-native';

import { useAppStatus } from '../services/hooks';
import { queryKeys } from '../services/queryKeys';
import { useServiceRuntime } from '../services/AppServicesProvider';
import { openExternalUrl, openInAppBrowser } from './openUrl';

const severityStyles: Record<
  string,
  { container: string; text: string; icon: IconName }
> = {
  info: {
    container:
      'border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950',
    text: 'text-blue-900 dark:text-blue-100',
    icon: 'information-circle',
  },
  warning: {
    container:
      'border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-amber-950',
    text: 'text-amber-900 dark:text-amber-100',
    icon: 'exclamation-triangle',
  },
  critical: {
    container: 'border-red-300 bg-red-50 dark:border-red-800 dark:bg-red-950',
    text: 'text-red-900 dark:text-red-100',
    icon: 'exclamation-circle',
  },
};

export interface AppStatusBannersViewProps {
  update: AppUpdate | null;
  announcements: Announcement[];
  onDismiss: (dismissKey: string) => void;
  onOpenStore: (url: string) => void;
  onOpenAnnouncement: (url: string) => void;
}

/** Presentational part of {@link AppStatusBanners}. */
export function AppStatusBannersView({
  update,
  announcements,
  onDismiss,
  onOpenStore,
  onOpenAnnouncement,
}: AppStatusBannersViewProps) {
  if (update === null && announcements.length === 0) {
    return null;
  }

  return (
    <View className="gap-2 px-4 pt-3">
      {update ? (
        <View
          accessibilityRole="alert"
          className="flex-row items-start gap-3 rounded-xl border border-theme-300 bg-theme-50 px-4 py-3 dark:border-zinc-600 dark:bg-zinc-800"
        >
          <Icon
            name="arrow-up-circle"
            size={20}
            className="mt-0.5 text-theme-900 dark:text-zinc-100"
          />
          <View className="min-w-0 flex-1">
            <Text className="text-sm font-semibold">
              {update.required ? '請更新至最新版本' : '有新版本可用'}
            </Text>
            <Text className="mt-0.5 text-sm">
              {update.required
                ? `目前的版本已不再支援，請更新至 ${update.latestVersion}。`
                : `Alt UU ${update.latestVersion} 已推出。`}
            </Text>
            {update.storeUrl ? (
              <Pressable
                accessibilityRole="button"
                onPress={() => onOpenStore(update.storeUrl!)}
                className="mt-2 self-start rounded-lg bg-theme-700 px-3 py-1.5 active:bg-theme-800 dark:bg-theme-800"
              >
                <Text className="text-sm font-semibold text-white">
                  前往更新
                </Text>
              </Pressable>
            ) : null}
          </View>
          {!update.required ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="關閉"
              hitSlop={8}
              onPress={() => onDismiss(update.dismissKey)}
            >
              <Icon
                name="x-mark"
                size={20}
                className="text-theme-900 dark:text-zinc-100"
              />
            </Pressable>
          ) : null}
        </View>
      ) : null}

      {announcements.map((announcement) => {
        const styles =
          severityStyles[announcement.severity] ?? severityStyles.info;

        return (
          <View
            key={announcement.dismissKey}
            accessibilityRole="alert"
            className={`flex-row items-start gap-3 rounded-xl border px-4 py-3 ${styles.container}`}
          >
            <Icon
              name={styles.icon}
              size={20}
              className={`mt-0.5 ${styles.text}`}
            />
            <View className="min-w-0 flex-1">
              <Text className={`text-sm font-semibold ${styles.text}`}>
                {announcement.title}
              </Text>
              {announcement.body ? (
                <Text className={`mt-0.5 text-sm ${styles.text}`}>
                  {announcement.body}
                </Text>
              ) : null}
              {announcement.url ? (
                <Pressable
                  accessibilityRole="link"
                  onPress={() => onOpenAnnouncement(announcement.url!)}
                >
                  <Text
                    className={`mt-1 text-sm font-medium underline ${styles.text}`}
                  >
                    了解更多
                  </Text>
                </Pressable>
              ) : null}
            </View>
            {announcement.dismissible ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="關閉"
                hitSlop={8}
                onPress={() => onDismiss(announcement.dismissKey)}
              >
                <Icon name="x-mark" size={20} className={styles.text} />
              </Pressable>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

/**
 * App update notice and announcements from the statics feed (legacy
 * AppStatusBanners). Purely informational: a failed check shows nothing.
 * Place it under the page header of the main courses screens.
 */
export function AppStatusBanners() {
  const runtime = useServiceRuntime();
  const queryClient = useQueryClient();
  const status = useAppStatus();

  const dismiss = (dismissKey: string) => {
    // Close it right away; the call only makes that stick for next time.
    queryClient.setQueryData<AppStatus>(queryKeys.appStatus, (current) =>
      current === undefined
        ? current
        : {
            update:
              current.update?.dismissKey === dismissKey ? null : current.update,
            announcements: current.announcements.filter(
              (announcement) => announcement.dismissKey !== dismissKey,
            ),
          },
    );

    void runtime
      .run('app.status', () => runtime.services.appStatus.dismiss(dismissKey))
      .catch(() => {
        // Worst case it comes back on the next launch.
      });
  };

  if (status.data === undefined) {
    return null;
  }

  return (
    <AppStatusBannersView
      update={status.data.update}
      announcements={status.data.announcements}
      onDismiss={dismiss}
      onOpenStore={(url) => void openExternalUrl(url)}
      onOpenAnnouncement={openInAppBrowser}
    />
  );
}
