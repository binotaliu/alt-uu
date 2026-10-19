import { useCallback, useEffect, useRef, useState } from 'react';

import { useServiceRuntime } from '../services/AppServicesProvider';
import { useToastStore } from '../services/stores';
import { StudyTimerSession } from './studyTimer';

/** Retries after the first failed report, each preceded by a session check. */
export const STUDY_TIME_MAX_RETRIES = 3;
const STUDY_TIME_RETRY_DELAY_MS = 500;

export interface LivePlaybackReading {
  positionSeconds?: number;
  mediaDurationSeconds?: number;
}

export interface StudyTimerControls {
  /** Seconds shown in the header clock. */
  viewingSeconds: number;
  session: StudyTimerSession;
  startTracking: (hasHref: boolean, startedAtOverride?: string | null) => void;
  stopTimer: () => void;
  /**
   * Reports the visit of `activityId` (legacy `sendStudyTime`). Resolves
   * false when there was nothing to send or the call failed. A failure
   * re-validates the session and retries up to {@link STUDY_TIME_MAX_RETRIES}
   * times (legacy `saveStudyTimeWithRetry` retried once), then shows a toast.
   * A successful report ends the visit.
   */
  sendStudyTime: (activityId: string, url: string) => Promise<boolean>;
  updatePlaybackPosition: (position: number) => void;
  updateMediaDuration: (duration: number) => void;
}

/**
 * Port of legacy `useStudyTimer`: a 1-second header clock over a
 * {@link StudyTimerSession}, and the report to `services.studyTime.record`.
 * `readLive` returns the player's current position / duration.
 */
export function useStudyTimer(
  cid: string,
  readLive: () => LivePlaybackReading,
): StudyTimerControls {
  const runtime = useServiceRuntime();
  const [session] = useState(() => new StudyTimerSession());
  const [viewingSeconds, setViewingSeconds] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const readLiveRef = useRef(readLive);

  useEffect(() => {
    readLiveRef.current = readLive;
  }, [readLive]);

  const stopTimer = useCallback(() => {
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const startTracking = useCallback(
    (hasHref: boolean, startedAtOverride: string | null = null) => {
      stopTimer();
      session.start(hasHref, startedAtOverride);
      setViewingSeconds(session.elapsedSeconds());

      if (!hasHref) {
        return;
      }

      intervalRef.current = setInterval(() => {
        setViewingSeconds(session.elapsedSeconds());
      }, 1000);
    },
    [session, stopTimer],
  );

  useEffect(() => stopTimer, [stopTimer]);

  const record = useCallback(
    async (
      payload: NonNullable<ReturnType<StudyTimerSession['buildPayload']>>,
    ) => {
      try {
        await runtime.run('studyTime.record', () =>
          runtime.services.studyTime.record(payload),
        );

        return true;
      } catch {
        return false;
      }
    },
    [runtime],
  );

  const sendStudyTime = useCallback(
    async (activityId: string, url: string): Promise<boolean> => {
      let live: LivePlaybackReading = {};

      try {
        live = readLiveRef.current();
      } catch {
        // Best effort, like legacy.
      }

      const payload = session.buildPayload(cid, activityId, url, live);

      if (payload === null) {
        return false;
      }

      setViewingSeconds(payload.seconds ?? 0);
      let ok = await record(payload);

      for (let retry = 0; !ok && retry < STUDY_TIME_MAX_RETRIES; retry += 1) {
        await new Promise((resolve) =>
          setTimeout(resolve, STUDY_TIME_RETRY_DELAY_MS),
        );

        try {
          const bootstrap = await runtime.services.auth.bootstrapSession();

          ok = bootstrap.authenticated ? await record(payload) : false;
        } catch {
          ok = false;
        }
      }

      if (!ok) {
        useToastStore.getState().show('學習進度儲存失敗，請稍後再試');
      }

      if (ok) {
        session.clear();
      }

      return ok;
    },
    [cid, record, runtime, session],
  );

  const updatePlaybackPosition = useCallback(
    (position: number) => session.updatePlaybackPosition(position),
    [session],
  );
  const updateMediaDuration = useCallback(
    (duration: number) => session.updateMediaDuration(duration),
    [session],
  );

  return {
    viewingSeconds,
    session,
    startTracking,
    stopTimer,
    sendStudyTime,
    updatePlaybackPosition,
    updateMediaDuration,
  };
}
