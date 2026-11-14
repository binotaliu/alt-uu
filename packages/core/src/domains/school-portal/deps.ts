import type { CacheRepository } from '../../db';
import type { SchoolPortalClient } from '../../school-portal';
import type { AccountId } from '../../session/types';
import type { SchoolPortalCourseRef } from './types';

/** One stored account, for the all-accounts grades / exam info views. */
export interface SchoolPortalAccount {
  accountId: AccountId;
  username: string;
  /** Nickname, display name or username (same as the live sessions label). */
  label: string;
}

/** Which account a portal page is fetched for; omitted = the active account. */
export interface SchoolPortalAccountScope {
  accountId?: AccountId;
  username?: string | null;
}

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
  /** Every stored account, for `allAccounts` requests. */
  listAccounts: () => Promise<SchoolPortalAccount[]>;
  /** Reported when one account of an all-accounts fetch fails. */
  onError?: (error: unknown) => void;
}

export const CACHE_TTL_SECONDS = 10 * 60;
export const HISTORICAL_CACHE_TTL_SECONDS = 60 * 60;
