import type { StudyTimeInput } from '@altuu/core';

/** Shorter visits are not reported (legacy `seconds < 3`). */
export const MIN_STUDY_SECONDS = 3;
/** Upper bound accepted by the study-time service (legacy validation rule). */
export const MAX_STUDY_SECONDS = 28_800;

/** Legacy `formatSeconds`: the header clock (`mm:ss`, minutes may exceed 59). */
export function formatStudyClock(total: number): string {
  const minutes = Math.floor(total / 60)
    .toString()
    .padStart(2, '0');
  const seconds = Math.floor(total % 60)
    .toString()
    .padStart(2, '0');

  return `${minutes}:${seconds}`;
}

/** Legacy `formatSecondsLabel` (resume prompt): `1 時 02 分 03 秒`. */
export function formatDurationLabel(total: number): string {
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = Math.floor(total % 60);
  const pad = (value: number) => value.toString().padStart(2, '0');

  if (hours > 0) {
    return `${hours} 時 ${pad(minutes)} 分 ${pad(seconds)} 秒`;
  }

  if (minutes > 0) {
    return `${minutes} 分 ${pad(seconds)} 秒`;
  }

  return `${seconds} 秒`;
}

/**
 * The study-time bookkeeping of one material visit (legacy
 * `useStudyTimer`), without timers or I/O so it can be tested with a fake
 * clock. The hook in `useStudyTimer.ts` drives it.
 *
 * Intentional difference from legacy: `start()` forgets the playback
 * position / media duration of the previous material. Legacy kept them, so
 * a text material visited after a video was saved with the video's
 * position.
 */
export class StudyTimerSession {
  startedAt: string | null = null;
  lastKnownPlaybackPosition: number | null = null;
  lastKnownMediaDuration: number | null = null;
  private startTimeMs: number | null = null;

  constructor(private readonly now: () => number = Date.now) {}

  /**
   * Starts timing a material. Only materials with an `href` are timed;
   * `startedAtOverride` continues an earlier start time.
   */
  start(hasHref: boolean, startedAtOverride: string | null = null): void {
    this.lastKnownPlaybackPosition = null;
    this.lastKnownMediaDuration = null;

    const normalized = hasHref
      ? (startedAtOverride ?? new Date(this.now()).toISOString())
      : null;

    this.startedAt = normalized;
    this.startTimeMs = normalized === null ? null : Date.parse(normalized);

    if (this.startTimeMs !== null && Number.isNaN(this.startTimeMs)) {
      this.startedAt = new Date(this.now()).toISOString();
      this.startTimeMs = Date.parse(this.startedAt);
    }
  }

  /** Forgets the visit (after it was reported, or when leaving). */
  clear(): void {
    this.startedAt = null;
    this.startTimeMs = null;
  }

  get isTracking(): boolean {
    return this.startTimeMs !== null;
  }

  elapsedSeconds(): number {
    if (this.startTimeMs === null) {
      return 0;
    }

    return Math.max(0, Math.floor((this.now() - this.startTimeMs) / 1000));
  }

  updatePlaybackPosition(position: number): void {
    if (Number.isFinite(position) && position >= 0) {
      this.lastKnownPlaybackPosition = position;
    }
  }

  updateMediaDuration(duration: number): void {
    if (Number.isFinite(duration) && duration > 0) {
      this.lastKnownMediaDuration = duration;
    }
  }

  /**
   * The `studyTime.record` input for this visit, or null when there is
   * nothing to report (not tracking, or shorter than 3 seconds). A live
   * position / duration from the player wins over the last known one.
   *
   * Intentional difference from legacy: visits longer than 8 hours are
   * clamped instead of being rejected by validation.
   */
  buildPayload(
    cid: string,
    activityId: string,
    url: string,
    live: { positionSeconds?: number; mediaDurationSeconds?: number } = {},
  ): StudyTimeInput | null {
    if (this.startedAt === null) {
      return null;
    }

    const seconds = this.elapsedSeconds();

    if (seconds < MIN_STUDY_SECONDS) {
      return null;
    }

    if (live.positionSeconds !== undefined && live.positionSeconds > 0) {
      this.updatePlaybackPosition(live.positionSeconds);
    }

    if (live.mediaDurationSeconds !== undefined) {
      this.updateMediaDuration(live.mediaDurationSeconds);
    }

    const payload: StudyTimeInput = {
      cid,
      activityId,
      url,
      seconds: Math.min(MAX_STUDY_SECONDS, seconds),
      startedAt: this.startedAt,
    };

    if (this.lastKnownPlaybackPosition !== null) {
      payload.positionSeconds = this.lastKnownPlaybackPosition;
    }

    if (this.lastKnownMediaDuration !== null) {
      payload.mediaDurationSeconds = this.lastKnownMediaDuration;
    }

    return payload;
  }
}
