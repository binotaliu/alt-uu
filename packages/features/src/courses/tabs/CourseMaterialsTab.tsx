import type { ReactElement } from 'react';
import type { RefreshControlProps } from 'react-native';
import { ScrollView, View } from 'react-native';

import { Card, Skeleton } from '../components/primitives';
import { useCourseLearningTimes, useLastSeenMaterial } from '../courseQueries';
import { MaterialDirectory } from '../MaterialDirectory';
import { ErrorRetry } from '../../shell/ErrorRetry';

/** 教材: the material tree with watch durations; rows open `/courses/[cid]/[scoid]`. */
export function CourseMaterialsTab({
  cid,
  refreshControl,
}: {
  cid: string;
  refreshControl?: ReactElement<RefreshControlProps>;
}) {
  const learningTimes = useCourseLearningTimes(cid);
  const lastSeen = useLastSeenMaterial(cid);

  // Loading and error states scroll like any tab so pull-to-refresh works.
  const scrolled = (content: ReactElement) => (
    <ScrollView refreshControl={refreshControl}>{content}</ScrollView>
  );

  if (learningTimes.isPending) {
    return scrolled(
      <View
        accessibilityLabel="載入教材目錄中"
        className="overflow-hidden rounded-2xl border border-theme-200 bg-white dark:border-zinc-700 dark:bg-zinc-900"
      >
        {[72, 58, 81, 64, 76].map((pct) => (
          <View
            key={pct}
            className="flex-row items-center justify-between gap-3 border-b border-theme-100 px-4 py-3.5 dark:border-zinc-800"
          >
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-6 w-20 rounded-full" />
          </View>
        ))}
      </View>,
    );
  }

  if (learningTimes.isError) {
    return scrolled(
      <ErrorRetry
        error={learningTimes.error}
        retrying={learningTimes.isFetching}
        onRetry={() => void learningTimes.refetch()}
      />,
    );
  }

  return (
    <Card className="shrink overflow-hidden p-0">
      <MaterialDirectory
        className="shrink"
        refreshControl={refreshControl}
        selectedCid={cid}
        nodes={learningTimes.data}
        lastSeenIdentifier={lastSeen.data?.activityId ?? null}
        lastSeenPositionSeconds={lastSeen.data?.positionSeconds}
        lastSeenDurationSeconds={lastSeen.data?.mediaDurationSeconds}
      />
    </Card>
  );
}
