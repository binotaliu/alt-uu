import type { KeyValueStoreRepository } from '../../db/keyValueStore';
import type { AltUUDatabase } from '../../db/types';
import { UserFacingHttpError } from '../../errors/errors';
import type { UpstreamCallListener } from '../../http/transport';
import type { Clock, DeviceInfo, Fetch, RandomBytes } from '../../platform';
import {
    defaultConnectivityUrls,
    defaultDiagnosticsConfig,
    type ConnectivityUrls,
    type DiagnosticsConfig,
} from './config';
import { ConnectivityChecker } from './connectivity';
import { buildDiagnosticBundle } from './diagnosticBundle';
import type { JsLogBuffer } from './logBuffer';
import {
    MaterialSourceInspector,
    type MaterialSourceInspectorDeps,
} from './materialSource';
import {
    DiagnosticRecorder,
    KeyValueRecordingWindowStore,
    type RecordingWindowStore,
} from './recorder';
import { DiagnosticRedactor } from './redactor';
import { UpstreamRecordingSwitch } from './recordingSwitch';
import { DiagnosticSalt } from './salt';
import { createUpstreamCallRecorder } from './upstreamCallRecorder';
import {
    DIAGNOSTIC_EVENT_TYPES,
    DIAGNOSTIC_LEVELS,
    type ClientDiagnosticEventInput,
    type DiagnosticBundleViewModel,
    type DiagnosticEventListViewModel,
    type DiagnosticEventType,
    type DiagnosticLevel,
    type DiagnosticRecordingStatusViewModel,
} from './types';

/** Material source tool wiring; everything the course domain provides. */
export type MaterialSourceDeps = Omit<
    MaterialSourceInspectorDeps,
    'recorder' | 'config' | 'materialSourceViewerEnabled'
>;

export interface DiagnosticsServicesDeps {
    db: AltUUDatabase;
    keyValues: KeyValueStoreRepository;
    clock: Clock;
    random: RandomBytes;
    /** Plain platform fetch for the connectivity probes. */
    fetch: Fetch;
    deviceInfo: () => DeviceInfo | Promise<DeviceInfo>;
    config?: Partial<DiagnosticsConfig>;
    urls?: Partial<ConnectivityUrls>;
    /** Defaults to a key-value-store window with the legacy key. */
    windowStore?: RecordingWindowStore;
    logBuffer?: JsLogBuffer;
    /** Build flag for the material source viewer. Default false. */
    materialSourceViewerEnabled?: boolean;
    /** Lazy so the HTTP stack (which needs `upstreamListener`) can exist first. */
    materialSource?: () => MaterialSourceDeps;
    nowMs?: () => number;
}

export interface RecordOperationInput {
    /** Operation key, e.g. `courses.list` (`/^[a-z0-9._-]{1,64}$/i`). */
    op: string;
    /** Correlation id; generated when missing or malformed. */
    requestId?: string | null;
    summary?: string;
    status?: number | null;
    durationMs?: number | null;
    /** A failure raised by the operation. */
    error?: unknown;
    context?: Record<string, unknown>;
}

const MAX_CLIENT_EVENTS = 300;
const DEFAULT_LIST_LIMIT = 200;
const CLIENT_EVENT_TYPES = ['client.error', 'client.nav', 'api.request'];

/**
 * Wires the diagnostics domain. Async because the per-install redaction salt
 * is read (or created) first.
 */
