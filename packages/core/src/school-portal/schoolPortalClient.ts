import type { AccountId, CredentialsStore } from '../session/types';
import type {
  SchoolPortalPageResult,
  SchoolPortalProxyClient,
} from './schoolPortalProxyClient';

/** Port of legacy SchoolPortalClient: the pages the app scrapes. */
export class SchoolPortalClient {
  constructor(private readonly proxy: SchoolPortalProxyClient) {}

  fetchHomeworkNoticesPage(): Promise<SchoolPortalPageResult> {
    return this.proxy.fetchHtmlPage('/device/compliant/qryass/index');
  }

  fetchCurrentSemesterGradesPage(
    accountId?: AccountId,
  ): Promise<SchoolPortalPageResult> {
    return this.proxy.fetchHtmlPage(
      '/device/compliant/qryscore/index',
      true,
      accountId,
    );
  }

  fetchHistoricalGradesPage(
    accountId?: AccountId,
  ): Promise<SchoolPortalPageResult> {
    return this.proxy.fetchHtmlPage(
      '/device/compliant/qryscore2/index',
      true,
      accountId,
    );
  }

  fetchClassSessionInfoPage(): Promise<SchoolPortalPageResult> {
    return this.proxy.fetchHtmlPage('/device/compliant/qryper/index');
  }

  fetchExamInfoPage(accountId?: AccountId): Promise<SchoolPortalPageResult> {
    return this.proxy.fetchHtmlPage(
      '/device/compliant/qryexm/index',
      true,
      accountId,
    );
  }
}

/**
 * Port of legacy SchoolPortalSessionAuthenticator: silently logs into the
 * portal with the credentials saved for HUNGU (NOU uses one credential set).
 */
export class SchoolPortalSessionAuthenticator {
  constructor(
    private readonly deps: {
      proxy: SchoolPortalProxyClient;
      credentialsStore: CredentialsStore;
    },
  ) {}

  /** `accountId` omitted means the active account. */
  async attemptRememberedLogin(accountId?: AccountId): Promise<boolean> {
    const credentials = await this.deps.credentialsStore.get(accountId);

    if (credentials === null) {
      return false;
    }

    return this.deps.proxy.login(
      credentials.username,
      credentials.password,
      accountId,
    );
  }
}
