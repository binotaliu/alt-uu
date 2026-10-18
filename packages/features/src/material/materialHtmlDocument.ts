import { processHtmlForColorScheme } from './htmlColorScheme';

/** Colours of the material article (legacy `prose-theme` / `dark:prose-invert`). */
export interface MaterialHtmlPalette {
    text: string;
    heading: string;
    link: string;
    muted: string;
    border: string;
    codeBackground: string;
}

/** Messages the material WebView posts to React Native. */
export type MaterialHtmlMessage =
    | { type: 'height'; height: number }
    | { type: 'link'; href: string }
    | { type: 'image'; src: string; alt: string };

/** Font scale steps (legacy MaterialViewer). */
export const FONT_SCALE_DEFAULT = 1;
export const FONT_SCALE_STEP = 0.1;
export const FONT_SCALE_MIN = 0.7;
export const FONT_SCALE_MAX = 1.6;

export function clampFontScale(value: number): number {
    return Number(
        Math.min(FONT_SCALE_MAX, Math.max(FONT_SCALE_MIN, value)).toFixed(2),
    );
}

/**
 * Script injected into the material page: reports the content height (the
 * WebView is sized to it, so the page scrolls in React Native) and turns
 * link / image taps into messages instead of navigations.
 */
export const MATERIAL_HTML_BRIDGE_SCRIPT = `(function () {
    if (window.__altuuBridge) { return; }
    window.__altuuBridge = true;
    var post = function (message) {
        if (window.ReactNativeWebView) {
            window.ReactNativeWebView.postMessage(JSON.stringify(message));
        }
    };
    var lastHeight = 0;
    var reportHeight = function () {
        var root = document.getElementById('altuu-content');
        if (!root) { return; }
        var height = Math.ceil(root.getBoundingClientRect().height);
        if (Math.abs(height - lastHeight) > 1) {
            lastHeight = height;
            post({ type: 'height', height: height });
        }
    };
    window.__altuuReportHeight = reportHeight;
    if (typeof ResizeObserver === 'function') {
        new ResizeObserver(reportHeight).observe(document.getElementById('altuu-content'));
    }
    window.addEventListener('load', reportHeight);
    document.addEventListener('load', reportHeight, true);
    setTimeout(reportHeight, 50);
    setTimeout(reportHeight, 500);
    document.addEventListener('click', function (event) {
        var target = event.target;
        if (!target || !target.closest) { return; }
        var link = target.closest('a[href]');
        if (link) {
            var raw = link.getAttribute('href') || '';
            if (raw === '' || raw.charAt(0) === '#') { return; }
            event.preventDefault();
            event.stopPropagation();
            post({ type: 'link', href: link.href });
            return;
        }
        var image = target.closest('img');
        if (image && (image.currentSrc || image.src)) {
            event.preventDefault();
            post({ type: 'image', src: image.currentSrc || image.src, alt: image.alt || '' });
        }
    }, true);
    reportHeight();
})();
true;`;

/** Updates the font scale of a loaded page without reloading it. */
export function fontScaleScript(scale: number): string {
    return `document.documentElement.style.setProperty('--altuu-scale', '${clampFontScale(scale)}'); if (window.__altuuReportHeight) { window.__altuuReportHeight(); } true;`;
}

function stylesheet(palette: MaterialHtmlPalette, isDark: boolean): string {
    return `
:root { --altuu-scale: 1; color-scheme: ${isDark ? 'dark' : 'light'}; }
html, body { margin: 0; padding: 0; background: transparent; }
body {
    -webkit-text-size-adjust: 100%;
    font-family: -apple-system, system-ui, 'PingFang TC', 'Noto Sans TC', 'Noto Sans CJK TC', sans-serif;
    color: ${palette.text};
    line-height: 1.75;
    overflow-wrap: anywhere;
}
#altuu-content { font-size: calc(16px * var(--altuu-scale)); padding: 20px 16px; overflow: hidden; }
#altuu-content > :first-child { margin-top: 0; }
#altuu-content > :last-child { margin-bottom: 0; }
img, video, svg, canvas { max-width: 100% !important; height: auto !important; }
iframe { max-width: 100%; border: 0; }
a { color: ${palette.link}; text-decoration: underline; text-underline-offset: 2px; }
h1, h2, h3, h4, h5, h6 { color: ${palette.heading}; font-weight: 700; line-height: 1.35; margin: 1.6em 0 0.6em; }
h1 { font-size: 2.1em; } h2 { font-size: 1.5em; } h3 { font-size: 1.25em; } h4 { font-size: 1.05em; }
p, ul, ol, dl, blockquote, pre, table, figure { margin: 0 0 1.15em; }
ul, ol { padding-left: 1.6em; }
li { margin: 0.4em 0; }
strong, b { color: ${palette.heading}; font-weight: 600; }
blockquote { border-left: 0.25em solid ${palette.border}; padding-left: 1em; color: ${palette.muted}; font-style: italic; }
hr { border: 0; border-top: 1px solid ${palette.border}; margin: 2em 0; }
table { border-collapse: collapse; display: block; overflow-x: auto; max-width: 100%; font-size: 0.9em; }
th, td { border: 1px solid ${palette.border}; padding: 0.45em 0.65em; vertical-align: top; }
pre { white-space: pre-wrap; background: ${palette.codeBackground}; padding: 0.85em 1em; border-radius: 8px; overflow-x: auto; }
code { font-size: 0.9em; }
`;
}

/**
 * The full HTML document the material WebView loads with `baseUrl` (so
 * relative links and same-host images resolve upstream and carry the seeded
 * HUNGU cookies).
 */
export function buildMaterialHtmlDocument(options: {
    html: string;
    isDark: boolean;
    fontScale: number;
    palette: MaterialHtmlPalette;
}): string {
    const body = processHtmlForColorScheme(options.html.trim(), options.isDark);

    return `<!doctype html>
<html lang="zh-Hant" style="--altuu-scale: ${clampFontScale(options.fontScale)}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1">
<style>${stylesheet(options.palette, options.isDark)}</style>
</head>
<body><div id="altuu-content">${body}</div></body>
</html>`;
}

/** Parses a WebView message; anything unexpected yields null. */
export function parseMaterialHtmlMessage(
    data: string,
): MaterialHtmlMessage | null {
    let parsed: unknown;

    try {
        parsed = JSON.parse(data);
    } catch {
        return null;
    }

    if (typeof parsed !== 'object' || parsed === null) {
        return null;
    }

    const message = parsed as Record<string, unknown>;

    if (
        message.type === 'height' &&
        typeof message.height === 'number' &&
        Number.isFinite(message.height)
    ) {
        return { type: 'height', height: message.height };
    }

    if (message.type === 'link' && typeof message.href === 'string') {
        return { type: 'link', href: message.href };
    }

    if (message.type === 'image' && typeof message.src === 'string') {
        return {
            type: 'image',
            src: message.src,
            alt: typeof message.alt === 'string' ? message.alt : '',
        };
    }

    return null;
}
