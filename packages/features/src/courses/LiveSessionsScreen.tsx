import { useMemo, useState } from 'react';

import {
  useAccounts,
  useAppPreferences,
  useUpdatePreferences,
} from '../services/hooks';
import { useClientConfigStore } from '../services/stores';
import { openExternalUrl } from '../shell/openUrl';
import { TabScreenFrame } from './components/TabScreenFrame';
import { useLiveSessions } from './courseQueries';
import { LiveSessionNicknameDialog } from './LiveSessionNicknameDialog';
import { LiveSessionsView } from './LiveSessionsView';
import {
  flattenLiveSessions,
  type DisplayTimezone,
  type FlattenedLiveSession,
} from './liveSessions';

interface PendingClassroom {
  url: string;
  nickname: string;
  email: string;
}

function systemTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone ?? 'Etc/UTC';
  } catch {
    return 'Etc/UTC';
  }
}

/** 視訊面授 tab (legacy LiveSessionsPane + LiveSessionsTab). */
export function LiveSessionsScreen() {
  const [showAllAccounts, setShowAllAccounts] = useState(false);
  const [pending, setPending] = useState<PendingClassroom | null>(null);
  const preferences = useAppPreferences();
  const updatePreferences = useUpdatePreferences();
  const accounts = useAccounts();
  const profile = useClientConfigStore((state) => state.profile);
  const sessionsQuery = useLiveSessions(showAllAccounts);
  const { refetch } = sessionsQuery;

  const accountList = accounts.data ?? [];
  const hasMultipleAccounts = accountList.length > 1;
  const displayTimezone: DisplayTimezone = preferences.liveSessionsTimezone;

  // Not re-evaluated on every render: statuses only matter when data changes.
  const sessions = useMemo(
    () => flattenLiveSessions(sessionsQuery.data ?? [], new Date()),
    [sessionsQuery.data],
  );

  const resolveIdentity = (session: FlattenedLiveSession) => {
    const account = accountList.find(
      (candidate) => candidate.id === session.accountId,
    );

    if (account) {
      return {
        username: account.username,
        displayName: account.displayName,
      };
    }

    if (profile?.username && profile.displayName) {
      return {
        username: profile.username,
        displayName: profile.displayName,
      };
    }

    return null;
  };

  const enterClassroom = (url: string, session: FlattenedLiveSession) => {
    if (!preferences.liveSessionNicknameModalEnabled) {
      void openExternalUrl(url);

      return;
    }

    const identity = resolveIdentity(session);

    setPending({
      url,
      nickname: identity ? `${identity.username} ${identity.displayName}` : '',
      email: identity ? `${identity.username}@webmail.nou.edu.tw` : '',
    });
  };

  return (
    <TabScreenFrame
      title="視訊面授"
      icon="video-camera"
      path="/courses/live-sessions"
      refreshing={sessionsQuery.isRefetching}
      onRefresh={() => void refetch()}
    >
      <LiveSessionsView
        sessions={sessions}
        // Background refetches keep the visible list instead of blanking it.
        isLoading={sessionsQuery.isPending}
        error={sessionsQuery.isError ? sessionsQuery.error : null}
        retrying={sessionsQuery.isFetching}
        onRetry={() => void refetch()}
        hasMultipleAccounts={hasMultipleAccounts}
        showAllAccounts={showAllAccounts}
        onShowAllAccountsChange={setShowAllAccounts}
        displayTimezone={displayTimezone}
        onDisplayTimezoneChange={(value) =>
          updatePreferences.mutate({ liveSessionsTimezone: value })
        }
        savingTimezone={updatePreferences.isPending}
        systemTimeZone={systemTimeZone()}
        systemOffsetMinutes={-new Date().getTimezoneOffset()}
        onEnterClassroom={enterClassroom}
      />
      <LiveSessionNicknameDialog
        visible={pending !== null}
        nickname={pending?.nickname ?? ''}
        url={pending?.url ?? ''}
        email={pending?.email ?? ''}
        onClose={() => setPending(null)}
        onEnter={() => {
          if (pending) {
            void openExternalUrl(pending.url);
          }

          setPending(null);
        }}
      />
    </TabScreenFrame>
  );
}
