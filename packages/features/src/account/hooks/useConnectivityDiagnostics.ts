import type {
  ConnectivityCheckResultViewModel,
  ConnectivityService,
  ConnectivityServiceViewModel,
} from '@altuu/core';
import * as Network from 'expo-network';
import { useCallback, useEffect, useRef, useState } from 'react';

import { useServiceRuntime } from '../../services/AppServicesProvider';
import { useConnectivityStore } from '../../services/stores';

const NETWORK_POLL_INTERVAL_MS = 3000;

type BaseRow = ConnectivityServiceViewModel;

export type ConnectivityServiceRow =
  | (BaseRow & { status: 'pending' })
  | (BaseRow & { status: 'checking' })
  | (BaseRow & { status: 'done' } & ConnectivityCheckResultViewModel);

export interface DeviceNetworkStatus {
  connected: boolean;
  /** `wifi`, `cellular`, `ethernet`, ... (lower-cased expo-network type). */
  type: string;
}

export interface ConnectivityDiagnostics {
  rows: ConnectivityServiceRow[];
  referenceRows: ConnectivityServiceRow[];
  isChecking: boolean;
  isCheckingReference: boolean;
  error: string | null;
  referenceError: string | null;
  deviceNetwork: DeviceNetworkStatus | null;
  runCheck: () => Promise<void>;
  runReferenceCheck: () => Promise<void>;
}

async function readDeviceNetwork(): Promise<DeviceNetworkStatus> {
  try {
    const state = await Network.getNetworkStateAsync();

    return {
      connected: state.isConnected !== false,
      type: String(state.type ?? 'unknown').toLowerCase(),
    };
  } catch {
    return { connected: true, type: 'unknown' };
  }
}

/** Legacy useConnectivityDiagnostics: probes each service one by one. */
export function useConnectivityDiagnostics(): ConnectivityDiagnostics {
  const runtime = useServiceRuntime();
  const noteDiagnosticsRun = useConnectivityStore(
    (state) => state.noteDiagnosticsRun,
  );
  const [rows, setRows] = useState<ConnectivityServiceRow[]>([]);
  const [referenceRows, setReferenceRows] = useState<ConnectivityServiceRow[]>(
    [],
  );
  const [isChecking, setIsChecking] = useState(false);
  const [isCheckingReference, setIsCheckingReference] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [referenceError, setReferenceError] = useState<string | null>(null);
  const [deviceNetwork, setDeviceNetwork] =
    useState<DeviceNetworkStatus | null>(null);
  const mounted = useRef(true);
  const runId = useRef(0);

  const checkRows = useCallback(
    async (
      initial: ConnectivityServiceRow[],
      setList: (rows: ConnectivityServiceRow[]) => void,
    ): Promise<void> => {
      const list = [...initial];

      for (let index = 0; index < list.length; index += 1) {
        const row = list[index]!;
        list[index] = { ...row, status: 'checking' };
        setList([...list]);

        const result = await runtime.run('diagnostics.connectivity', () =>
          runtime.services.diagnostics.runConnectivityCheck(
            row.service as ConnectivityService,
          ),
        );

        if (!mounted.current) {
          return;
        }

        list[index] = { ...row, ...result, status: 'done' };
        setList([...list]);
      }
    },
    [runtime],
  );

  const runCheck = useCallback(async (): Promise<void> => {
    const id = ++runId.current;
    const isCurrent = () => mounted.current && runId.current === id;

    noteDiagnosticsRun();
    setError(null);

    let network = await readDeviceNetwork();

    // Offline: show the device state and wait for the network to return.
    while (!network.connected) {
      if (!isCurrent()) {
        return;
      }

      setDeviceNetwork(network);
      setRows([]);
      setReferenceRows([]);
      setIsChecking(false);
      await new Promise((resolve) =>
        setTimeout(resolve, NETWORK_POLL_INTERVAL_MS),
      );

      if (!isCurrent()) {
        return;
      }

      network = await readDeviceNetwork();
    }

    if (!isCurrent()) {
      return;
    }

    setDeviceNetwork(network);
    setIsChecking(true);

    try {
      const { services } = await runtime.run('diagnostics.connectivity', () =>
        runtime.services.diagnostics.listConnectivityServices(),
      );
      const pending = services.map((service): ConnectivityServiceRow => ({
        ...service,
        status: 'pending',
      }));
      const primary = pending.filter((row) => !row.isReference);

      setRows(primary);
      setReferenceRows(pending.filter((row) => row.isReference));

      await checkRows(primary, setRows);
    } catch (caught) {
      if (isCurrent()) {
        setError(
          caught instanceof Error ? caught.message : '檢查失敗，請稍後再試。',
        );
      }
    } finally {
      if (isCurrent()) {
        setIsChecking(false);
      }
    }
  }, [runtime, noteDiagnosticsRun, checkRows]);

  const runReferenceCheck = useCallback(async (): Promise<void> => {
    if (referenceRows.length === 0) {
      return;
    }

    setIsCheckingReference(true);
    setReferenceError(null);

    try {
      await checkRows(referenceRows, setReferenceRows);
    } catch (caught) {
      if (mounted.current) {
        setReferenceError(
          caught instanceof Error ? caught.message : '檢查失敗，請稍後再試。',
        );
      }
    } finally {
      if (mounted.current) {
        setIsCheckingReference(false);
      }
    }
  }, [checkRows, referenceRows]);

  useEffect(() => {
    mounted.current = true;

    return () => {
      mounted.current = false;
    };
  }, []);

  return {
    rows,
    referenceRows,
    isChecking,
    isCheckingReference,
    error,
    referenceError,
    deviceNetwork,
    runCheck,
    runReferenceCheck,
  };
}
