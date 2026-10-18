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
