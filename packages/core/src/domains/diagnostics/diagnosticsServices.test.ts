import { beforeEach, describe, expect, it } from 'vitest';
import { createTestContext, type TestContext } from '../../../test/db/helpers';
import { ExternalServiceUnavailableError } from '../../errors/errors';
import { HttpTransport } from '../../http/transport';
import { createFakeFetch } from '../../http/testing';
import type { DeviceInfo } from '../../platform';
import {
    createDiagnosticsServices,
    type DiagnosticsServices,
} from './createDiagnosticsServices';
import { JsLogBuffer } from './logBuffer';
import type { ParsedMaterialSummary } from './materialSource';

const deviceInfo: DeviceInfo = {
    platform: 'ios',
    osVersion: '19.0',
    appVersion: '2.0.0',
    buildNumber: '42',
    deviceModel: 'iPhone17,1',
};

const random = {
    getRandomBytes: (length: number) =>
        Uint8Array.from({ length }, (_, index) => (index * 37 + 11) % 256),
};

let context: TestContext;

async function makeServices(
    overrides: Partial<Parameters<typeof createDiagnosticsServices>[0]> = {},
): Promise<DiagnosticsServices> {
    return createDiagnosticsServices({
        db: context.db,
        keyValues: context.keyValues,
        clock: context.clock,
        random,
        fetch: createFakeFetch([['*', { status: 200, body: 'ok' }]]).fetch,
        deviceInfo: () => deviceInfo,
        ...overrides,
    });
}

async function enabledServices(
    overrides: Partial<Parameters<typeof createDiagnosticsServices>[0]> = {},
) {
    const services = await makeServices(overrides);
    await services.setRecording(true);

    return services;
}

beforeEach(async () => {
    context = await createTestContext();
});

describe('upstream call recording', () => {
    async function callThroughTransport(
        services: DiagnosticsServices,
        url: string,
        reply: Parameters<typeof createFakeFetch>[0][number][1],
        expectsJson = true,
    ) {
        const transport = new HttpTransport({
            fetch: createFakeFetch([['*', reply]]).fetch,
            service: 'hungu',
            onUpstreamCall: services.upstreamListener,
        });

        await transport
            .send({ method: 'GET', url, expectsJson })
            .catch(() => undefined);
        // The listener records asynchronously.
        await new Promise((resolve) => setTimeout(resolve, 20));

        return services.listEvents();
    }

    it('records a successful call as an informational event', async () => {
        const services = await enabledServices();

        const { events } = await callThroughTransport(
            services,
            'https://uu.nou.edu.tw/xmlapi/index.php?action=getCourseList',
            { body: { data: { list: [] } } },
        );

        expect(events).toHaveLength(1);
        expect(events[0]).toMatchObject({
            type: 'upstream.call',
            level: 'info',
            status: 200,
        });
        expect(events[0].context.host).toBe('uu.nou.edu.tw');
        expect(events[0].context).not.toHaveProperty('bodySnippet');
    });

    it('records an upstream 500 as an error carrying a body snippet', async () => {
        const services = await enabledServices();

        const { events } = await callThroughTransport(
            services,
            'https://uu.nou.edu.tw/xmlapi/index.php?action=getCourseList',
            {
                status: 500,
                body: '<html><body>Internal Server Error</body></html>',
            },
        );

        expect(events[0]).toMatchObject({ level: 'error', status: 500 });
        expect(events[0].context.reason).toBe('upstream_status');
        expect(events[0].context.bodySnippet).toContain(
            'Internal Server Error',
        );
    });

    it('flags a 200 whose body will not decode as a parse anomaly', async () => {
        const services = await enabledServices();

        const { events } = await callThroughTransport(
            services,
            'https://uu.nou.edu.tw/xmlapi/index.php?action=getCourseList',
            { body: '<html>login page</html>' },
        );

        expect(events[0]).toMatchObject({
            type: 'parse.anomaly',
            level: 'warning',
            status: 200,
        });
        expect(events[0].context.reason).toBe('undecodable_json');
        expect(events[0].context.bodySnippet).toContain('login page');
    });

    it('does not flag HTML as an anomaly when the caller expects raw content', async () => {
        const services = await enabledServices();

        const { events } = await callThroughTransport(
            services,
            'https://uu.nou.edu.tw/learn/my_forum.php',
            { body: '<html>my forum</html>' },
            false,
        );

        expect(events[0]).toMatchObject({
            type: 'upstream.call',
            level: 'info',
        });
    });

    it('records a connection failure with the underlying reason', async () => {
        const services = await enabledServices();

        const { events } = await callThroughTransport(
            services,
            'https://uu.nou.edu.tw/xmlapi/index.php',
            new Error('cURL error 28: Connection timed out'),
        );

        expect(events[0]).toMatchObject({ level: 'error', status: null });
        expect(events[0].summary).toContain('uu.nou.edu.tw/xmlapi/index.php');
        expect(events[0].context.reason).toBe('connection_failed');
        expect(events[0].context.detail).toContain('Connection timed out');
    });

    it('strips the ticket from the recorded url and measures the duration', async () => {
        const services = await enabledServices();

        const { events } = await callThroughTransport(
            services,
            'https://uu.nou.edu.tw/xmlapi/index.php?action=getCourseList&ticket=SECRET123&ua=Mozilla',
            { body: [] },
        );

        expect(events[0].summary).not.toContain('SECRET123');
        expect(events[0].summary).toContain('action=getCourseList');
        expect(
            events[0].summary.startsWith(
                'GET https://uu.nou.edu.tw/xmlapi/index.php',
            ),
        ).toBe(true);
        expect(events[0].durationMs).toBeGreaterThanOrEqual(0);
    });

    it('records nothing while the recording window is closed', async () => {
        const services = await makeServices();

        const { events } = await callThroughTransport(
            services,
            'https://uu.nou.edu.tw/x',
            { body: {} },
        );

        expect(events).toHaveLength(0);
    });

    it('does not record connectivity probes, whose failures are the result itself', async () => {
        const probeFetch = createFakeFetch([['*', { status: 500, body: '' }]]);
        const services = await enabledServices({ fetch: probeFetch.fetch });

        await services.recordingSwitch.withoutRecording(async () => {
            const transport = new HttpTransport({
                fetch: probeFetch.fetch,
                service: 'hungu',
                onUpstreamCall: services.upstreamListener,
            });
            await transport.send({
                method: 'GET',
                url: 'https://uu.nou.edu.tw',
            });
        });
        await services.runConnectivityCheck('hungu');
        await new Promise((resolve) => setTimeout(resolve, 20));

        expect((await services.listEvents()).total).toBe(0);
    });
});

