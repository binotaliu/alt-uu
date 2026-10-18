import { execFileSync } from 'node:child_process';
import { fixture, hd } from './lib.mjs';

const D = 'course';
const FC = 'Feature/Course/ParseMaterialContentTest.php';
const UC = 'Unit/ParseMaterialContentTest.php';
const CLS = 'AltUU\\Domains\\Course\\Actions\\ParseMaterialContent (via GET /materials/content/parsed)';
const HTML_CT = { 'content-type': 'text/html; charset=utf-8' };
const BASE = 'https://example.com';

const parsed = (name, url, extra = {}) => ({
    kind: 'material-parsed',
    baseUrl: BASE,
    url,
    responses: [{ file: name, status: 200, headers: HTML_CT }],
    ...extra,
});

// ---- Feature/Course/ParseMaterialContentTest.php
fixture({
    domain: D,
    name: 'parse-material-video-flowplayer-js',
    ext: 'html',
    input: hd(FC, 32),
    source: `${FC}:31`,
    cls: CLS,
    cases: [{
        name: 'returns video url and cleaned html for video content',
        input: { url: 'https://example.com/page.html', upstreamContentType: 'text/html; charset=utf-8' },
        partial: true,
        expected: {
            videoUrl: 'https://example.com/video/playlist.m3u8',
            subtitleUrl: { proxyOf: 'https://example.com/01.vtt' },
            downloadUrl: null,
            responseKeys: ['videoUrl', 'subtitleUrl', 'downloadUrl', 'downloadProxyUrl', 'downloadFileName', 'downloadFileExtension', 'isPdf', 'htmlContent'],
            htmlContent: { notContains: ['<script', 'flowplayer', 'id="player"'], contains: ['測試影片內容'] },
            noHeadRequestSent: true,
        },
    }],
    golden: parsed('parse-material-video-flowplayer-js.html', 'https://example.com/page.html'),
});

fixture({
    domain: D,
    name: 'parse-material-video-html5-flowplayer',
    ext: 'html',
    input: hd(FC, 86),
    source: `${FC}:85`,
    cls: CLS,
    cases: [{
        name: 'returns video url and cleaned html for declarative html5 flowplayer content',
        input: { url: 'https://example.com/page.html' },
        partial: true,
        expected: {
            videoUrl: 'https://media.example.com/vod/_definst_/900001/01/01.mp4/playlist.m3u8',
            subtitleUrl: null,
            downloadUrl: null,
            htmlContent: { notContains: ['<script', 'flowplayer', '<video'], contains: ['測試影片內容'] },
        },
    }],
    golden: parsed('parse-material-video-html5-flowplayer.html', 'https://example.com/page.html'),
});

fixture({
    domain: D,
    name: 'parse-material-html-only',
    ext: 'html',
    input: hd(FC, 131),
    source: `${FC}:130`,
    cls: CLS,
    cases: [{
        name: 'returns null video url for html-only content',
        input: { url: 'https://example.com/content/overview.html' },
        partial: true,
        expected: { videoUrl: null, subtitleUrl: null, downloadUrl: null, htmlContent: { contains: ['課程概覽'] } },
    }],
    golden: parsed('parse-material-html-only.html', 'https://example.com/content/overview.html'),
});

fixture({
    domain: D,
    name: 'parse-material-rewrite-relative-urls',
    ext: 'html',
    input: hd(FC, 311),
    source: `${FC}:310`,
    cls: CLS,
    cases: [{
        name: 'rewrites relative src and anchor href attributes in parsed html',
        input: { url: 'https://example.com/content/unit/page.html' },
        partial: true,
        expected: {
            htmlContent: {
                contains: [
                    { proxyOf: 'https://example.com/content/unit/images/cover.jpg' },
                    { proxyOf: 'https://example.com/media/embed/player.html' },
                    'href="https://example.com/content/files/lesson.pdf"',
                    'href="https://example.com/content/unit/page.html#section-2"',
                    'target="_blank"',
                    'noopener',
                    'noreferrer',
                ],
            },
        },
    }],
    golden: parsed('parse-material-rewrite-relative-urls.html', 'https://example.com/content/unit/page.html'),
});

