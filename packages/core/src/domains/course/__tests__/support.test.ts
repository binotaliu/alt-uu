import { describe, expect, it } from 'vitest';
import { loadFixture, loadGolden } from '../../../../test/fixtures';
import {
    decodeCp950Strict,
    decodeLegacyText,
    decodeUtf8Strict,
} from '../encoding/legacyText';
import { matchCourseType } from '../listCourses';
import { classifyDownloadable } from '../support/materialDownloadClassifier';
import { parseUrl, resolveRelativeUrl } from '../support/phpUrl';
import {
    extractFlowplayerJsConfigVideo,
    extractHtml5SourceVideo,
} from '../support/videoExtractors';
import { extractYoutubeVideoId } from '../support/youtubeEmbedUrlParser';

describe('YoutubeEmbedUrlParser', () => {
    it.each(
        loadGolden('course', 'youtube-embed-urls').cases.map(
            (testCase) => [testCase.name, testCase] as const,
        ),
    )('%s', (_name, testCase) => {
        const { url } = testCase.input as { url: string };
        expect(extractYoutubeVideoId(url)).toBe(testCase.output);
    });
});

describe('video extractors', () => {
    const run = (name: string) => {
        const golden = loadGolden('course', name).cases[0];
        const html = loadFixture('course', name);

        return { golden, html };
    };

    it('reads a flowplayer JS config', () => {
        const { golden, html } = run('extractor-flowplayer-js-config');
        expect(extractFlowplayerJsConfigVideo(html)).toEqual(golden.output);
    });

    it('ignores a relative flowplayer src', () => {
        const { golden, html } = run('extractor-flowplayer-js-relative-src');
        expect(extractFlowplayerJsConfigVideo(html)).toEqual(golden.output);
    });

    it('reads a declarative HTML5 flowplayer source', () => {
        const { golden, html } = run('extractor-html5-declarative-flowplayer');
        expect(extractHtml5SourceVideo(html)).toEqual(golden.output);
    });

    it('reads an HTML5 subtitle track', () => {
        const { golden, html } = run('extractor-html5-track-subtitle');
        expect(extractHtml5SourceVideo(html)).toEqual(golden.output);
    });

    it('finds nothing on a page without video', () => {
        const { golden, html } = run('extractor-no-video');
        expect({
            html5: extractHtml5SourceVideo(html),
            flowplayerJs: extractFlowplayerJsConfigVideo(html),
        }).toEqual(golden.output);
    });
});

describe('CourseTypeMatcher', () => {
    it('matches the golden', () => {
        const golden = loadGolden('course', 'course-type-matcher').cases[0];
        const input = golden.input as {
            course: Record<string, unknown>;
            courseTypesByTitleKey: Parameters<typeof matchCourseType>[1];
        };

        expect(
            matchCourseType(input.course, input.courseTypesByTitleKey),
        ).toEqual(golden.output);
    });

    it('falls back to the course_type field', () => {
        expect(
            matchCourseType({ title: 'x', course_type: ' 網頁 ' }, {}),
        ).toEqual({
            courseType: '網頁',
            commonCourseId: null,
        });
    });
});

describe('MaterialDownloadClassifier', () => {
    it.each([
        ['https://a/x.pdf', '', { extension: 'pdf', isPdf: true }],
        ['https://a/x', 'application/pdf', { extension: 'pdf', isPdf: true }],
        ['https://a/x.docx', '', { extension: 'docx', isPdf: false }],
        ['https://a/x', 'application/zip', { extension: 'zip', isPdf: false }],
        ['https://a/x', 'image/png', { extension: '', isPdf: false }],
        ['https://a/x.html', 'text/html', null],
        ['https://a/x', 'application/json', null],
        ['https://a/x', '', null],
    ] as const)('%s %s', (url, contentType, expected) => {
        expect(classifyDownloadable(url, contentType)).toEqual(expected);
    });
});

describe('PHP URL helpers', () => {
    it('parses like parse_url', () => {
        expect(
            parseUrl('https://user:pw@uu.nou.edu.tw:8443/a/b.php?x=1#f'),
        ).toEqual({
            scheme: 'https',
            user: 'user',
            pass: 'pw',
            host: 'uu.nou.edu.tw',
            port: 8443,
            path: '/a/b.php',
            query: 'x=1',
            fragment: 'f',
        });
        expect(parseUrl('images/a.png')).toEqual({ path: 'images/a.png' });
    });

    it.each([
        ['images/cover.jpg', 'https://e.com/content/unit/images/cover.jpg'],
        ['../files/a.pdf', 'https://e.com/content/files/a.pdf'],
        ['/media/x.html', 'https://e.com/media/x.html'],
        ['//cdn.e.com/y', 'https://cdn.e.com/y'],
        ['#s2', 'https://e.com/content/unit/page.html#s2'],
        ['?p=2', 'https://e.com/content/unit/page.html?p=2'],
        ['http://other/x', 'http://other/x'],
        ['  ', null],
    ])('resolves %s', (relative, expected) => {
        expect(
            resolveRelativeUrl(
                'https://e.com/content/unit/page.html',
                relative,
            ),
        ).toBe(expected);
    });
});

describe('legacy text decoding (ensureUtf8)', () => {
    it('keeps valid UTF-8', () => {
        const bytes = new TextEncoder().encode('課程 😀 ok');
        expect(decodeUtf8Strict(bytes)).toBe('課程 😀 ok');
        expect(decodeLegacyText(bytes)).toBe('課程 😀 ok');
    });

    it('rejects invalid UTF-8', () => {
        expect(decodeUtf8Strict(new Uint8Array([0xc3, 0x28]))).toBeNull();
        expect(decodeUtf8Strict(new Uint8Array([0xed, 0xa0, 0x80]))).toBeNull();
        expect(decodeUtf8Strict(new Uint8Array([0xe6, 0xb8]))).toBeNull();
    });

    it('decodes Big5 (CP950)', () => {
        // 測試 in Big5
        const bytes = new Uint8Array([0xb4, 0xfa, 0xb8, 0xd5]);
        expect(decodeCp950Strict(bytes)).toBe('測試');
        expect(decodeLegacyText(bytes)).toBe('測試');
    });

    it('falls back to Windows-1252', () => {
        expect(decodeLegacyText(new Uint8Array([0x42, 0xc3, 0x28, 0x80]))).toBe(
            'BÃ(€',
        );
    });
});
