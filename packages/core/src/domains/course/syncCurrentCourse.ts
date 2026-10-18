import type { HunguPageResult, HunguPayloadResult } from '../../hungu/types';

export interface SyncCurrentCourseDeps {
  client: {
    goCourse(cid: string): Promise<HunguPayloadResult>;
    fetchCoursePathTree(): Promise<HunguPageResult>;
    setCookie(name: string, value: string): Promise<void>;
  };
  currentAccountId: () => Promise<number | null>;
}

/**
 * Port of SyncCurrentCourse: HUNGU pages (homework list, self exams,
 * learning times, materials) answer for the "current course" of the web
 * session, so `go-course` must run first. The legacy Laravel session key
 * `hungu.current_course_id.<accountId>` becomes in-memory state here.
 */
export function createSyncCurrentCourse(deps: SyncCurrentCourseDeps) {
  const currentCourseIds = new Map<number, string>();

  const sync = async (cid: string, force = false): Promise<void> => {
    const accountId = (await deps.currentAccountId()) ?? 0;

    if (currentCourseIds.get(accountId) === cid && !force) {
      return;
    }

    await deps.client.goCourse(cid);

    const pathTree = await deps.client.fetchCoursePathTree();
    const browserTabIdx =
      /var\s+browserTabIdx\s*=\s*["']([^"']+)["']\s*;/i.exec(
        pathTree.body ?? '',
      )?.[1] ?? null;

    if (browserTabIdx !== null) {
      await deps.client.setCookie('browserTabIdx', browserTabIdx);
    }

    currentCourseIds.set(accountId, cid);
  };

  return {
    sync,
    currentCourseId: (accountId: number | null): string | null =>
      currentCourseIds.get(accountId ?? 0) ?? null,
    /**
     * Legacy UUSessionAuthenticator re-ran a forced sync after a
     * remembered re-login (the new web session has no current course).
     */
    async resyncAfterLogin(accountId: number | null): Promise<void> {
      const cid = currentCourseIds.get(accountId ?? 0);

      if (cid !== undefined && cid !== '') {
        await sync(cid, true);
      }
    },
    forget(accountId: number | null): void {
      currentCourseIds.delete(accountId ?? 0);
    },
  };
}

export type SyncCurrentCourse = ReturnType<typeof createSyncCurrentCourse>;