const badBytes = Buffer.concat([Buffer.from('<html><body><p>Bad '), Buffer.from([0xc3, 0x28]), Buffer.from(' bytes</p></body></html>')]);
fixture({
    domain: D,
    name: 'parse-material-malformed-utf8',
    ext: 'html',
    input: badBytes,
    source: `${FC}:352`,
    cls: CLS,
    note: 'Binary file: contains the invalid UTF-8 byte sequence 0xC3 0x28.',
    cases: [{
        name: 'sanitizes malformed utf-8 in parsed html response',
        input: { url: 'https://example.com/content/bad.html' },
        partial: true,
        expected: { htmlContent: { contains: ['Bad'], isValidUtf8: true } },
    }],
    golden: parsed('parse-material-malformed-utf8.html', 'https://example.com/content/bad.html'),
});

const big5 = execFileSync('php', ['-r', "echo '<html><body><p>'.mb_convert_encoding('測試 Big5 內容', 'BIG-5', 'UTF-8').'</p></body></html>';"]);
fixture({
    domain: D,
    name: 'parse-material-big5',
    ext: 'html',
    input: big5,
    source: `${FC}:373`,
    cls: CLS,
    note: 'Binary file: Big5-encoded body served with a (wrong) charset=utf-8 content-type.',
    cases: [{
        name: 'converts big5 encoded html to utf-8',
        input: { url: 'https://example.com/content/big5.html', upstreamContentType: 'text/html; charset=utf-8' },
        partial: true,
        expected: { htmlContent: { contains: ['測試 Big5 內容'], isValidUtf8: true } },
    }],
    golden: parsed('parse-material-big5.html', 'https://example.com/content/big5.html'),
});

// ---- download / probe / youtube: URL-only fixtures
const urlOnly = (name, url, line, testName, expected, golden, partial = true) =>
    fixture({
        domain: D,
        name,
        ext: 'txt',
        input: url + '\n',
        source: `${FC}:${line}`,
        cls: CLS,
        note: 'Input file holds the material URL passed as ?url= (no upstream body unless noted).',
        cases: [{ name: testName, input: { url, upstream: golden.upstreamNote ?? 'no HTTP request must be sent' }, partial, expected }],
        golden,
    });

