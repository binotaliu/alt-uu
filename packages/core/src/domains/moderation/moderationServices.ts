import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex, utf8ToBytes } from '@noble/hashes/utils.js';
import { and, eq } from 'drizzle-orm';
import { blockedContents, blockedUsers } from '../../db/schema';
import type { AltUUDatabase } from '../../db/types';
import type { KeyValueStoreRepository } from '../../db/keyValueStore';
import { UserFacingHttpError } from '../../errors/errors';
import {
    decodeJson,
    httpBuildQuery,
    isRecord,
    phpJsonEncode,
} from '../../http/encoding';
import { HttpTransport, type UpstreamCallListener } from '../../http/transport';
import type { Clock, Fetch } from '../../platform';
import type { RandomBytes } from '../../platform/random';
import {
    REPORT_TYPES,
    type BlockedUserViewModel,
    type ReportContentInput,
} from './types';

/** Legacy constant shared by every Alt UU install of the HUNGU site. */
export const MODERATION_SITE_HASH =
    '1b04f287644330e02cab8e616c5a657a24e0a759081235d2739612924eb73680';
export const MODERATION_BASE_URL = 'https://alt-uu.binota.org/api/moderation';
export const SYNCED_AT_KEY = 'moderation:blocked_contents_synced_at';
export const FINGERPRINT_KEY = 'moderation:client_fingerprint';

export interface ModerationServicesDeps {
    db: AltUUDatabase;
    keyValues: KeyValueStoreRepository;
    clock: Clock;
    fetch: Fetch;
    /** For the client fingerprint UUID. */
    random: RandomBytes;
    /** Default {@link MODERATION_BASE_URL}. */
    baseUrl?: string;
    siteHash?: string;
    onUpstreamCall?: UpstreamCallListener;
}

const sha256Hex = (value: string): string =>
    bytesToHex(sha256(utf8ToBytes(value)));

