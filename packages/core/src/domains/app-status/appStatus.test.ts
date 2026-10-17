import { describe, expect, it } from 'vitest';
import { loadFixtureJson, loadGolden } from '../../../test/fixtures';
import { createFakeFetch } from '../../http/testing';
import type { FakeReply } from '../../http/testing';
import { createHarness, setClockTo } from '../account/testing';
import { ValidationError } from '../account/validation';
import { createAppStatusServices, versionCompare } from './index';

const STATUS_URL = 'https://statics.test/status.json';

interface Scenario {
    name: string;
    feed: object | null;
    feedHttpStatus?: number;
    context: {
        appVersion: string;
        platform: 'ios' | 'android';
        now: string | null;
        dismissals: string[];
        cacheFlushedBeforeFeed?: boolean;
    };
}

async function setup(
    options: { appVersion?: string; platform?: 'ios' | 'android' } = {},
    replies: FakeReply[] | FakeReply = { body: {} },
) {
    const harness = await createHarness();
    const fake = createFakeFetch([[STATUS_URL, replies]]);
    const status = createAppStatusServices({
        fetch: fake.fetch,
        cache: harness.cache,
        keyValues: harness.keyValues,
        clock: harness.clock,
        platform: options.platform ?? 'ios',
        appVersion: options.appVersion ?? '1.0.0',
        staticsBaseUrl: 'https://statics.test',
    });

    return { harness, fake, status };
}

// Parity with the real PHP output of GetAppStatus / DismissAppStatusItem.
describe('app status scenarios (golden)', () => {
    const scenarios = loadFixtureJson<Scenario[]>(
        'app-status',
        'status-feed-scenarios',
    );
    const golden = loadGolden('app-status', 'status-feed-scenarios');

    for (const scenario of scenarios) {
        it(scenario.name, async () => {
            const { harness, status } = await setup(
                {
                    appVersion: scenario.context.appVersion,
                    platform: scenario.context.platform,
                },
                scenario.feed === null
                    ? { status: scenario.feedHttpStatus ?? 500, body: 'boom' }
                    : { body: scenario.feed },
            );

            if (scenario.context.now !== null) {
                setClockTo(harness.clock, new Date(scenario.context.now));
            }

            for (const key of scenario.context.dismissals) {
                await status.dismiss(key);
            }

            const expected = golden.cases.find(
                (candidate) => candidate.name === scenario.name,
            );
            expect(expected, `no golden for ${scenario.name}`).toBeDefined();
            expect(await status.get()).toEqual(
                (expected?.output as { json: unknown }).json,
            );
        });
    }
});

describe('app status behaviours', () => {
    it('keeps a dismissal until the next release', async () => {
        const { harness, fake } = await setup();
        const feed = (version: string) => ({
            latest: { ios: version },
            minSupported: { ios: '1.0.0' },
            storeUrl: { ios: 'https://apps.apple.com/app/alt-uu' },
            announcements: [],
        });
        const first = createAppStatusServices({
            fetch: createFakeFetch([[STATUS_URL, { body: feed('1.2.0') }]])
                .fetch,
            cache: harness.cache,
            keyValues: harness.keyValues,
            clock: harness.clock,
            platform: 'ios',
            appVersion: '1.0.0',
            staticsBaseUrl: 'https://statics.test',
        });

        expect((await first.dismiss('update:1.2.0')).update).toBeNull();
        expect((await first.get()).update).toBeNull();

        await harness.cache.flush();
        const next = createAppStatusServices({
            fetch: createFakeFetch([[STATUS_URL, { body: feed('1.3.0') }]])
                .fetch,
            cache: harness.cache,
            keyValues: harness.keyValues,
            clock: harness.clock,
            platform: 'ios',
            appVersion: '1.0.0',
            staticsBaseUrl: 'https://statics.test',
        });

        expect((await next.get()).update?.latestVersion).toBe('1.3.0');
        expect(fake.requests).toHaveLength(0);
    });

    it.each(['', 'whatever', 'update:', 'a'.repeat(200)])(
        'rejects dismissal key %j',
        async (key) => {
            const { status } = await setup();

            await expect(status.dismiss(key)).rejects.toBeInstanceOf(
                ValidationError,
            );
        },
    );

    it('serves the feed from cache instead of refetching', async () => {
        const { fake, status } = await setup(
            {},
            { body: { latest: { ios: '1.0.0' } } },
        );

        await status.get();
        await status.get();

        expect(fake.requests).toHaveLength(1);
    });

    it('falls back to the last good feed and backs off while the feed is down', async () => {
        const { harness, fake, status } = await setup({}, [
            {
                body: {
                    announcements: [
                        { id: 'video-stall', title: '部分影片無法播放' },
                    ],
                },
            },
            { status: 503, body: 'down' },
        ]);

        expect((await status.get()).announcements).toHaveLength(1);

        await harness.cache.forget('app-status:feed');
        expect((await status.get()).announcements).toHaveLength(1);
        expect((await status.get()).announcements).toHaveLength(1);

        expect(fake.requests).toHaveLength(2);
    });

    it('treats a connection failure like an unreachable feed', async () => {
        const harness = await createHarness();
        const fake = createFakeFetch([[STATUS_URL, new Error('offline')]]);
        const status = createAppStatusServices({
            fetch: fake.fetch,
            cache: harness.cache,
            keyValues: harness.keyValues,
            clock: harness.clock,
            platform: 'ios',
            appVersion: '1.0.0',
            staticsBaseUrl: 'https://statics.test',
        });

        expect(await status.get()).toEqual({ update: null, announcements: [] });
        expect(await harness.cache.has('app-status:feed-failure-backoff')).toBe(
            true,
        );
    });

    it('limits announcement text by display width like Str::limit', async () => {
        const long = '長'.repeat(100);
        const { status } = await setup(
            {},
            {
                body: {
                    announcements: [
                        { id: 'x', title: long, body: 'b'.repeat(600) },
                    ],
                },
            },
        );

        const [announcement] = (await status.get()).announcements;

        expect(announcement.title).toBe(`${'長'.repeat(60)}...`);
        expect(announcement.body).toBe(`${'b'.repeat(500)}...`);
    });
});

describe('versionCompare (PHP version_compare)', () => {
    it.each([
        ['1.0.0', '1.0.0', 0],
        ['1.2.0', '1.10.0', -1],
        ['1.0', '1.0.0', -1],
        ['1.1.0', '1.0.9', 1],
        ['1.0.0-beta', '1.0.0', -1],
        ['1.0.0RC1', '1.0.0beta2', 1],
        ['1.0.0pl1', '1.0.0', 1],
        ['2.0', '1.9.9', 1],
    ])('%s vs %s', (left, right, expected) => {
        expect(versionCompare(left, right)).toBe(expected);
    });
});