urlOnly(
    'parse-material-download-pdf',
    'https://example.com/content/files/lesson.pdf',
    163,
    'returns a download result for pdf material links without fetching the body',
    { videoUrl: null, subtitleUrl: null, downloadUrl: 'https://example.com/content/files/lesson.pdf', downloadProxyUrl: { proxyOf: 'https://example.com/content/files/lesson.pdf' }, downloadFileExtension: 'pdf', isPdf: true, htmlContent: '', noHttpRequestSent: true },
    { kind: 'material-parsed', baseUrl: BASE, url: 'https://example.com/content/files/lesson.pdf', responses: [] },
);
urlOnly(
    'parse-material-download-zip',
    'https://example.com/content/files/w00/example.zip',
    185,
    'returns a download result for zip material links without fetching the body',
    { downloadUrl: 'https://example.com/content/files/w00/example.zip', downloadProxyUrl: { proxyOf: 'https://example.com/content/files/w00/example.zip' }, downloadFileName: 'example.zip', downloadFileExtension: 'zip', isPdf: false, htmlContent: '', noHttpRequestSent: true },
    { kind: 'material-parsed', baseUrl: BASE, url: 'https://example.com/content/files/w00/example.zip', responses: [] },
);
urlOnly(
    'parse-material-probe-zip-content-type',
    'https://example.com/download?id=1',
    206,
    'classifies an ambiguous extension as a download using a HEAD content-type probe',
    { downloadUrl: 'https://example.com/download?id=1', downloadFileExtension: 'zip', isPdf: false, requests: { headSent: true, getSent: false } },
    { kind: 'material-parsed', baseUrl: BASE, url: 'https://example.com/download?id=1', responses: [{ file: null, status: 200, headers: { 'content-type': 'application/zip' } }], upstreamNote: 'HEAD -> 200 content-type: application/zip (empty body)' },
);
fixture({
    domain: D,
    name: 'parse-material-probe-inconclusive',
    ext: 'html',
    input: '<html><body><h2>舊版頁面</h2></body></html>',
    source: `${FC}:228`,
    cls: CLS,
    note: 'Body of the second (GET) response. First (HEAD) response is 204 with no headers.',
    cases: [{
        name: 'falls back to fetching and parsing html when the HEAD probe is inconclusive',
        input: { url: 'https://example.com/legacy/page?id=1', responseSequence: ['HEAD -> 204, no headers, empty body', 'GET -> 200 text/html; charset=utf-8, this file'] },
        partial: true,
        expected: { downloadUrl: null, htmlContent: { contains: ['舊版頁面'] }, requests: { headSent: true, getSent: true } },
    }],
    golden: { kind: 'material-parsed', baseUrl: BASE, url: 'https://example.com/legacy/page?id=1', responses: [{ file: null, status: 204, headers: {} }, { file: 'parse-material-probe-inconclusive.html', status: 200, headers: HTML_CT }] },
});
fixture({
    domain: D,
    name: 'parse-material-probe-plain-text',
    ext: 'txt',
    input: 'plain text body',
    source: `${FC}:250`,
    cls: CLS,
    note: 'Body of the second (GET) response. First (HEAD) response is 200 text/plain with empty body.',
    cases: [{
        name: 'does not classify plain text content as a download',
        input: { url: 'https://example.com/notes/summary?id=1', responseSequence: ['HEAD -> 200 text/plain; charset=utf-8, empty body', 'GET -> 200 text/plain; charset=utf-8, this file'] },
        partial: true,
        expected: { downloadUrl: null, requests: { headSent: true, getSent: true } },
    }],
    golden: { kind: 'material-parsed', baseUrl: BASE, url: 'https://example.com/notes/summary?id=1', responses: [{ file: null, status: 200, headers: { 'content-type': 'text/plain; charset=utf-8' } }, { file: 'parse-material-probe-plain-text.txt', status: 200, headers: { 'content-type': 'text/plain; charset=utf-8' } }] },
});
urlOnly(
    'parse-material-youtube-embed-redirector',
    'https://example.com/learn/path/youtubeEmbed.php?v=dQw4w9WgXcQ',
    273,
    'returns a youtube embed result without fetching the redirector page',
    { videoUrl: null, videoProvider: 'youtube', embedVideoUrl: { staticsBaseUrlConfig: '/youtube-embed.html?v=dQw4w9WgXcQ' }, downloadUrl: null, htmlContent: '', noHttpRequestSent: true },
    { kind: 'material-parsed', baseUrl: BASE, url: 'https://example.com/learn/path/youtubeEmbed.php?v=dQw4w9WgXcQ', responses: [] },
);
urlOnly(
    'parse-material-youtube-lms-prefixed',
    'https://example.com/base/100001/content/999999/https://youtu.be/dQw4w9WgXcQ?si=xxxxxx',
    294,
    'returns a youtube embed result for an lms-prefixed youtube url',
    { videoProvider: 'youtube', embedVideoUrl: { staticsBaseUrlConfig: '/youtube-embed.html?v=dQw4w9WgXcQ' }, noHttpRequestSent: true },
    { kind: 'material-parsed', baseUrl: BASE, url: 'https://example.com/base/100001/content/999999/https://youtu.be/dQw4w9WgXcQ?si=xxxxxx', responses: [] },
);

