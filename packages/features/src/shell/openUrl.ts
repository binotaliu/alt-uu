import { router } from 'expo-router';
import { Linking } from 'react-native';

/** Named stylesheets the in-app browser can inject into a page. */
export type InAppBrowserCssPreset = 'homework';

export interface InAppBrowserOptions {
  /** `POST` loads `url` with `postForm` as an urlencoded body. Defaults to `GET`. */
  method?: 'GET' | 'POST';
  postForm?: Record<string, string>;
  /** Mobile restyle for the legacy 教務系統 / 數位學習平台 pages. */
  cssPreset?: InAppBrowserCssPreset;
  /** Name for files saved, printed or downloaded from this page. */
  fileName?: string;
  /** Title shown in the header instead of the page's own title. */
  title?: string;
  /** Offers 儲存為 PDF / 列印 for this HTML page. */
  exportAsPdf?: boolean;
}

/**
 * Opens `url` in the app's in-app browser screen (`/browser`). Route params
 * are strings, so the POST form travels as JSON and CSS as a preset name.
 */
export function openInAppBrowser(
  url: string,
  options: InAppBrowserOptions = {},
): void {
  const params: Record<string, string> = { url };

  if (options.method === 'POST') {
    params.method = 'POST';
    params.postForm = JSON.stringify(options.postForm ?? {});
  }

  if (options.cssPreset !== undefined) {
    params.css = options.cssPreset;
  }

  if (options.fileName !== undefined) {
    params.fileName = options.fileName;
  }

  if (options.title !== undefined) {
    params.title = options.title;
  }

  if (options.exportAsPdf) {
    params.exportPdf = '1';
  }

  router.push({ pathname: '/browser', params });
}

/** Opens `url` in the system browser or store app. */
export async function openExternalUrl(url: string): Promise<void> {
  try {
    await Linking.openURL(url);
  } catch {
    // No handler for the URL; nothing sensible to do.
  }
}