describe('operations', () => {
    it('records a UI operation as an api.request event', async () => {
        const services = await enabledServices();

        await services.recordOperation({
            op: 'courses.list',
            requestId: 'a3f91c02',
            status: 200,
            durationMs: 120,
        });
        await services.recordOperation({
            op: 'courses.show',
            status: 503,
            summary: 'show failed for u1001',
        });

        const { events } = await services.listEvents();

        expect(events[1]).toMatchObject({
            type: 'api.request',
            op: 'courses.list',
            requestId: 'a3f91c02',
            level: 'info',
            summary: 'courses.list',
        });
        expect(events[0].level).toBe('error');
        expect(events[0].summary).not.toContain('u1001');
        expect(events[0].requestId).toMatch(/^[0-9a-f]{8}$/);
    });

    it('does not record the diagnostics operations themselves', async () => {
        const services = await enabledServices();

        await services.recordOperation({ op: 'diagnostics.clear' });
        await services.recordOperation({ op: 'not a valid op!' });

        expect((await services.listEvents()).total).toBe(0);
    });

    it('tracks an operation, attributing upstream calls and failures', async () => {
        const services = await enabledServices();
        const transport = new HttpTransport({
            fetch: createFakeFetch([['*', { body: {} }]]).fetch,
            service: 'hungu',
            onUpstreamCall: services.upstreamListener,
        });

        await services.trackOperation(
            'courses.list',
            async () => {
                await transport.send({ method: 'GET', url: 'https://a.test/' });
                await new Promise((resolve) => setTimeout(resolve, 10));
            },
            { requestId: 'req-0001' },
        );
        await expect(
            services.trackOperation('courses.show', () => {
                throw new ExternalServiceUnavailableError();
            }),
        ).rejects.toBeInstanceOf(ExternalServiceUnavailableError);

        const { events } = await services.listEvents();
        const upstream = events.find((event) => event.type === 'upstream.call');
        const failure = events.find((event) => event.op === 'courses.show');

        expect(upstream).toMatchObject({
            op: 'courses.list',
            requestId: 'req-0001',
        });
        expect(failure?.level).toBe('error');
        expect(failure?.context.errorName).toBe(
            'ExternalServiceUnavailableError',
        );
    });
});