function uuidV4(random: RandomBytes): string {
    const bytes = random.getRandomBytes(16);

    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;

    const hex = bytesToHex(bytes);

    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** Laravel `Date::toIso8601String()` in UTC. */
function toIso8601(date: Date): string {
    return `${date.toISOString().slice(0, 19)}+00:00`;
}

/** TrimStrings + required rule: a non-empty trimmed string or a 422. */
function requiredString(value: unknown, field: string): string {
    const trimmed = typeof value === 'string' ? value.trim() : '';

    if (trimmed === '') {
        throw new UserFacingHttpError(422, `The ${field} field is required.`);
    }

    return trimmed;
}

/**
 * Moderation: ports of SyncBlockedContents, ReportContent, BlockUser,
 * UnblockUser and GetBlockedUsers plus the controllers' validation. The
 * client hash is sha256 of a random UUID kept in the key-value store, so no
 * secret is involved (the legacy code never used APP_KEY here).
 */
export function createModerationServices(deps: ModerationServicesDeps) {
    const { db, keyValues, clock } = deps;
    const baseUrl = deps.baseUrl ?? MODERATION_BASE_URL;
    const siteHash = deps.siteHash ?? MODERATION_SITE_HASH;
    const transport = new HttpTransport({
        fetch: deps.fetch,
        service: 'moderation',
        onUpstreamCall: deps.onUpstreamCall,
    });

    async function clientHash(): Promise<string> {
        let fingerprint = await keyValues.get(FINGERPRINT_KEY);

        if (fingerprint === null) {
            fingerprint = uuidV4(deps.random);
            await keyValues.set(FINGERPRINT_KEY, fingerprint);
        }

        return sha256Hex(fingerprint);
    }

    return {
        /**
         * Pulls blocked contents changed since the last sync. A non-2xx answer
         * leaves everything untouched; connection failures still throw, as the
         * legacy action only caught RequestException.
         */
        async syncBlockedContents(): Promise<void> {
            const lastSyncedAt = await keyValues.get(SYNCED_AT_KEY);
            const query: Record<string, string> = { site_hash: siteHash };

            if (lastSyncedAt !== null) {
                query.since = lastSyncedAt;
            }

            const response = await transport.send({
                method: 'GET',
                url: `${baseUrl}/blocked-contents?${httpBuildQuery(query)}`,
                headers: { Accept: 'application/json' },
            });

            if (response.status < 200 || response.status >= 300) {
                return;
            }

            const items = decodeJson(response.body);

            if (!isRecord(items)) {
                return;
            }

            for (const item of Object.values(items)) {
                if (
                    !isRecord(item) ||
                    item.b == null ||
                    item.n == null ||
                    item.t == null ||
                    !('r' in item)
                ) {
                    continue;
                }

                const boardHash = String(item.b);
                const nodeHash = String(item.n);

                if (item.r === null) {
                    await db
                        .delete(blockedContents)
                        .where(
                            and(
                                eq(blockedContents.boardHash, boardHash),
                                eq(blockedContents.nodeHash, nodeHash),
                            ),
                        );

                    continue;
                }

                const now = clock.now();
                const reason = String(item.r);
                const blockedAt = new Date(Number(item.t) * 1000);

                await db
                    .insert(blockedContents)
                    .values({
                        boardHash,
                        nodeHash,
                        reason,
                        blockedAt,
                        createdAt: now,
                        updatedAt: now,
                    })
                    .onConflictDoUpdate({
                        target: [
                            blockedContents.boardHash,
                            blockedContents.nodeHash,
                        ],
                        set: { reason, blockedAt, updatedAt: now },
                    });
            }

            await keyValues.set(SYNCED_AT_KEY, toIso8601(clock.now()));
        },

        /** Resolves true on success; a non-2xx answer throws (legacy `->throw()`). */
        async reportContent(input: ReportContentInput): Promise<boolean> {
            const boardId = requiredString(input.boardId, 'board id');
            const nodeId = requiredString(input.nodeId, 'node id');
            const content = requiredString(input.content, 'content');
            const type = requiredString(input.type, 'type');

            if (!(REPORT_TYPES as readonly string[]).includes(type)) {
                throw new UserFacingHttpError(
                    422,
                    'The selected type is invalid.',
                );
            }

            const response = await transport.send({
                method: 'POST',
                url: `${baseUrl}/reports`,
                headers: {
                    Accept: 'application/json',
                    'Content-Type': 'application/json',
                },
                body: phpJsonEncode({
                    client_hash: await clientHash(),
                    site_hash: siteHash,
                    board_hash: sha256Hex(boardId),
                    node_hash: sha256Hex(nodeId),
                    content_hash: sha256Hex(content),
                    type,
                    content,
                }),
            });

            if (response.status < 200 || response.status >= 300) {
                throw new UserFacingHttpError(
                    502,
                    '檢舉送出失敗，請稍後再試。',
                );
            }

            return true;
        },

        async blockUser(poster: string, realname: string): Promise<void> {
            const now = clock.now();

            await db
                .insert(blockedUsers)
                .values({
                    poster: requiredString(poster, 'poster'),
                    realname: requiredString(realname, 'realname'),
                    createdAt: now,
                    updatedAt: now,
                })
                .onConflictDoNothing();
        },

        async unblockUser(poster: string, realname: string): Promise<void> {
            await db
                .delete(blockedUsers)
                .where(
                    and(
                        eq(
                            blockedUsers.poster,
                            requiredString(poster, 'poster'),
                        ),
                        eq(
                            blockedUsers.realname,
                            requiredString(realname, 'realname'),
                        ),
                    ),
                );
        },

        async getBlockedUsers(): Promise<BlockedUserViewModel[]> {
            const rows = await db
                .select({
                    poster: blockedUsers.poster,
                    realname: blockedUsers.realname,
                })
                .from(blockedUsers)
                .orderBy(blockedUsers.id);

            return rows;
        },
    };
}

export type ModerationServices = ReturnType<typeof createModerationServices>;
