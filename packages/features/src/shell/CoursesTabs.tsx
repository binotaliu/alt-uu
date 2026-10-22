import {
  Button,
  Icon,
  NavAboveHeaderContext,
  Sheet,
  Text,
  useDuoLayout,
  useIsTablet,
  type IconName,
} from '@altuu/ui';
import { usePathname } from 'expo-router';
import { TabList, TabSlot, TabTrigger, Tabs } from 'expo-router/ui';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import {
  SafeAreaInsetsContext,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';

import { useServiceRuntime } from '../services/AppServicesProvider';
import { useClientConfigStore } from '../services/stores';

/** Route names inside `app/courses/(tabs)/`. */
export type CoursesTabName =
  'index' | 'live-sessions' | 'school-calendar' | 'account';

interface TabDefinition {
  name: CoursesTabName;
  href: string;
  label: string;
  icon: IconName;
  /** Needs the NOU Tools integration preference. */
  gated: boolean;
}

export const coursesTabs: readonly TabDefinition[] = [
  {
    name: 'index',
    href: '/courses',
    label: '我的課程',
    icon: 'briefcase',
    gated: false,
  },
  {
    name: 'live-sessions',
    href: '/courses/live-sessions',
    label: '視訊面授',
    icon: 'video-camera',
    gated: true,
  },
  {
    name: 'school-calendar',
    href: '/courses/school-calendar',
    label: '學校行事曆',
    icon: 'calendar-days',
    gated: true,
  },
  {
    name: 'account',
    href: '/courses/account',
    label: '我的帳號',
    icon: 'user-circle',
    gated: false,
  },
];

interface TabButtonProps {
  tab: TabDefinition;
  isFocused?: boolean;
  onPress?: () => void;
  nouToolsEnabled: boolean;
  onGatedPress: () => void;
  /** Text-only pill of the tablet top bar instead of the icon + label tab. */
  pill?: boolean;
  /** Icon-only button of the iPhone Duo side rail. */
  rail?: boolean;
}

/** One tab of the bar (legacy CoursesBottomNav item). */
function TabButton({
  tab,
  isFocused: isFocusedProp = false,
  onPress,
  nouToolsEnabled,
  onGatedPress,
  pill = false,
  rail = false,
}: TabButtonProps) {
  const pathname = usePathname();
  // The navigator's own focus flag is not set for the index route here.
  const isFocused = isFocusedProp || pathname === tab.href;
  const blocked = tab.gated && !nouToolsEnabled;

  if (rail) {
    return (
      <Pressable
        testID={`tab-${tab.name}`}
        accessibilityRole="tab"
        accessibilityLabel={tab.label}
        accessibilityState={{ selected: isFocused }}
        onPress={blocked ? onGatedPress : onPress}
        className={`h-12 w-12 items-center justify-center rounded-xl ${
          isFocused
            ? 'bg-theme-800 dark:bg-zinc-600'
            : 'active:bg-theme-50 dark:active:bg-zinc-800'
        }`}
      >
        <Icon
          name={tab.icon}
          size={24}
          className={
            isFocused ? 'text-white' : 'text-theme-700 dark:text-zinc-300'
          }
        />
      </Pressable>
    );
  }

  if (pill) {
    return (
      <Pressable
        testID={`tab-${tab.name}`}
        accessibilityRole="tab"
        accessibilityLabel={tab.label}
        accessibilityState={{ selected: isFocused }}
        onPress={blocked ? onGatedPress : onPress}
        className={`flex-1 items-center justify-center rounded-xl px-4 py-2 ${
          isFocused
            ? 'bg-theme-800 dark:bg-zinc-600'
            : 'active:bg-theme-50 dark:active:bg-zinc-800'
        }`}
      >
        <Text
          className={`text-sm font-semibold ${
            isFocused ? 'text-white' : 'text-theme-700 dark:text-zinc-300'
          }`}
        >
          {tab.label}
        </Text>
      </Pressable>
    );
  }

  return (
    <Pressable
      testID={`tab-${tab.name}`}
      accessibilityRole="tab"
      accessibilityLabel={tab.label}
      accessibilityState={{ selected: isFocused }}
      onPress={blocked ? onGatedPress : onPress}
      className={`flex-1 items-center gap-1 rounded-xl px-2 py-2 ${
        isFocused
          ? 'bg-theme-800 dark:bg-zinc-600'
          : 'active:bg-theme-50 dark:active:bg-zinc-800'
      }`}
    >
      <Icon
        name={tab.icon}
        size={24}
        className={
          isFocused ? 'text-white' : 'text-theme-700 dark:text-zinc-300'
        }
      />
      <Text
        numberOfLines={2}
        className={`text-center text-xs font-semibold leading-tight ${
          isFocused ? 'text-white' : 'text-theme-700 dark:text-zinc-300'
        }`}
      >
        {tab.label}
      </Text>
    </Pressable>
  );
}

/**
 * Prompt shown when a gated tab is tapped while the NOU Tools integration is
 * off (legacy 「開啟 NOU 小幫手整合」 modal).
 */
export function NouToolsEnableDialog({
  visible,
  onClose,
  onEnable,
  error,
  enabling,
}: {
  visible: boolean;
  onClose: () => void;
  onEnable: () => void;
  error: string | null;
  enabling: boolean;
}) {
  return (
    <Sheet visible={visible} onClose={onClose} placement="center">
      <View className="p-6">
        <Text className="mb-2 text-lg font-semibold text-theme-900 dark:text-white">
          開啟 NOU 小幫手整合
        </Text>
        <Text className="mb-6 text-sm text-theme-700 dark:text-zinc-300">
          此功能需要開啟 NOU 小幫手整合才可使用。
        </Text>
        {error ? (
          <Text className="mb-4 text-sm text-rose-600 dark:text-rose-400">
            {error}
          </Text>
        ) : null}
        <View className="flex-row gap-3">
          <Button
            className="flex-1"
            label="取消"
            variant="secondary"
            onPress={onClose}
          />
          <Button
            className="flex-1"
            label="開啟"
            loading={enabling}
            onPress={onEnable}
          />
        </View>
      </View>
    </Sheet>
  );
}

/**
 * Bottom tabs of the main screen: courses, live sessions, school calendar and
 * account. Render it from `app/courses/(tabs)/_layout.tsx`; the route files
 * `index`, `live-sessions`, `school-calendar` and `account` sit beside it.
 */
export function CoursesTabs() {
  const runtime = useServiceRuntime();
  const insets = useSafeAreaInsets();
  const isTablet = useIsTablet();
  const { sideBar } = useDuoLayout();
  const nouToolsEnabled = useClientConfigStore(
    (state) => state.preferences.nouToolsIntegrationEnabled,
  );
  const [dialogOpen, setDialogOpen] = useState(false);
  const [enabling, setEnabling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const enableNouTools = async () => {
    setEnabling(true);
    setError(null);

    try {
      await runtime.updatePreferences({
        nouToolsIntegrationEnabled: true,
      });
      setDialogOpen(false);
    } catch {
      setError('啟用失敗，請稍後重試');
    } finally {
      setEnabling(false);
    }
  };

  const tabTriggers = coursesTabs.map((tab) => (
    <TabTrigger key={tab.name} name={tab.name} href={tab.href as never} asChild>
      <TabButton
        tab={tab}
        pill={isTablet && !sideBar}
        rail={sideBar}
        nouToolsEnabled={nouToolsEnabled}
        onGatedPress={() => setDialogOpen(true)}
      />
    </TabTrigger>
  ));

  // iPhone Duo: iOS moves system bars to the side, but these bars are drawn here, so
  // the rail is ours. The rail takes over the trailing safe-area inset from the page.
  if (sideBar) {
    return (
      <View className="flex-1 bg-theme-100 dark:bg-zinc-950">
        <Tabs style={{ flex: 1, flexDirection: 'row' }}>
          <SafeAreaInsetsContext.Provider value={{ ...insets, right: 0 }}>
            <View className="flex-1">
              <TabSlot />
            </View>
          </SafeAreaInsetsContext.Provider>
          <TabList asChild>
            <View
              testID="tab-rail"
              className="items-center justify-end gap-2 border-l border-theme-200 bg-white dark:border-zinc-700 dark:bg-zinc-900"
              // TabList defaults to a row with space-between; the rail is a column.
              style={{
                flexDirection: 'column',
                justifyContent: 'flex-end',
                paddingTop: insets.top + 8,
                paddingBottom: Math.max(insets.bottom, 12),
                // The system reserves this strip for the status area: match its width
                // instead of adding to it, and centre the icons under it.
                width: Math.max(insets.right, 64),
                // The status icons centre about 6 pt inside the strip's leading edge.
                paddingRight: 13,
              }}
            >
              {tabTriggers}
            </View>
          </TabList>
          <NouToolsEnableDialog
            visible={dialogOpen}
            onClose={() => setDialogOpen(false)}
            onEnable={() => void enableNouTools()}
            error={error}
            enabling={enabling}
          />
        </Tabs>
      </View>
    );
  }

  // Legacy CoursesTopNav (md and up) replaces CoursesBottomNav. expo-router
  // only registers triggers of a TabList that is a direct child of Tabs, so
  // neither list may sit inside a wrapper element.
  return (
    <NavAboveHeaderContext.Provider value={isTablet}>
      <View className="flex-1 bg-theme-100 dark:bg-zinc-950">
        <Tabs>
          {isTablet ? (
            <TabList asChild>
              <View
                className="w-full max-w-lg flex-row items-center gap-2 self-center rounded-2xl border border-theme-200 bg-white/90 p-1 dark:border-zinc-700 dark:bg-zinc-900/90"
                style={{ marginTop: insets.top + 6 }}
              >
                {tabTriggers}
              </View>
            </TabList>
          ) : null}
          <TabSlot />
          {isTablet ? null : (
            <TabList asChild>
              <View
                className="flex-row gap-2 border-t border-theme-200 bg-white px-4 pt-2 dark:border-zinc-700 dark:bg-zinc-900"
                style={{ paddingBottom: Math.max(insets.bottom, 12) }}
              >
                {tabTriggers}
              </View>
            </TabList>
          )}
          <NouToolsEnableDialog
            visible={dialogOpen}
            onClose={() => setDialogOpen(false)}
            onEnable={() => void enableNouTools()}
            error={error}
            enabling={enabling}
          />
        </Tabs>
      </View>
    </NavAboveHeaderContext.Provider>
  );
}
