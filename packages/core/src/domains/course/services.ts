import type { CacheRepository } from '../../db/cache';
import type { AltUUDatabase } from '../../db/types';
import { UserFacingHttpError } from '../../errors/errors';
import type { HunguCourseClient } from '../../hungu/hunguApis';
import type { HunguSessionData } from '../../hungu/types';
import type {
  AccountId,
  ActiveAccountProvider,
  HunguSession,
  SessionStore,
} from '../../session/types';
import { clearCoursePathInfoCache, createGetCoursePath } from './coursePath';
import {
  getCourseTasksCount,
  mapLearningTimes,
  parseHomeworkItems,
  parseSelfExamItems,
} from './coursePages';
import {
  createGetNodeResources,
  getLastSeenMaterial,
  getPlaybackProgress,
} from './courseRecords';
import { createListCourses } from './listCourses';
import {
  createParseMaterialContent,
  emptyMaterialContent,
  type MaterialContentClient,
} from './material/parseMaterialContent';
import { urlHost } from './support/phpUrl';
import { createSyncCurrentCourse } from './syncCurrentCourse';
import type {
  CourseHomeworkItem,
  CourseHomeworkList,
  CourseItem,
  CourseLastSeenMaterial,
  CourseLearningTimeItem,
  CourseMaterialResource,
  CoursePath,
  CoursePlaybackProgress,
  CourseSchoolPortalHomeworkNotice,
  CourseTasksCount,
  MaterialFetchDescriptor,
  ParsedMaterialContent,
} from './types';

export const DEFAULT_HUNGU_BASE_URL = 'https://uu.nou.edu.tw';
export const DEFAULT_STATICS_BASE_URL =
  'https://alt-uu-statics.wcsvdzeimhwq.workers.dev';

export interface CourseServicesDeps {
  client: Pick<
    HunguCourseClient,
    | 'fetchCourseList'
    | 'fetchCoursePathInfo'
    | 'fetchCourseNodeResources'
    | 'goCourse'
    | 'fetchHomeworkPage'
    | 'fetchSelfExamPage'
    | 'fetchLearningTimePage'
    | 'fetchPendingHomeworkPage'
    | 'fetchUnreadArticlesPage'
    | 'fetchCoursePathTree'
    | 'setCookie'
  >;
  /** Material fetches; see createHunguMaterialContentClient. */
  materialContent: MaterialContentClient;
  cache: Pick<CacheRepository, 'get' | 'put' | 'forget'>;
  activeAccount: ActiveAccountProvider;
  /** Read-only access to the active account's HUNGU session (base URL, profile). */
  hunguSessionStore: Pick<SessionStore<HunguSession>, 'get'>;
  /** For the playback progress / last-seen reads. */
  db: AltUUDatabase;
  /** `services.statics.base_url`; defaults to production. */
  staticsBaseUrl?: string;
  /**
   * School portal homework notices for a course (step 7's
   * GetSchoolPortalHomeworkNotices). Best effort: failures are ignored.
   */
  getSchoolPortalHomeworkNotices?: (
    course: CourseItem,
  ) => Promise<CourseSchoolPortalHomeworkNotice[]>;
  /** Reports swallowed errors (legacy `report($e)`). */
  onError?: (error: unknown) => void;
}

/**
 * The course domain operations the UI calls. Each method replaces one
 * legacy `/api/courses…` endpoint (controller + actions).
 */