// ---- Unit/ParseMaterialContentTest.php
fixture({
    domain: D,
    name: 'parse-material-empty-tags',
    ext: 'html',
    input: hd(UC, 18),
    source: `${UC}:17`,
    cls: CLS,
    note: 'Unit test mocks probeContentType -> text/html then fetchMaterialContent; URL has no extension.',
    cases: [{
        name: 'it removes empty heading and paragraph tags with no attributes',
        input: { url: 'https://example.com/page', host: 'example.com', responseSequence: ['HEAD probe -> 200 text/html; charset=utf-8', 'GET -> this file'] },
        partial: true,
        expected: { htmlContent: { notContains: ['<h1>', '<p></p>', '<h2>'], contains: ['Visible'] } },
    }],
    golden: { kind: 'material-parsed', baseUrl: BASE, url: 'https://example.com/page', responses: [{ file: null, status: 200, headers: HTML_CT }, { file: 'parse-material-empty-tags.html', status: 200, headers: HTML_CT }] },
});
fixture({
    domain: D,
    name: 'parse-material-ideographic-spaces',
    ext: 'html',
    input: hd(UC, 49),
    source: `${UC}:48`,
    cls: CLS,
    cases: [{
        name: 'it removes tags containing only ideographic or non-breaking spaces',
        input: { url: 'https://example.com/page', host: 'example.com', responseSequence: ['HEAD probe -> 200 text/html; charset=utf-8', 'GET -> this file'] },
        partial: true,
        expected: { htmlContent: { notContains: ['<h1>', '<h2>', '<p>　　      </p>'], contains: ['保留這段文字'] } },
    }],
    golden: { kind: 'material-parsed', baseUrl: BASE, url: 'https://example.com/page', responses: [{ file: null, status: 200, headers: HTML_CT }, { file: 'parse-material-ideographic-spaces.html', status: 200, headers: HTML_CT }] },
});
fixture({
    domain: D,
    name: 'parse-material-dotdot-asset',
    ext: 'html',
    input: '<div>\n    <img src="../img.png" alt="demo">\n</div>',
    source: `${UC}:80`,
    cls: CLS,
    cases: [{
        name: 'it resolves dot dot relative asset urls',
        input: { url: 'https://example.com/course/unit/page.html', host: 'example.com' },
        partial: true,
        expected: { firstImgSrc: { proxyOf: 'https://example.com/course/img.png' } },
    }],
    golden: parsed('parse-material-dotdot-asset.html', 'https://example.com/course/unit/page.html'),
});
fixture({
    domain: D,
    name: 'parse-material-same-host-img',
    ext: 'html',
    input: '<div><img src="https://example.com/710071.jpg" alt="封面圖片" width="900" height="600"></div>',
    source: `${UC}:107`,
    cls: CLS,
    cases: [{
        name: 'it preserves same-host src after purification in nativephp context',
        input: { url: 'https://example.com/page.html', host: 'example.com' },
        partial: true,
        expected: { htmlContent: { contains: [{ srcAttrProxyOf: 'https://example.com/710071.jpg' }] } },
    }],
    golden: parsed('parse-material-same-host-img.html', 'https://example.com/page.html'),
});

