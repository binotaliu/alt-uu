import { desc } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';
import { diagnosticEvents } from '../../db/schema';
import { createTestContext, type TestContext } from '../../../test/db/helpers';
import { defaultDiagnosticsConfig, type DiagnosticsConfig } from './config';
import { DiagnosticRecorder, KeyValueRecordingWindowStore } from './recorder';
import { DiagnosticRedactor, REDACTED } from './redactor';
import { DiagnosticSalt } from './salt';

let context: TestContext;

function makeRecorder(config: Partial<DiagnosticsConfig> = {}) {
    return new DiagnosticRecorder({
        db: context.db,
        clock: context.clock,
        redactor: new DiagnosticRedactor('test-salt'),
        config: { ...defaultDiagnosticsConfig, ...config },
        windowStore: new KeyValueRecordingWindowStore(context.keyValues),
    });
}

async function rows() {
    return context.db
        .select()
        .from(diagnosticEvents)
        .orderBy(desc(diagnosticEvents.id));
}

async function insertEvent(summary: string, occurredAt: Date) {
    await context.db.insert(diagnosticEvents).values({
        occurredAt,
        type: 'api.request',
        level: 'info',
        source: 'server',
        summary,
    });
}

beforeEach(async () => {
    context = await createTestContext();
});

describe('DiagnosticRecorder', () => {
    it('records an event while a window is open', async () => {
        const recorder = makeRecorder();
        await recorder.setRecording(true);

        await recorder.record({
            type: 'api.request',
            summary: 'GET /api/courses',
            op: 'courses.list',
            requestId: 'a3f91c02',
            status: 200,
            durationMs: 120,
        });

        const [event] = await rows();

        expect(event).toMatchObject({
            type: 'api.request',
            op: 'courses.list',
            requestId: 'a3f91c02',
            status: 200,
            durationMs: 120,
        });
    });

    it('redacts on write so the stored row never holds a secret', async () => {
        const recorder = makeRecorder();
        await recorder.setRecording(true);

        await recorder.record({
            type: 'upstream.call',
            summary: 'GET uu.nou.edu.tw',
            level: 'error',
            context: {
                ticket: 'SECRET-TICKET-123',
                profile: { username: 'u1001' },
            },
        });

        const [event] = await rows();
        const stored = JSON.stringify(event);

        expect(stored).not.toContain('SECRET-TICKET-123');
        expect(stored).not.toContain('u1001');
        expect(event.context?.ticket).toBe(REDACTED);
        expect(
            (event.context?.profile as { username: string }).username,
        ).toMatch(/^user#/);
    });

    it('keeps the log bounded to maxEvents, discarding the oldest first', async () => {
        const recorder = makeRecorder({ maxEvents: 5 });
        await recorder.setRecording(true);

        for (let i = 1; i <= 12; i += 1) {
            await recorder.record({
                type: 'api.request',
                summary: `request ${i}`,
            });
        }

        const stored = await rows();

        expect(stored).toHaveLength(5);
        expect(stored.at(-1)?.summary).toBe('request 8');
        expect(stored[0].summary).toBe('request 12');
    });

    it('writes nothing when the build ships without diagnostics', async () => {
        const recorder = makeRecorder({ enabled: false });

        await recorder.record({ type: 'api.request', summary: 'ignored' });

        expect(await rows()).toHaveLength(0);
        expect(await recorder.isEnabled()).toBe(false);
        expect(await recorder.setRecording(true)).toBeNull();
    });

    it('does not record until the user opens a recording window', async () => {
        const recorder = makeRecorder();

        await recorder.record({ type: 'api.request', summary: 'ignored' });

        expect(await rows()).toHaveLength(0);
    });

    it('stops recording once the window has elapsed', async () => {
        const recorder = makeRecorder();
        await recorder.setRecording(true);

        expect(await recorder.isEnabled()).toBe(true);

        context.clock.advanceSeconds(31 * 60);
        await recorder.record({
            type: 'api.request',
            summary: 'after the window',
        });

        expect(await recorder.isEnabled()).toBe(false);
        expect(await recorder.recordingExpiresAt()).toBeNull();
        expect(await rows()).toHaveLength(0);
    });

    it('survives a restart: a fresh recorder reads the stored window', async () => {
        await makeRecorder().setRecording(true);

        expect(await makeRecorder().isEnabled()).toBe(true);
    });

    it('can be switched off before the window elapses', async () => {
        const recorder = makeRecorder();
        await recorder.setRecording(true);
        await recorder.setRecording(false);

        await recorder.record({ type: 'api.request', summary: 'ignored' });

        expect(await rows()).toHaveLength(0);
        expect(await makeRecorder().recordingExpiresAt()).toBeNull();
    });

    it('discards rows past the retention age', async () => {
        const recorder = makeRecorder();
        const now = context.clock.now().getTime();
        await insertEvent('ancient', new Date(now - 20 * 86_400_000));
        await insertEvent('recent', new Date(now - 3 * 86_400_000));

        await recorder.pruneExpired();

        expect((await rows()).map((row) => row.summary)).toEqual(['recent']);
    });

    it('prunes aged rows when a new recording window opens', async () => {
        const recorder = makeRecorder();
        await insertEvent(
            'old',
            new Date(context.clock.now().getTime() - 30 * 86_400_000),
        );

        await recorder.setRecording(true);

        expect(await rows()).toHaveLength(0);
    });

    it('truncates an oversized body snippet after redacting it', () => {
        const recorder = makeRecorder({ bodySnippetBytes: 32 });

        const snippet = recorder.snippet(`ticket=SECRET123&${'x'.repeat(500)}`);

        expect(snippet).not.toContain('SECRET123');
        expect(snippet.endsWith('…（已截斷）')).toBe(true);
        expect(Array.from(snippet).length).toBeLessThan(60);
    });

    it('masks a query-string credential in a body snippet', () => {
        const snippet = makeRecorder().snippet(
            'redirect: https://uu.nou.edu.tw/login?token=s3cr3t&next=/learn',
        );

        expect(snippet).toContain('next=/learn');
        expect(snippet).not.toContain('s3cr3t');
    });

    it('never lets a recording failure break the caller', async () => {
        const recorder = makeRecorder();
        await recorder.setRecording(true);
        context.sqlite.exec('DROP TABLE diagnostic_events');

        await expect(
            recorder.record({
                type: 'api.request',
                summary: 'table is gone',
            }),
        ).resolves.toBeUndefined();
    });

    it('attributes events to the running operation', async () => {
        const recorder = makeRecorder();
        await recorder.setRecording(true);

        await recorder.operationContext.run(
            { op: 'courses.list', requestId: 'abcd1234' },
            () => recorder.record({ type: 'upstream.call', summary: 'GET x' }),
        );

        expect((await rows())[0]).toMatchObject({
            op: 'courses.list',
            requestId: 'abcd1234',
        });
    });
});

describe('DiagnosticSalt', () => {
    it('is generated once and persisted', async () => {
        const random = {
            getRandomBytes: (length: number) =>
                Uint8Array.from({ length }, (_, i) => i * 7),
        };
        const first = await new DiagnosticSalt(
            context.keyValues,
            random,
        ).value();
        const second = await new DiagnosticSalt(context.keyValues, {
            getRandomBytes: () => new Uint8Array(40),
        }).value();

        expect(first).toHaveLength(40);
        expect(second).toBe(first);
    });
});