export function createCourseServices(deps: CourseServicesDeps) {
  const currentAccountId = () => deps.activeAccount.currentAccountId();
  const hunguSession = async (): Promise<HunguSessionData | null> =>
    (await deps.hunguSessionStore.get()) as HunguSessionData | null;
  const listCourses = createListCourses({
    client: deps.client,
    cache: deps.cache,
    getProfileUsername: async () =>
      (await hunguSession())?.profile?.username ?? null,
  });
  const getCoursePath = createGetCoursePath({
    client: deps.client,
    cache: deps.cache,
    currentAccountId,
  });
  const syncCurrentCourse = createSyncCurrentCourse({
    client: deps.client,
    currentAccountId,
  });
  const getNodeResources = createGetNodeResources({
    client: deps.client,
    currentAccountId,
  });
  const parseMaterialContent = createParseMaterialContent({
    client: deps.materialContent,
    staticsBaseUrl: deps.staticsBaseUrl ?? DEFAULT_STATICS_BASE_URL,
  });

  /** Legacy `rtrim(session base_url, '/')`, defaulting to production. */
  const sessionBaseUrl = async (): Promise<string> => {
    const baseUrl = String((await hunguSession())?.baseUrl ?? '');

    return baseUrl === ''
      ? DEFAULT_HUNGU_BASE_URL
      : baseUrl.replace(/\/+$/, '');
  };

  const sessionHost = async (): Promise<string | null> => {
    const host = urlHost(String((await hunguSession())?.baseUrl ?? ''));

    return host !== null && host.trim() !== '' ? host : null;
  };

  /** Throws the legacy 403 unless `url` is on the session's HUNGU host. */
  const assertSessionHost = async (url: string): Promise<string> => {
    const baseHost = await sessionHost();

    if (baseHost === null || urlHost(url) !== baseHost) {
      throw new UserFacingHttpError(403, '不允許存取外部資源');
    }

    return baseHost;
  };

  return {
    /** GET /api/courses (pass an account id to bypass the active one). */
    listCourses,

    /** GET /api/courses/tasks-count */
    getTasksCount: (): Promise<CourseTasksCount[]> =>
      getCourseTasksCount(deps.client),

    /** GET /api/courses/{cid}/path */
    async getCoursePath(cid: string): Promise<CoursePath> {
      await syncCurrentCourse.sync(cid);

      return getCoursePath(cid);
    },

    /** GET /api/courses/{cid}/learning-times */
    async getLearningTimes(cid: string): Promise<CourseLearningTimeItem[]> {
      await syncCurrentCourse.sync(cid);
      const path = await getCoursePath(cid);

      return mapLearningTimes(
        await deps.client.fetchLearningTimePage(cid),
        path.materialNodes,
      );
    },

    /** GET /api/courses/{cid}/homeworks (HUNGU list + portal notices). */
    async getHomeworks(cid: string): Promise<CourseHomeworkList> {
      await syncCurrentCourse.sync(cid, true);
      const homeworkItems = parseHomeworkItems(
        await deps.client.fetchHomeworkPage(),
        await sessionBaseUrl(),
      );
      const course = (await listCourses()).find(
        (item) => item.courseId === cid,
      );
      let schoolPortalNotices: CourseSchoolPortalHomeworkNotice[] = [];

      if (
        course !== undefined &&
        deps.getSchoolPortalHomeworkNotices !== undefined
      ) {
        try {
          schoolPortalNotices =
            await deps.getSchoolPortalHomeworkNotices(course);
        } catch {
          // The school portal is a best-effort secondary source.
        }
      }

      return { homeworkItems, schoolPortalNotices };
    },

    /** GET /api/courses/{cid}/self-exams */
    async getSelfExams(cid: string): Promise<CourseHomeworkItem[]> {
      await syncCurrentCourse.sync(cid, true);

      return parseSelfExamItems(
        await deps.client.fetchSelfExamPage(),
        await sessionBaseUrl(),
      );
    },

    /** GET /api/courses/{cid}/nodes/{scoid}/resources */
    getNodeResources: (
      cid: string,
      scoid: string,
    ): Promise<CourseMaterialResource[]> => getNodeResources(cid, scoid),

    /** GET /api/courses/{cid}/nodes/{scoid}/content */
    async getNodeContent(
      cid: string,
      scoid: string,
    ): Promise<ParsedMaterialContent> {
      const path = await getCoursePath(cid);
      const node = path.materialNodes.find((item) => item.identifier === scoid);

      if (node === undefined || node.href === null) {
        return emptyMaterialContent();
      }

      const baseHost = (await sessionHost()) ?? urlHost(node.href);

      if (baseHost === null || baseHost.trim() === '') {
        return emptyMaterialContent();
      }

      return parseMaterialContent(node.href, baseHost);
    },

    /** GET /materials/content/parsed?url= */
    async getParsedMaterialContent(
      url: string,
    ): Promise<ParsedMaterialContent> {
      return parseMaterialContent(url, await assertSessionHost(url));
    },

    /**
     * Replaces the legacy `/material-proxy/<b64>` route: the request the
     * app makes itself (attachment bridge download, player, WebView) for
     * a HUNGU material URL. Same-host only; `cid` forces go-course first
     * like the legacy `?cid=` parameter.
     */
    async prepareMaterialFetch(
      url: string,
      options: { cid?: string } = {},
    ): Promise<MaterialFetchDescriptor> {
      if (options.cid !== undefined) {
        await syncCurrentCourse.sync(options.cid, true);
      }

      await assertSessionHost(url);

      return deps.materialContent.materialFetchHandoff(url);
    },

    /** GET /api/courses/{cid}/last-seen-material */
    async getLastSeenMaterial(cid: string): Promise<CourseLastSeenMaterial> {
      return getLastSeenMaterial(deps.db, await currentAccountId(), cid);
    },

    /** GET /api/courses/{cid}/playback-progress/{activityId} */
    async getPlaybackProgress(
      cid: string,
      activityId: string,
    ): Promise<{ progress: CoursePlaybackProgress | null }> {
      return {
        progress: await getPlaybackProgress(
          deps.db,
          await currentAccountId(),
          cid,
          activityId,
        ),
      };
    },

    /** Explicit go-course (legacy SyncCurrentCourse). */
    syncCurrentCourse: (cid: string, force = false): Promise<void> =>
      syncCurrentCourse.sync(cid, force),

    /**
     * Wire to HunguSessionAuthenticator `afterRememberedLogin`: the new
     * web session has no current course, so re-enter the last one.
     */
    async afterRememberedLogin(accountId: AccountId | null): Promise<void> {
      try {
        await syncCurrentCourse.resyncAfterLogin(accountId);
      } catch (error) {
        deps.onError?.(error);
      }
    },

    /** Wire to StudyTime's "study time recorded" event. */
    clearCoursePathInfoCache: (
      accountId: AccountId | null,
      cid: string,
    ): Promise<void> => clearCoursePathInfoCache(deps.cache, accountId, cid),
  };
}

export type CourseServices = ReturnType<typeof createCourseServices>;
