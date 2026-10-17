import { describe, expect, it } from 'vitest';
import {
    loadExpected,
    loadFixture,
    loadFixtureBytes,
    loadGolden,
} from '../../../../test/fixtures';
import { decodeLegacyProxyUrls } from '../testing';
import type { FakeResponder } from '../../../http/testing';
import { createCourseHarness, type ByteReply } from './harness';

const HTML = 'text/html; charset=utf-8';

interface Scenario {
    /** Fixture whose bytes are the GET body; omit for no upstream body. */
    body?: string;
    getContentType?: string;
    head?: { status: number; contentType?: string };
}

/** Upstream behaviour of each legacy test (see the fixtures' notes). */
const SCENARIOS: Record<string, Scenario> = {
    'parse-material-video-flowplayer-js': {
        body: 'parse-material-video-flowplayer-js.html',
    },
    'parse-material-video-html5-flowplayer': {
        body: 'parse-material-video-html5-flowplayer.html',
    },
    'parse-material-html-only': { body: 'parse-material-html-only.html' },
    'parse-material-rewrite-relative-urls': {
        body: 'parse-material-rewrite-relative-urls.html',
    },
    'parse-material-malformed-utf8': {
        body: 'parse-material-malformed-utf8.html',
    },
    'parse-material-big5': { body: 'parse-material-big5.html' },
    'parse-material-download-pdf': {},
    'parse-material-download-zip': {},
    'parse-material-probe-zip-content-type': {
        head: { status: 200, contentType: 'application/zip' },
    },
    'parse-material-probe-inconclusive': {
        body: 'parse-material-probe-inconclusive.html',
        head: { status: 204 },
    },
    'parse-material-probe-plain-text': {
        body: 'parse-material-probe-plain-text.txt',
        getContentType: 'text/plain; charset=utf-8',
        head: { status: 200, contentType: 'text/plain; charset=utf-8' },
    },
    'parse-material-youtube-embed-redirector': {},
    'parse-material-youtube-lms-prefixed': {},
    'parse-material-empty-tags': {
        body: 'parse-material-empty-tags.html',
        head: { status: 200, contentType: HTML },
    },
    'parse-material-ideographic-spaces': {
        body: 'parse-material-ideographic-spaces.html',
        head: { status: 200, contentType: HTML },
    },
    'parse-material-dotdot-asset': { body: 'parse-material-dotdot-asset.html' },
    'parse-material-same-host-img': {
        body: 'parse-material-same-host-img.html',
    },
    'material-viewer-lesson-1': { body: 'material-viewer-lesson-1.html' },
    'material-viewer-lesson-2-flowplayer': {
        body: 'material-viewer-lesson-2-flowplayer.html',
    },
};

interface GoldenOutput {
    status: number;
    json: Record<string, unknown>;
    upstreamRequests: string[];
}

function handoff(url: string, sessionBaseUrl: string) {
    return {
        url,
        headers: {
            'User-Agent': 'test-agent',
            Origin: sessionBaseUrl,
            Referer: `${sessionBaseUrl}/learn/index.php`,
            Cookie: 'WM=cookie',
            Accept: '*/*',
        },
    };
}

/**
 * The legacy JSON with the documented RN deviations applied: proxy URLs
 * unwrapped to the original upstream URL, `downloadProxyUrl` null, and the
 * `baseUrl` / `download` / `subtitle` descriptors that replace the proxy.
 */
function expectedFromGolden(
    json: Record<string, unknown>,
    url: string,
    sessionBaseUrl: string,
): Record<string, unknown> {
    const subtitleUrl =
        typeof json.subtitleUrl === 'string'
            ? decodeLegacyProxyUrls(json.subtitleUrl)
            : null;
    const htmlContent =
        typeof json.htmlContent === 'string'
            ? decodeLegacyProxyUrls(json.htmlContent)
            : json.htmlContent;
    const isPage = json.videoProvider === 'native' && json.downloadUrl === null;

    return {
        ...json,
        subtitleUrl,
        htmlContent,
        downloadProxyUrl: null,
        baseUrl: isPage ? url : null,
        download:
            typeof json.downloadUrl === 'string'
                ? handoff(json.downloadUrl, sessionBaseUrl)
                : null,
        subtitle:
            subtitleUrl !== null ? handoff(subtitleUrl, sessionBaseUrl) : null,
    };
}

describe('ParseMaterialContent parity with the legacy goldens', () => {
    for (const [name, scenario] of Object.entries(SCENARIOS)) {
        it(name, async () => {
            const golden = loadGolden('course', name).cases[0];
            const input = golden.input as {
                url: string;
                sessionBaseUrl: string;
            };
            const output = golden.output as GoldenOutput;
            const routes: Array<[string, FakeResponder]> = [];
            const byteRoutes: Record<string, ByteReply> = {};

            if (scenario.head !== undefined) {
                const head = scenario.head;
                routes.push([
                    input.url,
                    (request) =>
                        request.method === 'HEAD'
                            ? {
                                  status: head.status,
                                  headers: (head.contentType !== undefined
                                      ? { 'content-type': head.contentType }
                                      : {}) as Record<string, string>,
                              }
                            : new Error('unexpected GET'),
                ]);
            }

            if (scenario.body !== undefined) {
                byteRoutes[input.url] = {
                    headers: {
                        'content-type': scenario.getContentType ?? HTML,
                    },
                    bytes: loadFixtureBytes('course', scenario.body),
                };
            }

            const { services, requests } = await createCourseHarness({
                routes,
                byteRoutes,
                session: { baseUrl: input.sessionBaseUrl },
            });

            const result = await services.getParsedMaterialContent(input.url);

            expect(result).toEqual(
                expectedFromGolden(
                    output.json,
                    input.url,
                    input.sessionBaseUrl,
                ),
            );
            expect(
                requests.map((request) => `${request.method} ${request.url}`),
            ).toEqual(output.upstreamRequests);
        });
    }

    it('keeps every fixture that holds a URL in sync with the golden input', () => {
        for (const name of [
            'parse-material-download-pdf',
            'parse-material-download-zip',
            'parse-material-probe-zip-content-type',
            'parse-material-youtube-embed-redirector',
            'parse-material-youtube-lms-prefixed',
        ]) {
            const input = loadGolden('course', name).cases[0].input as {
                url: string;
            };
            expect(loadFixture('course', name).trim()).toBe(input.url);
        }
    });

    it('meets the legacy assertions on the Big5 and malformed UTF-8 pages', async () => {
        for (const name of [
            'parse-material-big5',
            'parse-material-malformed-utf8',
        ]) {
            const golden = loadGolden('course', name).cases[0];
            const input = golden.input as {
                url: string;
                sessionBaseUrl: string;
            };
            const { services } = await createCourseHarness({
                byteRoutes: {
                    [input.url]: {
                        headers: { 'content-type': HTML },
                        bytes: loadFixtureBytes('course', `${name}.html`),
                    },
                },
                session: { baseUrl: input.sessionBaseUrl },
            });
            const result = await services.getParsedMaterialContent(input.url);

            expect(result.htmlContent).not.toContain('\ufffd');
        }

        const big5 = loadExpected('course', 'parse-material-big5').cases[0];
        expect(JSON.stringify(big5.expected)).toContain('測試 Big5 內容');
    });

    it('rejects URLs on another host than the session (legacy 403)', async () => {
        const { services, requests } = await createCourseHarness();

        await expect(
            services.getParsedMaterialContent(
                'https://evil.example.com/page.html',
            ),
        ).rejects.toMatchObject({ status: 403, message: '不允許存取外部資源' });
        expect(requests).toEqual([]);
    });
});