// ---- Feature/Course/MaterialViewerTest.php (action-level; session base uu.nou.edu.tw)
const MV = 'Feature/Course/MaterialViewerTest.php';
const UU = 'https://uu.nou.edu.tw';
fixture({
    domain: D,
    name: 'material-viewer-lesson-1',
    ext: 'html',
    input: '<html><body><h2>第一章內容</h2><img src="/images/cover.jpg" alt="cover"></body></html>',
    source: `${MV}:14`,
    cls: 'AltUU\\Domains\\Course\\Actions\\ParseMaterialContent',
    cases: [{
        name: 'parses html content and rewrites same-host resources into material proxy URLs',
        input: { url: 'https://uu.nou.edu.tw/material/lesson-1.html', host: 'uu.nou.edu.tw' },
        partial: true,
        expected: { videoUrl: null, subtitleUrl: null, downloadUrl: null, htmlContent: { contains: ['第一章內容', { proxyOf: 'https://uu.nou.edu.tw/images/cover.jpg' }] } },
    }],
    golden: { kind: 'material-parsed', baseUrl: UU, url: 'https://uu.nou.edu.tw/material/lesson-1.html', responses: [{ file: 'material-viewer-lesson-1.html', status: 200, headers: HTML_CT }] },
});
fixture({
    domain: D,
    name: 'material-viewer-lesson-2-flowplayer',
    ext: 'html',
    input: hd(MV, 47),
    source: `${MV}:40`,
    cls: 'AltUU\\Domains\\Course\\Actions\\ParseMaterialContent',
    cases: [{
        name: 'extracts video and subtitle URLs when flowplayer payload exists',
        input: { url: 'https://uu.nou.edu.tw/material/lesson-2.html', host: 'uu.nou.edu.tw' },
        partial: true,
        expected: { videoUrl: 'https://media.example.com/videos/lesson-2.mp4', downloadUrl: null, subtitleUrl: { proxyOf: 'https://uu.nou.edu.tw/subs/lesson-2.vtt' } },
    }],
    golden: { kind: 'material-parsed', baseUrl: UU, url: 'https://uu.nou.edu.tw/material/lesson-2.html', responses: [{ file: 'material-viewer-lesson-2-flowplayer.html', status: 200, headers: HTML_CT }] },
});

// ---- Extractors
const H5 = 'Unit/Html5SourceVideoExtractorTest.php';
const H5CLS = 'AltUU\\Domains\\Course\\Support\\VideoExtractors\\Html5SourceVideoExtractor';
fixture({ domain: D, name: 'extractor-html5-declarative-flowplayer', ext: 'html', input: hd(H5, 6), source: `${H5}:5`, cls: H5CLS,
    cases: [{ name: 'it extracts an m3u8 src from a declarative flowplayer video source', expected: { videoUrl: 'https://media.example.com/vod/_definst_/900001/01/01.mp4/playlist.m3u8', subtitleUrl: null } }],
    golden: { kind: 'extractor', extractor: 'html5', file: 'extractor-html5-declarative-flowplayer.html' } });
fixture({ domain: D, name: 'extractor-html5-track-subtitle', ext: 'html', input: hd(H5, 22), source: `${H5}:21`, cls: H5CLS,
    cases: [{ name: 'it picks up a track subtitle when present', expected: { videoUrl: 'https://example.com/playlist.m3u8', subtitleUrl: '01.vtt' } }],
    golden: { kind: 'extractor', extractor: 'html5', file: 'extractor-html5-track-subtitle.html' } });
fixture({ domain: D, name: 'extractor-no-video', ext: 'html', input: '<div id="wrapper"><h2>課程概覽</h2></div>', source: `${H5}:36 and Unit/FlowplayerJsConfigVideoExtractorTest.php:24`, cls: `${H5CLS} and FlowplayerJsConfigVideoExtractor`,
    cases: [{ name: 'both extractors return null when there is no video', expected: null }],
    golden: { kind: 'extractor', extractor: 'both', file: 'extractor-no-video.html' } });

const FP = 'Unit/FlowplayerJsConfigVideoExtractorTest.php';
const FPCLS = 'AltUU\\Domains\\Course\\Support\\VideoExtractors\\FlowplayerJsConfigVideoExtractor';
fixture({ domain: D, name: 'extractor-flowplayer-js-config', ext: 'html', input: hd(FP, 6), source: `${FP}:5`, cls: FPCLS,
    cases: [{ name: 'it extracts video and subtitle urls from a flowplayer js config', expected: { videoUrl: 'https://example.com/video/playlist.m3u8', subtitleUrl: '01.vtt' } }],
    golden: { kind: 'extractor', extractor: 'flowplayerJs', file: 'extractor-flowplayer-js-config.html' } });
