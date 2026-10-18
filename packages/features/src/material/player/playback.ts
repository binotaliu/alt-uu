/** Rate menu options (legacy native player). */
export const PLAYBACK_RATES = [0.5, 1, 1.25, 1.5, 2] as const;

/** Legacy rate label: `1x`, `1.25x`, `0.5x`. */
export function formatPlaybackRate(rate: number): string {
  return `${Number(rate.toFixed(2))}x`;
}

/** Legacy audio player clock: `m:ss`, `0:00` for unknown values. */
export function formatPlayerTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return '0:00';
  }

  const total = Math.floor(seconds);

  return `${Math.floor(total / 60)}:${(total % 60).toString().padStart(2, '0')}`;
}

/** Skip step of the audio controls. */
export const SKIP_SECONDS = 10;

/** Clamps a seek target into the media. */
export function clampSeek(target: number, duration: number): number {
  const upper = Number.isFinite(duration) && duration > 0 ? duration : target;

  return Math.max(0, Math.min(upper, target));
}
