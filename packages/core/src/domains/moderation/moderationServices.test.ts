import { beforeEach, describe, expect, it } from 'vitest';

import { blockedContents, blockedUsers } from '../../db/schema';
import { UserFacingHttpError } from '../../errors/errors';
import { createFakeFetch } from '../../http/testing';
import {
  loadExpected,
  loadFixtureJson,
  loadGolden,
} from '../../../test/fixtures';
import { createTestContext, type TestContext } from '../../../test/db/helpers';
import {
  createModerationServices,
  FINGERPRINT_KEY,
  SYNCED_AT_KEY,
} from './moderationServices';

const BOARD_HASH =
  '83440fa4f3936f8a407c811ebbcaaeded2b9d1599c9463df3849748d744bbdef';
const NODE_HASH =
  '35971be6e9bb024a895582fe0e42e04848a86da550aaef0fccbfba86f99f617d';
const BLOCKED_URL =
  'https://alt-uu.binota.org/api/moderation/blocked-contents*';

describe('moderation services', () => {
  let ctx: TestContext;

  beforeEach(async () => {
    ctx = await createTestContext();
  });

  const setup = (routes: Parameters<typeof createFakeFetch>[0]) => {
    const fake = createFakeFetch(routes);
    let counter = 0;
    const services = createModerationServices({
      db: ctx.db,
      keyValues: ctx.keyValues,
      clock: ctx.clock,
      fetch: fake.fetch,
      random: {
        getRandomBytes: (length) => new Uint8Array(length).fill((counter += 1)),
      },
    });

    return { services, requests: fake.requests };
  };

  const seedContent = (reason: string) =>
    ctx.db.insert(blockedContents).values({
      boardHash: BOARD_HASH,
      nodeHash: NODE_HASH,
      reason,
      blockedAt: new Date(),
    });

  it('syncs blocked contents from the remote API (golden request)', async () => {
    const { services, requests } = setup([
      [
        BLOCKED_URL,
        {
          body: loadFixtureJson('moderation', 'sync-blocked-contents'),
        },
      ],
    ]);
    const golden = loadGolden('moderation', 'sync-blocked-contents').cases[0];

    await services.syncBlockedContents();

    expect(
      requests.map(({ method, url }) => ({
        method,
        url,
        body: null,
      })),
    ).toEqual(golden.upstreamRequests);

    const rows = await ctx.db.select().from(blockedContents);

    expect(rows).toHaveLength(2);
    expect(rows.find((row) => row.nodeHash === NODE_HASH)).toMatchObject({
      boardHash: BOARD_HASH,
      reason: 'c',
    });
    expect(await ctx.keyValues.get(SYNCED_AT_KEY)).toBe(
      '2026-10-01T00:00:00+00:00',
    );
  });

  it('skips sync gracefully when the API returns an error', async () => {
    const { services } = setup([[BLOCKED_URL, { status: 500 }]]);

    await services.syncBlockedContents();

    expect(await ctx.db.select().from(blockedContents)).toHaveLength(0);
    expect(await ctx.keyValues.get(SYNCED_AT_KEY)).toBeNull();
  });

  it('sends the since parameter on subsequent syncs', async () => {
    await ctx.keyValues.set(SYNCED_AT_KEY, '2026-01-01T00:00:00+00:00');
    const { services, requests } = setup([[BLOCKED_URL, { body: [] }]]);

    await services.syncBlockedContents();

    expect(requests[0].url).toContain(
      'since=2026-01-01T00%3A00%3A00%2B00%3A00',
    );
    expect(await ctx.keyValues.get(SYNCED_AT_KEY)).toBe(
      '2026-10-01T00:00:00+00:00',
    );
  });

  it('upserts existing blocked content on re-sync', async () => {
    await seedContent('s');
    const edge = loadFixtureJson<Record<string, unknown>>(
      'moderation',
      'sync-edge-cases',
    );
    const { services } = setup([
      [BLOCKED_URL, { body: edge.upsert as object }],
    ]);

    await services.syncBlockedContents();

    const rows = await ctx.db.select().from(blockedContents);

    expect(rows).toHaveLength(1);
    expect(rows[0].reason).toBe('c');
  });

  it('deletes blocked content when the remote reason is null', async () => {
    await seedContent('s');
    const edge = loadFixtureJson<Record<string, unknown>>(
      'moderation',
      'sync-edge-cases',
    );
    const { services } = setup([
      [BLOCKED_URL, { body: edge.delete as object }],
    ]);

    await services.syncBlockedContents();

    expect(await ctx.db.select().from(blockedContents)).toHaveLength(0);
  });

  it('reports content with the legacy request body, apart from the client hash', async () => {
    const { services, requests } = setup([
      ['https://alt-uu.binota.org/api/moderation/reports', { body: {} }],
    ]);
    const golden = loadGolden('moderation', 'report-content').cases[0];
    const input = loadFixtureJson<{
      board_id: string;
      node_id: string;
      content: string;
      type: 's';
    }>('moderation', 'report-content');

    await expect(
      services.reportContent({
        boardId: input.board_id,
        nodeId: input.node_id,
        content: input.content,
        type: input.type,
      }),
    ).resolves.toBe(true);

    const sent = JSON.parse(requests[0].body!) as Record<string, string>;
    const expected = JSON.parse(
      golden.upstreamRequests![0].body as string,
    ) as Record<string, string>;

    expect(requests[0].method).toBe('POST');
    expect(requests[0].url).toBe(golden.upstreamRequests![0].url);
    expect(sent.client_hash).toMatch(/^[0-9a-f]{64}$/);
    expect({ ...sent, client_hash: '' }).toEqual({
      ...expected,
      client_hash: '',
    });
    expect(Object.keys(sent)).toEqual(Object.keys(expected));
  });

  it('uses a consistent client hash across reports', async () => {
    const { services, requests } = setup([['*', { body: {} }]]);

    await services.reportContent({
      boardId: 'b1',
      nodeId: 'n1',
      content: 'c1',
      type: 'o',
    });
    await services.reportContent({
      boardId: 'b2',
      nodeId: 'n2',
      content: 'c2',
      type: 'i',
    });

    const hashes = requests.map(
      (request) => JSON.parse(request.body!).client_hash as string,
    );

    expect(hashes[0]).toBe(hashes[1]);
    expect(await ctx.keyValues.get(FINGERPRINT_KEY)).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
  });

  it('validates report type and required fields', async () => {
    const { services, requests } = setup([['*', { body: {} }]]);

    for (const input of [
      { boardId: 'b', nodeId: 'n', content: 'test', type: 'x' },
      { boardId: '', nodeId: '', content: '', type: '' },
    ]) {
      const error = await services
        .reportContent(input as never)
        .catch((e: unknown) => e);

      expect(error).toBeInstanceOf(UserFacingHttpError);
      expect((error as UserFacingHttpError).status).toBe(422);
    }

    expect(requests).toHaveLength(0);
  });

  it('fails a report when the API answers with an error', async () => {
    const { services } = setup([['*', { status: 500 }]]);

    await expect(
      services.reportContent({
        boardId: 'b',
        nodeId: 'n',
        content: 'c',
        type: 's',
      }),
    ).rejects.toBeInstanceOf(UserFacingHttpError);
  });

  describe('blocked users', () => {
    const cases = loadExpected('moderation', 'block-users').cases;
    const user = loadFixtureJson<{ poster: string; realname: string }>(
      'moderation',
      'block-users',
    );

    it('blocks a user without duplicating', async () => {
      const { services } = setup([]);

      await services.blockUser(user.poster, user.realname);
      await services.blockUser(user.poster, user.realname);

      expect(await services.getBlockedUsers()).toEqual(
        (cases[0].expected as { blockedUsers: unknown[] }).blockedUsers,
      );
    });

    it('unblocks a user', async () => {
      await ctx.db.insert(blockedUsers).values(user);
      const { services } = setup([]);

      await services.unblockUser(user.poster, user.realname);

      expect(await services.getBlockedUsers()).toEqual([]);
    });

    it('lists blocked users in insertion order', async () => {
      await ctx.db.insert(blockedUsers).values([
        { poster: 'user1', realname: '張三' },
        { poster: 'user2', realname: '李四' },
      ]);
      const { services } = setup([]);

      expect(await services.getBlockedUsers()).toEqual([
        { poster: 'user1', realname: '張三' },
        { poster: 'user2', realname: '李四' },
      ]);
    });

    it('rejects empty poster or realname', async () => {
      const { services } = setup([]);

      await expect(services.blockUser('', 'x')).rejects.toBeInstanceOf(
        UserFacingHttpError,
      );
      await expect(services.unblockUser('x', ' ')).rejects.toBeInstanceOf(
        UserFacingHttpError,
      );
    });
  });
});
