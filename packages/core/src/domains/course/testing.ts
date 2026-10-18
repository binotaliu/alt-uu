/**
 * Test helpers for the course domain (not used at runtime).
 */

const LEGACY_PROXY_URL =
  /http:\/\/localhost\/material-proxy\/([A-Za-z0-9_-]+)/g;

/**
 * Legacy wrapped same-host URLs as `http://localhost/material-proxy/<base64url>`
 * (MaterialProxyUrl::encode). The RN port keeps the original absolute URL,
 * so goldens are compared after unwrapping them.
 */
export function decodeLegacyProxyUrls(value: string): string {
  return value.replace(LEGACY_PROXY_URL, (_match, encoded: string) =>
    decodeBase64Url(encoded),
  );
}

export function decodeBase64Url(encoded: string): string {
  const base64 = encoded.replace(/-/g, '+').replace(/_/g, '/');

  return Buffer.from(base64, 'base64').toString('utf8');
}
