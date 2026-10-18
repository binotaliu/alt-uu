import type { InAppBrowserCssPreset } from '../../shell/openUrl';

export interface BrowserRequest {
  url: string;
  method: 'GET' | 'POST';
  /** Only set for POST. */
  postForm: Record<string, string>;
  cssPreset: InAppBrowserCssPreset | null;
}

export type BrowserParamsResult =
  { ok: true; request: BrowserRequest } | { ok: false; reason: string };

type RawParams = Record<string, string | string[] | undefined>;

const first = (value: string | string[] | undefined): string | undefined =>
  Array.isArray(value) ? value[0] : value;

const CSS_PRESETS: readonly InAppBrowserCssPreset[] = ['homework'];

function parsePostForm(raw: string | undefined): Record<string, string> {
  if (!raw) {
    return {};
  }

  try {
    const parsed: unknown = JSON.parse(raw);

    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      Array.isArray(parsed)
    ) {
      return {};
    }

    return Object.fromEntries(
      Object.entries(parsed).flatMap(([key, value]) =>
        typeof value === 'string' || typeof value === 'number'
          ? [[key, String(value)]]
          : [],
      ),
    );
  } catch {
    return {};
  }
}

/**
 * Validates the `/browser` route params written by `openInAppBrowser`. Only
 * http(s) pages open here; everything else is handed to the system.
 */
export function parseBrowserParams(params: RawParams): BrowserParamsResult {
  const url = first(params.url)?.trim();

  if (!url) {
    return { ok: false, reason: '沒有指定要開啟的網址。' };
  }

  if (!/^https?:\/\//i.test(url)) {
    return { ok: false, reason: '無法在 App 內開啟此網址。' };
  }

  const method =
    first(params.method)?.toUpperCase() === 'POST' ? 'POST' : 'GET';
  const postForm =
    method === 'POST' ? parsePostForm(first(params.postForm)) : {};
  const css = first(params.css);
  const cssPreset = CSS_PRESETS.find((preset) => preset === css) ?? null;

  // Legacy only posted when the form had fields.
  const effectiveMethod =
    method === 'POST' && Object.keys(postForm).length > 0 ? 'POST' : 'GET';

  return {
    ok: true,
    request: { url, method: effectiveMethod, postForm, cssPreset },
  };
}

function formEncode(value: string): string {
  return encodeURIComponent(value).replace(/%20/g, '+');
}

/** Legacy `formBody`: keys sorted, urlencoded. */
export function encodeFormBody(form: Record<string, string>): string {
  return Object.keys(form)
    .sort()
    .map((key) => `${formEncode(key)}=${formEncode(form[key])}`)
    .join('&');
}