describe('recording status and the log', () => {
    it('reports recording as off until the user turns it on', async () => {
        const services = await makeServices();

        expect(await services.getRecordingStatus()).toEqual({
            available: true,
            recording: false,
            expiresAt: null,
            windowMinutes: 30,
            retentionDays: 14,
        });
    });

    it('opens a bounded window when switched on and closes it again', async () => {
        const services = await makeServices();

        const on = await services.setRecording(true);
        const expiresAt = new Date(on.expiresAt as string).getTime();
        const now = context.clock.now().getTime();

        expect(on.recording).toBe(true);
        expect(expiresAt).toBeGreaterThan(now);
        expect(expiresAt).toBeLessThanOrEqual(now + 30 * 60_000);

        expect(await services.setRecording(false)).toMatchObject({
            recording: false,
            expiresAt: null,
        });
    });

    it('rejects a missing enabled flag', async () => {
        const services = await makeServices();

        await expect(
            services.setRecording(undefined as unknown as boolean),
        ).rejects.toMatchObject({ status: 422 });
    });

    it('lists newest first, filters problems and still reads with recording off', async () => {
        const services = await enabledServices();
        await services.recorder.record({
            type: 'api.request',
            summary: 'fine',
        });
        await services.recorder.record({
            type: 'upstream.call',
            summary: 'broken',
            level: 'error',
        });
        await services.setRecording(false);

        const all = await services.listEvents();
        const problems = await services.listEvents({ problemsOnly: true });

        expect(all.events.map((event) => event.summary)).toEqual([
            'broken',
            'fine',
        ]);
        expect(all.total).toBe(2);
        expect(all.recordingEnabled).toBe(false);
        expect(problems.events.map((event) => event.summary)).toEqual([
            'broken',
        ]);
    });

    it('drops aged rows when the log is read, even with recording off', async () => {
        const services = await makeServices();
        const { diagnosticEvents } = await import('../../db/schema');
        const now = context.clock.now().getTime();

        await context.db.insert(diagnosticEvents).values([
            {
                occurredAt: new Date(now - 20 * 86_400_000),
                type: 'api.request',
                summary: 'old',
            },
            {
                occurredAt: new Date(now - 2 * 86_400_000),
                type: 'api.request',
                summary: 'new',
            },
        ]);

        expect((await services.listEvents()).total).toBe(1);
    });

    it('clears the log, and forgetLog also closes the window', async () => {
        const services = await enabledServices();
        await services.recorder.record({ type: 'api.request', summary: 'x' });

        await services.clearEvents();
        expect((await services.listEvents()).total).toBe(0);

        await services.recorder.record({ type: 'api.request', summary: 'y' });
        await services.forgetLog(true);

        expect((await services.listEvents()).total).toBe(0);
        expect((await services.getRecordingStatus()).recording).toBe(false);
    });

    it('keeps the window open when forgetLog is not asked to stop recording', async () => {
        const services = await enabledServices();

        await services.forgetLog();

        expect((await services.getRecordingStatus()).recording).toBe(true);
    });
});

describe('client events', () => {
    const clientEvent = {
        occurredAt: '2026-09-21T10:00:00+08:00',
        type: 'client.error',
        level: 'error',
        summary: 'TypeError: cannot read property of undefined',
        op: 'courses.list',
        requestId: 'a3f91c02',
        status: null,
        durationMs: null,
        context: { stack: 'at CourseListTab.tsx:95' },
    };

    it('merges the UI ring buffer into the same log', async () => {
        const services = await enabledServices();

        expect(await services.storeClientEvents([clientEvent])).toBe(1);

        const [event] = (await services.listEvents()).events;

        expect(event).toMatchObject({
            source: 'client',
            type: 'client.error',
            requestId: 'a3f91c02',
            occurredAt: '2026-09-21T02:00:00.000Z',
        });
        expect(event.summary).toContain('TypeError');
    });

    it('rejects an event type it does not recognise', async () => {
        const services = await enabledServices();

        await expect(
            services.storeClientEvents([{ ...clientEvent, type: 'exception' }]),
        ).rejects.toMatchObject({ status: 422 });
    });

    it('bounds the batch size', async () => {
        const services = await enabledServices();

        await expect(
            services.storeClientEvents(Array(301).fill(clientEvent)),
        ).rejects.toMatchObject({ status: 422 });
    });

    it('redacts client-submitted events too', async () => {
        const services = await enabledServices();

        await services.storeClientEvents([
            {
                ...clientEvent,
                summary: 'failed for u1001',
                context: { password: 'hunter2' },
            },
        ]);

        const [event] = (await services.listEvents()).events;

        expect(event.summary).not.toContain('u1001');
        expect(JSON.stringify(event.context)).not.toContain('hunter2');
    });
});

