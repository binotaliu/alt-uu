import { and, desc, eq, isNull } from 'drizzle-orm';
import type { AccountActiveProfile } from '../../accounts';
import { playbackProgress } from '../../db/schema';
import type { AltUUDatabase } from '../../db/types';

/** Shape of the legacy `GET /api/playback-progress/{cid}/{activityId}` payload. */
export interface PlaybackProgressItem {
    cid: string;
    activityId: string;
    studySeconds: number;
    positionSeconds: number;
    mediaDurationSeconds: number | null;
    hunguUploadSuccess: boolean | null;
    /** ISO-8601 with offset, like Carbon `toIso8601String()`. */
    updatedAt: string | null;
}

/** Shape of the legacy `GET /api/courses/{cid}/last-seen-material` payload. */
export interface LastSeenMaterial {
    activityId: string | null;
    positionSeconds: number | null;
    mediaDurationSeconds: number | null;
}

export interface PlaybackServicesDeps {
    db: AltUUDatabase;
    activeProfile: AccountActiveProfile;
}

/** Reads of the per-account playback_progress rows written by study-time. */
export function createPlaybackServices(deps: PlaybackServicesDeps) {
    async function accountFilter() {
        const accountId = await deps.activeProfile.get();

        return accountId === null
            ? isNull(playbackProgress.accountId)
            : eq(playbackProgress.accountId, accountId);
    }

    return {
        async getProgress(
            cid: string,
            activityId: string,
        ): Promise<{ progress: PlaybackProgressItem | null }> {
            const rows = await deps.db
                .select()
                .from(playbackProgress)
                .where(
                    and(
                        await accountFilter(),
                        eq(playbackProgress.cid, cid),
                        eq(playbackProgress.activityId, activityId),
                    ),
                )
                .limit(1);
            const row = rows[0];

            if (row === undefined) {
                return { progress: null };
            }

            return {
                progress: {
                    cid: row.cid,
                    activityId: row.activityId,
                    studySeconds: row.durationSeconds,
                    positionSeconds: row.positionSeconds,
                    mediaDurationSeconds: row.mediaDurationSeconds,
                    hunguUploadSuccess: row.hunguUploadSuccess,
                    updatedAt:
                        row.updatedAt === null || row.updatedAt === undefined
                            ? null
                            : `${row.updatedAt.toISOString().slice(0, 19)}+00:00`,
                },
            };
        },

        /** The most recently updated progress row of the course. */
        async getLastSeenMaterial(cid: string): Promise<LastSeenMaterial> {
            const rows = await deps.db
                .select()
                .from(playbackProgress)
                .where(
                    and(await accountFilter(), eq(playbackProgress.cid, cid)),
                )
                .orderBy(
                    desc(playbackProgress.updatedAt),
                    desc(playbackProgress.id),
                )
                .limit(1);
            const row = rows[0];

            return {
                activityId: row?.activityId ?? null,
                positionSeconds: row?.positionSeconds ?? null,
                mediaDurationSeconds: row?.mediaDurationSeconds ?? null,
            };
        },
    };
}

export type PlaybackServices = ReturnType<typeof createPlaybackServices>;
