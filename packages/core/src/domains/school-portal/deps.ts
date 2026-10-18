import type { CacheRepository } from '../../db';
import type { SchoolPortalClient } from '../../school-portal';
import type { SchoolPortalCourseRef } from './types';

export interface SchoolPortalDomainDeps {
  client: Pick<
    SchoolPortalClient,
    | 'fetchCurrentSemesterGradesPage'
    | 'fetchHistoricalGradesPage'
    | 'fetchClassSessionInfoPage'
    | 'fetchExamInfoPage'
    | 'fetchHomeworkNoticesPage'
  >;
  cache: Pick<CacheRepository, 'remember'>;
  /** HUNGU profile username of the active account (legacy `hungu.profile.username`). */
  getProfileUsername: () => Promise<string | null> | string | null;
  /** `school_portal.base_url`, used to absolutize homework download links. */
  portalBaseUrl: string;
  /** Course list of the active account, to map a course id to name/semester. */
  listCourses: () => Promise<SchoolPortalCourseRef[]>;
}

export const CACHE_TTL_SECONDS = 10 * 60;
export const HISTORICAL_CACHE_TTL_SECONDS = 60 * 60;