describe('diagnostic bundle', () => {
    it('renders markdown with device info, events and the JS log tail', async () => {
        const logBuffer = new JsLogBuffer();
        logBuffer.log('error', 'render crashed for u1001');
        const services = await enabledServices({ logBuffer });
        await services.recorder.record({
            type: 'upstream.call',
            summary: 'GET uu.nou.edu.tw/xmlapi',
            level: 'error',
            status: 500,
        });

        const bundle = await services.buildBundle();

        expect(bundle.filename).toMatch(
            /^alt-uu-diagnostics-\d{4}-\d{2}-\d{2}-\d{6}\.md$/,
        );
        expect(bundle.content).toContain('# Alt UU 診斷記錄');
        expect(bundle.content).toContain('| App 版本 | 2.0.0 (42) |');
        expect(bundle.content).toContain('| 平台 | iOS |');
        expect(bundle.content).toContain('事件記錄');
        expect(bundle.content).toContain('GET uu.nou.edu.tw/xmlapi');
        expect(bundle.content).toContain('→ 500');
        expect(bundle.content).toContain('render crashed');
        expect(bundle.content).not.toContain('u1001');
    });

    it('never puts a secret in the bundle, even from a row that bypassed the recorder', async () => {
        const services = await enabledServices();
        const { diagnosticEvents } = await import('../../db/schema');

        await context.db.insert(diagnosticEvents).values({
            occurredAt: context.clock.now(),
            type: 'api.request',
            summary: 'GET /api/courses',
            context: { ticket: 'SECRET-TICKET', username: 'u1001' },
        });

        const { content } = await services.buildBundle();

        expect(content).not.toContain('SECRET-TICKET');
        expect(content).not.toContain('u1001');
    });

    it('says so when there is nothing to show', async () => {
        const services = await makeServices({
            deviceInfo: () => {
                throw new Error('no device');
            },
        });

        const { content } = await services.buildBundle();

        expect(content).toContain('目前沒有任何記錄');
        expect(content).toContain('| 平台 | unknown |');
    });
});

describe('connectivity', () => {
    it('lists the services without making any http calls', async () => {
        const fake = createFakeFetch([]);
        const services = await makeServices({ fetch: fake.fetch });

        const { services: list } = services.listConnectivityServices();

        expect(list).toHaveLength(7);
        expect(list[0]).toMatchObject({ service: 'hungu', isReference: false });
        expect(list[4]).toMatchObject({ service: 'google', isReference: true });
        expect(fake.requests).toHaveLength(0);
    });

    it.each([
        ['reachable on 200', { status: 200, body: 'ok' }, true, 200],
        ['reachable on a 4xx', { status: 403, body: 'forbidden' }, true, 403],
        ['unreachable on a 5xx', { status: 500, body: 'error' }, false, 500],
    ])('%s', async (_name, reply, reachable, statusCode) => {
        const services = await makeServices({
            fetch: createFakeFetch([['*', reply]]).fetch,
        });

        expect(await services.runConnectivityCheck('hungu')).toMatchObject({
            service: 'hungu',
            label: '數位學習平台 (UU平台)',
            checkKind: 'reachability',
            reachable,
            statusCode,
            error: null,
        });
    });

    it('checks the configured url of a reference service', async () => {
        const fake = createFakeFetch([['*', { body: 'ok' }]]);
        const services = await makeServices({ fetch: fake.fetch });

        expect(await services.runConnectivityCheck('google')).toMatchObject({
            service: 'google',
            reachable: true,
        });
        expect(fake.requests[0].url).toBe(
            'https://www.google.com/generate_204',
        );
    });

    it('marks a service unreachable on connection failure', async () => {
        const services = await makeServices({
            fetch: createFakeFetch([['*', new Error('timed out')]]).fetch,
        });

        expect(await services.runConnectivityCheck('hungu')).toMatchObject({
            reachable: false,
            statusCode: null,
            error: 'timed out',
        });
    });

    it('returns 404 for an unknown service', async () => {
        const services = await makeServices();

        expect(() => services.runConnectivityCheck('not-a-service')).toThrow(
            expect.objectContaining({ status: 404 }),
        );
    });
});

