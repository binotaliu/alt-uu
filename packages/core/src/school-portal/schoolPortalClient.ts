import type { CredentialsStore } from '../session/types';
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

  fetchCurrentSemesterGradesPage(): Promise<SchoolPortalPageResult> {
    return this.proxy.fetchHtmlPage('/device/compliant/qryscore/index');
  }

  fetchHistoricalGradesPage(): Promise<SchoolPortalPageResult> {
    return this.proxy.fetchHtmlPage('/device/compliant/qryscore2/index');
  }

  fetchClassSessionInfoPage(): Promise<SchoolPortalPageResult> {
    return this.proxy.fetchHtmlPage('/device/compliant/qryper/index');
  }

  fetchExamInfoPage(): Promise<SchoolPortalPageResult> {
    return this.proxy.fetchHtmlPage('/device/compliant/qryexm/index');
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

  async attemptRememberedLogin(): Promise<boolean> {
    const credentials = await this.deps.credentialsStore.get();

    if (credentials === null) {
      return false;
    }

    return this.deps.proxy.login(credentials.username, credentials.password);
  }
}
