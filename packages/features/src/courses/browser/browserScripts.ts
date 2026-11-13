import { homeworkCss } from './homeworkCss';
import type { InAppBrowserCssPreset } from '../../shell/openUrl';

/**
 * Old HUNGU / school portal pages ship no viewport meta tag, so the WebView
 * lays them out at desktop width and shrinks them. Force a device-width
 * viewport before layout (legacy `makeViewportInjectionScript`).
 */
export const viewportFixScript = `(function () {
    try {
        var meta = document.querySelector('meta[name="viewport"]');
        if (!meta) {
            meta = document.createElement('meta');
            meta.name = 'viewport';
            (document.head || document.documentElement).appendChild(meta);
        }
        meta.content = 'width=device-width, initial-scale=1';
    } catch (e) {}
})();`;

const cssByPreset: Record<InAppBrowserCssPreset, string> = {
  homework: homeworkCss,
};

/** Adds (or replaces) a `<style>` element carrying `css`. */
export function createCssInjectionScript(css: string): string {
  return `(function () {
    try {
        var css = ${JSON.stringify(css)};
        var style = document.getElementById('__altuu_attachment_css__');
        if (!style) {
            style = document.createElement('style');
            style.id = '__altuu_attachment_css__';
            (document.head || document.documentElement).appendChild(style);
        }
        style.textContent = css;
    } catch (e) {}
})();`;
}

/**
 * Script for `injectedJavaScriptBeforeContentLoaded`: viewport fix plus the
 * optional stylesheet. The style element is appended to `documentElement`
 * when `<head>` does not exist yet, so it applies from the first paint.
 * Always ends with `true` (react-native-webview requires it on iOS).
 */
export function buildBeforeContentLoadedScript(
  cssPreset: InAppBrowserCssPreset | null,
): string {
  const parts = [viewportFixScript];

  if (cssPreset !== null) {
    parts.push(createCssInjectionScript(cssByPreset[cssPreset]));
  }

  return `${parts.join('\n')}\ntrue;`;
}

export const HTML_SNAPSHOT_PREFIX = 'altuu:html:';

/**
 * Posts a script-free copy of the page (current form state included, with a
 * `<base>` so relative links resolve) back through `onMessage`, for PDF export.
 */
export const htmlSnapshotScript = `(function () {
    try {
        document.querySelectorAll('input').forEach(function (el) {
            if (el.type === 'checkbox' || el.type === 'radio') {
                if (el.checked) { el.setAttribute('checked', ''); } else { el.removeAttribute('checked'); }
            } else {
                el.setAttribute('value', el.value);
            }
        });
        document.querySelectorAll('textarea').forEach(function (el) { el.textContent = el.value; });
        document.querySelectorAll('option').forEach(function (el) {
            if (el.selected) { el.setAttribute('selected', ''); } else { el.removeAttribute('selected'); }
        });
        var copy = document.documentElement.cloneNode(true);
        copy.querySelectorAll('script').forEach(function (el) { el.remove(); });
        var head = copy.querySelector('head');
        if (head) {
            var base = document.createElement('base');
            base.href = document.baseURI;
            head.insertBefore(base, head.firstChild);
        }
        window.ReactNativeWebView.postMessage(${JSON.stringify(HTML_SNAPSHOT_PREFIX)} + '<!DOCTYPE html>' + copy.outerHTML);
    } catch (e) {
        window.ReactNativeWebView.postMessage(${JSON.stringify(HTML_SNAPSHOT_PREFIX)});
    }
})(); true;`;