describe('material source tool', () => {
    const payload = {
        code: 0,
        message: 'success',
        data: {
            path: {
                item: [
                    {
                        identifier: 'A1',
                        text: '第一章',
                        href: 'about:blank',
                        item: [
                            {
                                identifier: 'A2',
                                text: '1-1 課程簡介',
                                href: 'https://uu.nou.edu.tw/material/lesson-1.html?ticket=abc123&x=1',
                                leaf: true,
                            },
                            {
                                identifier: 'A3',
                                text: '1-2 外部連結',
                                href: 'https://example.com/elsewhere.html',
                                leaf: true,
                            },
                        ],
                    },
                    {
                        identifier: 'B1',
                        text: '講義',
                        href: 'https://uu.nou.edu.tw/material/handout.pdf',
                        leaf: true,
                    },
                ],
            },
        },
    };

    type Page = {
        status: number;
        body: string;
        headers: Record<string, string>;
    };

    async function inspectorServices(options: {
        pages?: Record<string, Page | Error>;
        parse?: (url: string) => Promise<ParsedMaterialSummary>;
        enabled?: boolean;
        config?: Parameters<typeof createDiagnosticsServices>[0]['config'];
    }) {
        const synced: string[] = [];
        const services = await createDiagnosticsServices({
            db: context.db,
            keyValues: context.keyValues,
            clock: context.clock,
            random,
            fetch: createFakeFetch([]).fetch,
            deviceInfo: () => deviceInfo,
            config: options.config,
            materialSourceViewerEnabled: options.enabled ?? true,
            materialSource: () => ({
                courseClient: {
                    fetchCoursePathInfo: async () => ({ payload }),
                    fetchMaterialContent: async (url) => {
                        const page = options.pages?.[url.split('?')[0]];

                        if (page === undefined || page instanceof Error) {
                            throw (
                                page ?? new Error(`unexpected fetch of ${url}`)
                            );
                        }

                        return {
                            status: page.status,
                            body: page.body,
                            headers: {
                                'content-type': page.headers['content-type'],
                            },
                        };
                    },
                },
                parseMaterialContent: async (url) =>
                    options.parse?.(url) ?? { htmlContent: '<p>x</p>' },
                syncCurrentCourse: async (cid) => {
                    synced.push(cid);
                },
                resolveBaseHost: async () => 'uu.nou.edu.tw',
            }),
        });

        return { services, synced };
    }

    it('lists every directory node with the url the school sent', async () => {
        const { services, synced } = await inspectorServices({});

        const result = await services.inspectMaterialDirectory('9001');

        expect(synced).toEqual(['9001']);
        expect(result).toMatchObject({ nodeCount: 4, apiCode: 0 });
        expect(result.nodes[0]).toMatchObject({
            identifier: 'A1',
            level: 0,
            // Reported as-is, not normalised away, and not inspectable.
            href: 'about:blank',
            isInspectable: false,
        });
        expect(result.nodes[1]).toMatchObject({
            level: 1,
            isInspectable: true,
        });
    });

    it('keeps credentials out of the directory urls and the raw json', async () => {
        const { services } = await inspectorServices({});

        const result = await services.inspectMaterialDirectory('9001');

        expect(result.nodes[1].href).toContain('lesson-1.html');
        expect(result.nodes[1].href).not.toContain('abc123');
        expect(result.rawJson).toContain('lesson-1.html');
        expect(result.rawJson).not.toContain('abc123');
        expect(result.rawJsonTruncated).toBe(false);
    });

    it('truncates an oversized directory payload', async () => {
        const { services } = await inspectorServices({
            config: { materialSourceBytes: 50 },
        });

        const result = await services.inspectMaterialDirectory('9001');

        expect(result.rawJsonTruncated).toBe(true);
        expect(
            new TextEncoder().encode(result.rawJson).length,
        ).toBeLessThanOrEqual(50);
    });

    it('returns the raw source and a parse outcome for a node', async () => {
        const { services } = await inspectorServices({
            pages: {
                'https://uu.nou.edu.tw/material/lesson-1.html': {
                    status: 200,
                    headers: { 'content-type': 'text/html; charset=utf-8' },
                    body: '<html><head><meta name="viewport" content="width=device-width"></head><body><h2>第一章內容</h2><a href="/next?ticket=abc123">next</a></body></html>',
                },
            },
        });

        const result = await services.inspectMaterialSource('9001', 'A2');

        expect(result).toMatchObject({
            fetchStatus: 200,
            isText: true,
            fetchError: null,
            parse: { succeeded: true, kind: 'html' },
        });
        expect(result.body).toContain('<meta name="viewport"');
        expect(result.body).toContain('第一章內容');
        expect(result.body).not.toContain('abc123');
        expect(result.url).not.toContain('abc123');
    });

    it('reports an empty page as an empty parse rather than an error', async () => {
        const { services } = await inspectorServices({
            pages: {
                'https://uu.nou.edu.tw/material/lesson-1.html': {
                    status: 200,
                    headers: { 'content-type': 'text/html' },
                    body: '<html><body><div> </div></body></html>',
                },
            },
            parse: async () => ({ htmlContent: '' }),
        });

        const result = await services.inspectMaterialSource('9001', 'A2');

        expect(result.parse).toMatchObject({
            succeeded: true,
            kind: 'empty',
            htmlLength: 0,
        });
        expect(result.body).toContain('<div>');
    });

    it('surfaces the failure when the school page cannot be fetched', async () => {
        const failure = new ExternalServiceUnavailableError({
            cause: new Error('cURL error 28: timed out'),
        });
        const { services } = await inspectorServices({
            pages: { 'https://uu.nou.edu.tw/material/lesson-1.html': failure },
            parse: async () => {
                throw failure;
            },
        });

        const result = await services.inspectMaterialSource('9001', 'A2');

        expect(result).toMatchObject({ fetchStatus: null, body: null });
        expect(result.parse).toMatchObject({ succeeded: false, kind: 'error' });
        expect(result.fetchError).toContain('ExternalServiceUnavailableError');
        expect(result.fetchError).toContain('timed out');
        expect(result.parse.errorClass).toContain(
            'ExternalServiceUnavailableError',
        );
        expect(result.parse.errorLocation).toContain(':');
    });

    it('does not dump the bytes of a binary file', async () => {
        const { services } = await inspectorServices({
            pages: {
                'https://uu.nou.edu.tw/material/handout.pdf': {
                    status: 200,
                    headers: { 'content-type': 'application/pdf' },
                    body: '%PDF-1.4 binary',
                },
            },
            parse: async () => ({
                htmlContent: '',
                downloadUrl: 'https://uu.nou.edu.tw/material/handout.pdf',
                downloadFileName: 'handout.pdf',
            }),
        });

        const result = await services.inspectMaterialSource('9001', 'B1');

        expect(result).toMatchObject({
            isText: false,
            body: null,
            bodyBytes: '%PDF-1.4 binary'.length,
            parse: { kind: 'download', downloadFileName: 'handout.pdf' },
        });
    });

    it('truncates an oversized source on a character boundary', async () => {
        const { services } = await inspectorServices({
            config: { materialSourceBytes: 40 },
            pages: {
                'https://uu.nou.edu.tw/material/lesson-1.html': {
                    status: 200,
                    headers: { 'content-type': 'text/html' },
                    body: `<html><body>${'內容'.repeat(100)}</body></html>`,
                },
            },
        });

        const result = await services.inspectMaterialSource('9001', 'A2');

        expect(result.bodyTruncated).toBe(true);
        expect(
            new TextEncoder().encode(result.body as string).length,
        ).toBeLessThanOrEqual(40);
        expect(result.body).not.toContain('�');
    });

    it.each([
        ['external host', 'A3', 403],
        ['placeholder link', 'A1', 422],
        ['unknown node', 'ZZ9', 404],
    ])('refuses a node: %s', async (_name, scoid, status) => {
        const { services } = await inspectorServices({});

        await expect(
            services.inspectMaterialSource('9001', scoid),
        ).rejects.toMatchObject({ status });
    });

    it('hides the tool unless the viewer is enabled', async () => {
        const { services } = await inspectorServices({ enabled: false });

        await expect(
            services.inspectMaterialDirectory('9001'),
        ).rejects.toMatchObject({ status: 404 });
        await expect(
            services.inspectMaterialSource('9001', 'A2'),
        ).rejects.toMatchObject({ status: 404 });
    });
});