fixture({ domain: D, name: 'extractor-flowplayer-js-relative-src', ext: 'html', input: hd(FP, 33), source: `${FP}:32`, cls: FPCLS,
    cases: [{ name: 'it returns null when flowplayer is called without an absolute src', expected: null }],
    golden: { kind: 'extractor', extractor: 'flowplayerJs', file: 'extractor-flowplayer-js-relative-src.html' } });

// ---- YouTube
const YT = 'Unit/YoutubeEmbedUrlParserTest.php';
const ytPos = {
    'embed redirector': 'https://uu.nou.edu.tw/learn/path/youtubeEmbed.php?v=dQw4w9WgXcQ',
    'short link': 'https://youtu.be/dQw4w9WgXcQ?si=xxxxxx',
    watch: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=10s',
    'mobile watch': 'https://m.youtube.com/watch?feature=share&v=dQw4w9WgXcQ',
    embed: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
    shorts: 'https://youtube.com/shorts/dQw4w9WgXcQ',
    live: 'https://www.youtube.com/live/dQw4w9WgXcQ?si=abc',
    'nocookie embed': 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ',
    'lms prefixed short link': 'https://uu.nou.edu.tw/base/100001/content/999999/https://youtu.be/dQw4w9WgXcQ?si=xxxxxx',
    'lms prefixed watch': 'https://uu.nou.edu.tw/base/100001/content/999999/https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    'lms prefixed with collapsed slashes': 'https://uu.nou.edu.tw/base/100001/content/999999/https:/youtu.be/dQw4w9WgXcQ',
};
const ytNeg = {
    'non-embed uu url': 'https://uu.nou.edu.tw/base/10001/content/101279/introduce.htm',
    'redirector without v': 'https://uu.nou.edu.tw/learn/path/youtubeEmbed.php',
    'redirector with invalid v': 'https://uu.nou.edu.tw/learn/path/youtubeEmbed.php?v=%3Cscript%3E',
    'channel page': 'https://www.youtube.com/@someone',
    'watch without id': 'https://www.youtube.com/watch',
    'lookalike host': 'https://youtube.com.evil.example/watch?v=dQw4w9WgXcQ',
    'lms prefixed non-youtube': 'https://uu.nou.edu.tw/base/100001/content/999999/https://example.com/watch?v=dQw4w9WgXcQ',
    'invalid id': 'https://youtu.be/%3Cscript%3E',
};
const ytInputs = [...Object.entries(ytPos).map(([n, u]) => ({ name: n, url: u, videoId: 'dQw4w9WgXcQ' })), ...Object.entries(ytNeg).map(([n, u]) => ({ name: n, url: u, videoId: null }))];
fixture({
    domain: D,
    name: 'youtube-embed-urls',
    ext: 'json',
    input: ytInputs.map(({ name, url }) => ({ name, url })),
    source: `${YT}:5-52`,
    cls: 'AltUU\\Domains\\Course\\Support\\YoutubeEmbedUrlParser::extractVideoId',
    cases: ytInputs.map((c) => ({ name: c.name, input: { url: c.url }, expected: c.videoId })),
    golden: { kind: 'youtube', file: 'youtube-embed-urls.json' },
});

// ---- CourseTypeMatcher
fixture({
    domain: D,
    name: 'course-type-matcher',
    ext: 'json',
    input: { course: { course_id: '1005', title: '(114下)行動學習導論-語音APP', course_type: '' }, courseTypesByTitleKey: { '114下|行動學習導論': { courseType: '語音', commonCourseId: '1005' } } },
    source: 'Unit/ListCoursesTest.php:50',
    cls: 'AltUU\\Domains\\Course\\Actions\\CourseTypeMatcher',
    cases: [{ name: 'resolves course type and commonCourseId using CourseTypeMatcher utility', partial: true, expected: { courseType: '語音', commonCourseId: '1005' } }],
    golden: { kind: 'course-type-matcher', file: 'course-type-matcher.json' },
});