export async function createDiagnosticsServices(deps: DiagnosticsServicesDeps) {
    const config = { ...defaultDiagnosticsConfig, ...deps.config };
    const urls = { ...defaultConnectivityUrls, ...deps.urls };
    const nowMs = deps.nowMs ?? Date.now;
    const salt = await new DiagnosticSalt(deps.keyValues, deps.random).value();
    const recordingSwitch = new UpstreamRecordingSwitch();
    const recorder = new DiagnosticRecorder({
        db: deps.db,
        clock: deps.clock,
        redactor: new DiagnosticRedactor(salt),
        config,
        windowStore:
            deps.windowStore ??
            new KeyValueRecordingWindowStore(deps.keyValues),
    });
    const connectivity = new ConnectivityChecker({
        fetch: deps.fetch,
        urls,
        clock: deps.clock,
        recordingSwitch,
        nowMs,
    });
    let inspector: MaterialSourceInspector | null = null;

    const materialInspector = (): MaterialSourceInspector => {
        if (deps.materialSource === undefined) {
            throw new UserFacingHttpError(404, '找不到此功能');
        }

        inspector ??= new MaterialSourceInspector({
            ...deps.materialSource(),
            recorder,
            config,
            materialSourceViewerEnabled:
                deps.materialSourceViewerEnabled ?? false,
        });

        return inspector;
    };

    const recordOperation = async (
        input: RecordOperationInput,
    ): Promise<void> => {
        const op = /^[a-z0-9._-]{1,64}$/i.test(input.op) ? input.op : null;

        // Reading, exporting or clearing the log must not write to it.
        if (op === null || op.startsWith('diagnostics.')) {
            return;
        }

        const errorName =
            input.error instanceof Error ? input.error.name : undefined;
        const status = input.status ?? null;
        const level: DiagnosticLevel =
            input.error !== undefined || (status !== null && status >= 500)
                ? 'error'
                : status !== null && status >= 400
                  ? 'warning'
                  : 'info';

        await recorder.record({
            type: 'api.request',
            summary: input.summary ?? op,
            level,
            op,
            requestId: resolveRequestId(input.requestId, deps.random),
            status,
            durationMs: input.durationMs ?? null,
            context: {
                ...input.context,
                ...(input.error === undefined
                    ? {}
                    : {
                          errorName,
                          errorMessage:
                              input.error instanceof Error
                                  ? input.error.message
                                  : String(input.error),
                      }),
            },
        });
    };

    const getRecordingStatus =
        async (): Promise<DiagnosticRecordingStatusViewModel> => {
            const expiresAt = await recorder.recordingExpiresAt();

            return {
                available: recorder.isAvailable(),
                recording: expiresAt !== null,
                expiresAt: expiresAt?.toISOString() ?? null,
                windowMinutes: config.recordingWindowMinutes,
                retentionDays: config.retentionDays,
            };
        };

    return {
        recorder,
        redactor: recorder.redactor(),
        recordingSwitch,
        /** Hand this to HttpTransport's `onUpstreamCall` for every service. */
        upstreamListener: createUpstreamCallRecorder({
            recorder,
            recordingSwitch,
        }) satisfies UpstreamCallListener,

        /** Legacy RecordDiagnostics middleware, for UI-initiated operations. */
        recordOperation,

        /**
         * Runs `work` as operation `op`: upstream calls made meanwhile are
         * attributed to it, and its outcome and duration are recorded.
         */
        async trackOperation<T>(
            op: string,
            work: () => Promise<T> | T,
            options: { requestId?: string | null; summary?: string } = {},
        ): Promise<T> {
            const requestId = resolveRequestId(options.requestId, deps.random);
            const startedAt = nowMs();
            const elapsed = (): number => Math.round(nowMs() - startedAt);

            try {
                const result = await recorder.operationContext.run(
                    { op, requestId },
                    work,
                );
                await recordOperation({
                    op,
                    requestId,
                    summary: options.summary,
                    durationMs: elapsed(),
                });

                return result;
            } catch (error) {
                await recordOperation({
                    op,
                    requestId,
                    summary: options.summary,
                    durationMs: elapsed(),
                    error,
                });

                throw error;
            }
        },

        /** Legacy ListDiagnosticEvents. */
        async listEvents(
            options: { problemsOnly?: boolean; limit?: number } = {},
        ): Promise<DiagnosticEventListViewModel> {
            await recorder.pruneExpired();

            const limit = Math.max(
                1,
                Math.min(
                    options.limit ?? DEFAULT_LIST_LIMIT,
                    DEFAULT_LIST_LIMIT,
                ),
            );

            return {
                events: await recorder.list({
                    problemsOnly: options.problemsOnly ?? false,
                    limit,
                }),
                total: await recorder.count(),
                recordingEnabled:
                    (await recorder.recordingExpiresAt()) !== null,
            };
        },

        /** Legacy GetDiagnosticRecordingStatus. */
        getRecordingStatus,

        /** Legacy SetDiagnosticRecording; returns the new status. */
        async setRecording(
            enabled: boolean,
        ): Promise<DiagnosticRecordingStatusViewModel> {
            if (typeof enabled !== 'boolean') {
                throw new UserFacingHttpError(422, '請提供 enabled 參數');
            }

            await recorder.setRecording(enabled);

            return getRecordingStatus();
        },

        /** Legacy ClearDiagnosticEvents. */
        clearEvents: (): Promise<void> => recorder.clear(),

        /**
         * Legacy ForgetDiagnosticLog: call on logout / account removal.
         * Closing the window matters more than clearing the rows.
         */
        async forgetLog(stopRecording = false): Promise<void> {
            if (stopRecording) {
                await recorder.setRecording(false);
            }

            await recorder.clear();
        },

        /** Legacy StoreClientDiagnosticEvents; returns the stored count. */
        async storeClientEvents(
            events: ClientDiagnosticEventInput[],
        ): Promise<number> {
            validateClientEvents(events);

            for (const event of events) {
                await recorder.record({
                    type: toEventType(event.type),
                    summary: event.summary,
                    level: toLevel(event.level),
                    context: event.context ?? {},
                    op: event.op ?? null,
                    requestId: event.requestId ?? null,
                    status: event.status ?? null,
                    durationMs: event.durationMs ?? null,
                    source: 'client',
                    occurredAt: parseTimestamp(event.occurredAt),
                });
            }

            return events.length;
        },

        /** Legacy BuildDiagnosticBundle. */
        buildBundle: (): Promise<DiagnosticBundleViewModel> =>
            buildDiagnosticBundle({
                recorder,
                clock: deps.clock,
                deviceInfo: deps.deviceInfo,
                logBuffer: deps.logBuffer,
            }),

        listConnectivityServices: () => connectivity.listServices(),
        runConnectivityCheck: (service: string) => connectivity.check(service),

        /** Gated by `materialSourceViewerEnabled`; 404 when off. */
        inspectMaterialDirectory: (cid: string) =>
            materialInspector().inspectDirectory(cid),
        inspectMaterialSource: (cid: string, scoid: string) =>
            materialInspector().inspectSource(cid, scoid),
    };
}

