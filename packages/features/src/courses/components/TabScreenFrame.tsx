import {
  Icon,
  Screen,
  TransparentPageHeader,
  useIsTablet,
  type IconName,
} from '@altuu/ui';
import { usePathname } from 'expo-router';
import { useEffect, useRef, type ReactNode } from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';

import { AppStatusBanners } from '../../shell/AppStatusBanners';
import { AccountSwitcherButton } from '../../account/components/AccountSwitcherButton';

export interface TabScreenFrameProps {
  title: string;
  icon: IconName;
  /** The route this screen lives at; used to refetch when the tab is re-entered. */
  path: string;
  showStatusBanners?: boolean;
  refreshing: boolean;
  onRefresh: () => void;
  /** Pinned above the scrolling body; also implies the width-limited layout. */
  stickyHeader?: ReactNode;
  /** Center the body in a `max-w-2xl` column so tablets render nicely. */
  constrainWidth?: boolean;
  children: ReactNode;
}

/**
 * Header + scrolling body shared by the courses / live sessions / school
 * calendar tab screens. The tab bar itself comes from `CoursesTabs`.
 *
 * Legacy refetched these lists whenever the tab became active again
 * (`onActivated`); `onRefresh` is called on that transition as well as on
 * pull-to-refresh.
 */
export function TabScreenFrame({
  title,
  icon,
  path,
  showStatusBanners = false,
  refreshing,
  onRefresh,
  stickyHeader,
  constrainWidth = false,
  children,
}: TabScreenFrameProps) {
  const pathname = usePathname();
  const isTablet = useIsTablet();
  const isActive = pathname === path;
  const wasActive = useRef(isActive);
  const mountedActive = useRef(false);

  useEffect(() => {
    if (isActive && !wasActive.current && mountedActive.current) {
      onRefresh();
    }

    wasActive.current = isActive;
    mountedActive.current = true;
    // Only the active flag drives this; onRefresh changes every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive]);

  return (
    <Screen ignoreTopInset ignoreBottomInset>
      <TransparentPageHeader
        title={title}
        icon={
          <Icon
            name={icon}
            size={20}
            className="text-theme-900 dark:text-zinc-100"
          />
        }
        actions={<AccountSwitcherButton />}
      />
      {showStatusBanners ? <AppStatusBanners /> : null}
      <ScrollView
        className="flex-1"
        stickyHeaderIndices={stickyHeader ? [0] : undefined}
        contentContainerClassName={`${
          constrainWidth ? 'mx-auto w-full max-w-2xl ' : ''
        }${isTablet ? 'px-6' : 'px-4'} pb-6 ${stickyHeader ? '' : isTablet ? 'pt-4' : 'pt-3'}`}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {stickyHeader ? (
          <View
            className={`bg-theme-100 pb-3 dark:bg-zinc-950 ${isTablet ? 'pt-4' : 'pt-3'}`}
          >
            {stickyHeader}
          </View>
        ) : null}
        {children}
      </ScrollView>
    </Screen>
  );
}
