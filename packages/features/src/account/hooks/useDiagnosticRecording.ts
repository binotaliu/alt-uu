import type { DiagnosticRecordingStatusViewModel } from '@altuu/core';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

import {
  useServiceMutation,
  useServiceQuery,
} from '../../services/useServiceQuery';

const RECORDING_KEY = ['diagnostics', 'recording'] as const;

export interface DiagnosticRecording {
  status: DiagnosticRecordingStatusViewModel | undefined;
  isRecording: boolean;
  /** Whole minutes left, so the UI can say how long it keeps going. */
  minutesRemaining: number;
  isBusy: boolean;
  error: string | null;
  setRecording: (enabled: boolean) => Promise<void>;
}

/**
 * Drives the opt-in recording window (legacy useDiagnosticRecording). The
 * window closes against the clock, so a 1 s ticker lets the UI notice the
 * expiry on its own.
 */
export function useDiagnosticRecording(): DiagnosticRecording {
  const queryClient = useQueryClient();
  const [now, setNow] = useState(() => Date.now());
  const [actionError, setActionError] = useState<string | null>(null);

  const statusQuery = useServiceQuery<DiagnosticRecordingStatusViewModel>({
    op: 'diagnostics.log',
    queryKey: RECORDING_KEY,
    queryFn: (services) => services.diagnostics.getRecordingStatus(),
    staleTime: 0,
  });
  const toggle = useServiceMutation<
    DiagnosticRecordingStatusViewModel,
    boolean
  >({
    op: 'diagnostics.log',
    mutationFn: (enabled, services) =>
      services.diagnostics.setRecording(enabled),
  });

  const status = statusQuery.data;
  const expiresAtMs =
    status?.recording === true && status.expiresAt
      ? new Date(status.expiresAt).getTime()
      : null;
  const isRecording = expiresAtMs !== null && expiresAtMs > now;
  const minutesRemaining = isRecording
    ? Math.max(1, Math.ceil((expiresAtMs - now) / 60_000))
    : 0;

  useEffect(() => {
    if (expiresAtMs === null) {
      return undefined;
    }

    const ticker = setInterval(() => {
      const current = Date.now();
      setNow(current);

      if (current >= expiresAtMs) {
        clearInterval(ticker);
      }
    }, 1000);

    return () => clearInterval(ticker);
  }, [expiresAtMs]);

  const setRecording = async (enabled: boolean): Promise<void> => {
    if (toggle.isPending) {
      return;
    }

    setActionError(null);

    try {
      const next = await toggle.mutateAsync(enabled);
      queryClient.setQueryData(RECORDING_KEY, next);
      setNow(Date.now());
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : '設定失敗，請稍後再試。',
      );
    }
  };

  return {
    status,
    isRecording,
    minutesRemaining,
    isBusy: toggle.isPending,
    error: actionError ?? (statusQuery.error ? '無法取得診斷記錄狀態。' : null),
    setRecording,
  };
}
