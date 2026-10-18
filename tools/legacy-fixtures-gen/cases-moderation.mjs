import crypto from 'node:crypto';
import { fixture } from './lib.mjs';

const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');
const M = 'Feature/ModerationTest.php';
const D = 'moderation';
const SYNC = 'https://alt-uu.binota.org/api/moderation/blocked-contents';
const REPORT = 'https://alt-uu.binota.org/api/moderation/reports';
const A = 'AltUU\\Domains\\Moderation\\Actions\\';

fixture({
    domain: D, name: 'sync-blocked-contents', ext: 'json',
    input: [{ b: sha('board-1'), n: sha('node-1'), r: 'c', t: 1775980234 }, { b: sha('board-1'), n: sha('node-2'), r: 's', t: 1775980300 }],
    source: `${M}:12`, cls: `${A}SyncBlockedContents`,
    note: `Remote GET ${SYNC}?since=... response. b=board_hash, n=node_hash, r=reason code (c|s|i|o) or null to delete, t=unix timestamp. sha256('board-1')=${sha('board-1')}.`,
    cases: [{ name: 'syncs blocked contents from remote API', expected: { blockedContentsCount: 2, 'row(node_hash=sha256("node-1"))': { board_hash: sha('board-1'), reason: 'c' }, keyValueStoreKeySet: 'moderation:blocked_contents_synced_at' } }],
    golden: { kind: 'endpoint', method: 'POST', path: '/api/moderation/sync', recordRequests: true, fakes: [{ match: 'alt-uu.binota.org/api/moderation/blocked-contents*', file: 'sync-blocked-contents.json' }] },
});
fixture({
    domain: D, name: 'sync-edge-cases', ext: 'json',
    input: { upsert: [{ b: sha('board-1'), n: sha('node-1'), r: 'c', t: 1775980234 }], delete: [{ b: sha('board-1'), n: sha('node-1'), r: null, t: 1775980234 }], emptyWithSince: [] },
    source: `${M}:43-117`, cls: `${A}SyncBlockedContents`,
    note: 'Remote response bodies for the edge-case sync tests (keys: upsert, delete, emptyWithSince).',
    cases: [
        { name: 'skips sync gracefully when API returns error', input: { upstream: 'HTTP 500, null body' }, expected: { httpOk: true, blockedContentsCount: 0 } },
        { name: 'sends since parameter on subsequent syncs', input: { localKeyValue: { 'moderation:blocked_contents_synced_at': '2026-01-01T00:00:00+00:00' }, upstream: 'emptyWithSince' }, expected: { requestUrlContains: 'since=' } },
        { name: 'upserts existing blocked content on re-sync', input: { existingRow: { board: 'board-1', node: 'node-1', reason: 's' }, upstream: 'upsert' }, expected: { blockedContentsCount: 1, 'firstRow.reason': 'c' } },
        { name: 'deletes blocked content when remote reason is null', input: { existingRow: { board: 'board-1', node: 'node-1', reason: 's' }, upstream: 'delete' }, expected: { blockedContentsCount: 0 } },
    ],
});
fixture({
    domain: D, name: 'report-content', ext: 'json',
    input: { board_id: 'board-1', node_id: 'node-1', content: 'offensive content', type: 's' },
    source: `${M}:123`, cls: `${A}ReportContent`,
    note: `Request body of POST /api/moderation/report. Upstream POST ${REPORT} must carry board_hash=sha256(board_id), node_hash=sha256(node_id), content_hash=sha256(content), type, non-empty client_hash and site_hash. Golden records the exact upstream body the PHP produced (client_hash/site_hash depend on the PHP test environment).`,
    cases: [
        { name: 'reports content to remote API', input: { body: { board_id: 'board-1', node_id: 'node-1', content: 'offensive content', type: 's' } }, partial: true, expected: { upstreamUrl: REPORT, upstreamBody: { board_hash: sha('board-1'), node_hash: sha('node-1'), content_hash: sha('offensive content'), type: 's', client_hash: { nonEmpty: true }, site_hash: { nonEmpty: true } } } },
        { name: 'validates report type is valid', input: { body: { board_id: 'board-1', node_id: 'node-1', content: 'test', type: 'x' } }, expected: { httpStatus: 422 } },
        { name: 'validates required report fields', input: { body: {} }, expected: { httpStatus: 422 } },
        { name: 'generates consistent client hash', input: { bodies: [{ board_id: 'b1', node_id: 'n1', content: 'c1', type: 'o' }, { board_id: 'b2', node_id: 'n2', content: 'c2', type: 'i' }] }, expected: { recordedRequests: 2, sameClientHash: true } },
    ],
    golden: { kind: 'endpoint', method: 'POST', path: '/api/moderation/report', json: { board_id: 'board-1', node_id: 'node-1', content: 'offensive content', type: 's' }, recordRequests: true, fakes: [{ match: 'alt-uu.binota.org/api/moderation/reports', json: { ok: true } }] },
});
fixture({
    domain: D, name: 'block-users', ext: 'json',
    input: { poster: 'user123', realname: '王小明' },
    source: `${M}:188-242`, cls: `${A}BlockUser, UnblockUser, GetBlockedUsers`,
    note: 'Body for POST/DELETE /api/moderation/block-user. GET /api/moderation/blocked-users returns [{poster, realname}, ...].',
    cases: [
        { name: 'blocks a user', input: { method: 'POST' }, expected: { blockedUsers: [{ poster: 'user123', realname: '王小明' }] } },
        { name: 'does not duplicate blocked user', input: { method: 'POST', existing: [{ poster: 'user123', realname: '王小明' }] }, expected: { blockedUsersCount: 1 } },
        { name: 'unblocks a user', input: { method: 'DELETE', existing: [{ poster: 'user123', realname: '王小明' }] }, expected: { blockedUsersCount: 0 } },
        { name: 'lists blocked users', input: { existing: [{ poster: 'user1', realname: '張三' }, { poster: 'user2', realname: '李四' }] }, partial: true, expected: { count: 2, posters: ['user1', 'user2'] } },
        { name: 'returns empty when no users blocked', input: { existing: [] }, expected: [] },
    ],
});
