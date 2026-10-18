import { setWebViewCookies } from '@altuu/attachment-bridge';

import type { AppServices } from '../services/types';

/**
 * Seeds the active account's HUNGU session cookies into the WebView cookie
 * store for `url` (must be on the HUNGU host), so material HTML loaded with
 * that base URL fetches images and stylesheets as the user. Best effort.
 */
export async function seedHunguWebViewCookies(
  services: Pick<AppServices, 'storage'>,
  url: string,
): Promise<void> {
  try {
    const session = await services.storage.hunguSessions.get();
    const cookies = Object.entries(session?.cookies ?? {}).map(
      ([name, value]) => ({ name, value }),
    );

    await setWebViewCookies(url, cookies);
  } catch {
    // Without cookies the page still renders; protected images fail.
  }
}