export type DiagnosticsServices = Awaited<
    ReturnType<typeof createDiagnosticsServices>
>;

function resolveRequestId(
    supplied: string | null | undefined,
    random: RandomBytes,
): string {
    // Only well-formed ids are accepted, so a crafted value cannot inject
    // arbitrary text into the log.
    if (supplied != null && /^[A-Za-z0-9-]{4,64}$/.test(supplied)) {
        return supplied;
    }

    return Array.from(random.getRandomBytes(4), (byte) =>
        byte.toString(16).padStart(2, '0'),
    ).join('');
}

function validateClientEvents(events: ClientDiagnosticEventInput[]): void {
    const invalid = (): never => {
        throw new UserFacingHttpError(422, '診斷事件格式不正確');
    };

    if (!Array.isArray(events) || events.length > MAX_CLIENT_EVENTS) {
        invalid();
    }

    const optionalString = (value: unknown, max: number): boolean =>
        value == null || (typeof value === 'string' && value.length <= max);
    const optionalInt = (value: unknown, max: number): boolean =>
        value == null ||
        (typeof value === 'number' &&
            Number.isInteger(value) &&
            value >= 0 &&
            value <= max);

    for (const event of events) {
        const valid =
            typeof event === 'object' &&
            event !== null &&
            typeof event.occurredAt === 'string' &&
            event.occurredAt.length <= 40 &&
            CLIENT_EVENT_TYPES.includes(event.type) &&
            (DIAGNOSTIC_LEVELS as readonly string[]).includes(event.level) &&
            typeof event.summary === 'string' &&
            event.summary !== '' &&
            event.summary.length <= 2000 &&
            optionalString(event.op, 64) &&
            optionalString(event.requestId, 64) &&
            optionalInt(event.status, 599) &&
            optionalInt(event.durationMs, Number.MAX_SAFE_INTEGER) &&
            (event.context == null ||
                (typeof event.context === 'object' &&
                    !Array.isArray(event.context)));

        if (!valid) {
            invalid();
        }
    }
}

function toEventType(value: string): DiagnosticEventType {
    return (DIAGNOSTIC_EVENT_TYPES as readonly string[]).includes(value)
        ? (value as DiagnosticEventType)
        : 'client.error';
}

function toLevel(value: string): DiagnosticLevel {
    return (DIAGNOSTIC_LEVELS as readonly string[]).includes(value)
        ? (value as DiagnosticLevel)
        : 'info';
}

function parseTimestamp(value: string): Date | null {
    const parsed = new Date(value);

    return Number.isNaN(parsed.getTime()) ? null : parsed;
}
