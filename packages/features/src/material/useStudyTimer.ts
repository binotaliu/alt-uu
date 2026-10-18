import { useCallback, useEffect, useRef, useState } from 'react';

import { useServiceRuntime } from '../services/AppServicesProvider';
import { StudyTimerSession } from './studyTimer';

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
   * re-validates the session once and retries, like legacy
   * `saveStudyTimeWithRetry`. A successful report ends the visit.
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

      if (!ok) {
        try {
          const bootstrap = await runtime.services.auth.bootstrapSession();

          ok = bootstrap.authenticated ? await record(payload) : false;
        } catch {
          ok = false;
        }
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
