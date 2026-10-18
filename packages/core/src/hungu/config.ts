/** Port of legacy config/hungu.php (the values the transport needs). */
export interface HunguConfig {
  baseUrl: string;
  reviewerUsername: string;
  /** May carry the `/xmlapi/index.php` suffix; it is normalised away. */
  reviewerBaseUrl: string;
  userAgent: string;
  /**
   * Legacy `config('app.debug')`: debug builds log in with `kickOff=false`
   * so a developer session does not kick the phone's session off.
   */
  debug: boolean;
}

export const defaultHunguConfig: HunguConfig = {
  baseUrl: 'https://uu.nou.edu.tw',
  reviewerUsername: 'reviewer',
  reviewerBaseUrl: 'https://alt-uu-staging.binota.org/xmlapi/index.php',
  userAgent:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148',
  debug: false,
};

/** Reviewer accounts (App Store review) are routed to the staging server. */
export function resolveHunguBaseUrl(
  config: HunguConfig,
  username: string,
): string {
  if (username.trim().startsWith(config.reviewerUsername.trim())) {
    return config.reviewerBaseUrl;
  }

  return config.baseUrl;
}

/** Strips a trailing `/xmlapi/index.php` or `/xmlapi` and slashes. */
export function normalizeHunguBaseUrl(baseUrl: string): string {
  let base = baseUrl.trim().replace(/\/+$/, '');

  for (const suffix of ['/xmlapi/index.php', '/xmlapi']) {
    if (base.endsWith(suffix)) {
      base = base.slice(0, -suffix.length);
      break;
    }
  }

  return base.replace(/\/+$/, '');
}
