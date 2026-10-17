import { desc, inArray, lt, lte, sql } from 'drizzle-orm';
import { diagnosticEvents } from '../../db/schema';
import type { KeyValueStoreRepository } from '../../db/keyValueStore';
import type { AltUUDatabase } from '../../db/types';
import type { Clock } from '../../platform';
import type { DiagnosticsConfig } from './config';
import { OperationContext } from './operationContext';
import { DiagnosticRedactor } from './redactor';
import {
    diagnosticEventTypeLabels,
    type DiagnosticEventType,
    type DiagnosticEventViewModel,
    type DiagnosticLevel,
    type DiagnosticSource,
} from './types';

export interface DiagnosticRecordInput {
    type: DiagnosticEventType;
    summary: string;
    level?: DiagnosticLevel;
    context?: Record<string, unknown>;
    op?: string | null;
    requestId?: string | null;
    status?: number | null;
    durationMs?: number | null;
    source?: DiagnosticSource;
    occurredAt?: Date | null;
}

/**
 * Where the recording window's expiry lives (legacy
 * `AppPreferenceStore::get/setDiagnosticsRecordingUntil`). Defaults to a
 * key-value-store implementation with the legacy key and JSON shape.
 */
export interface RecordingWindowStore {
    get(): Promise<Date | null>;
    set(until: Date | null): Promise<void>;
}

export const DIAGNOSTICS_RECORDING_UNTIL_KEY =
    'preference:diagnostics-recording-until';

export class KeyValueRecordingWindowStore implements RecordingWindowStore {
    constructor(private readonly keyValues: KeyValueStoreRepository) {}

    async get(): Promise<Date | null> {
        const raw = await this.keyValues.get(DIAGNOSTICS_RECORDING_UNTIL_KEY);

        if (raw === null) {
            return null;
        }

        try {
            const decoded = JSON.parse(raw) as { until?: unknown } | null;
            const until = decoded?.until;

            if (typeof until !== 'string') {
                return null;
            }

            const date = new Date(until);

            return Number.isNaN(date.getTime()) ? null : date;
        } catch {
            return null;
        }
    }

    async set(until: Date | null): Promise<void> {
        await this.keyValues.set(
            DIAGNOSTICS_RECORDING_UNTIL_KEY,
            JSON.stringify({ until: until?.toISOString() ?? null }),
        );
    }
}

export interface DiagnosticRecorderDeps {
    db: AltUUDatabase;
    clock: Clock;
    redactor: DiagnosticRedactor;
    config: DiagnosticsConfig;
    windowStore: RecordingWindowStore;
    operationContext?: OperationContext;
}

const DAY_MS = 86_400_000;
const MINUTE_MS = 60_000;

/**
 * Port of legacy DiagnosticRecorder: writes redacted entries to the on-device
 * log, only while the user's bounded recording window is open. Diagnostics
 * never throw into the caller.
 */
export class DiagnosticRecorder {
    readonly operationContext: OperationContext;

    private windowUntil: Date | null = null;
    private windowLoaded = false;

    constructor(private readonly deps: DiagnosticRecorderDeps) {
        this.operationContext = deps.operationContext ?? new OperationContext();
    }

    redactor(): DiagnosticRedactor {
        return this.deps.redactor;
    }

    async record(input: DiagnosticRecordInput): Promise<void> {
        if (!(await this.isEnabled())) {
            return;
        }

        try {
            const current = this.operationContext.current();
            const inserted = await this.deps.db
                .insert(diagnosticEvents)
                .values({
                    occurredAt: input.occurredAt ?? this.deps.clock.now(),
                    type: input.type,
                    level: input.level ?? 'info',
                    source: input.source ?? 'server',
                    op: input.op ?? current.op,
                    requestId: input.requestId ?? current.requestId,
                    summary: this.deps.redactor.redactText(input.summary),
                    status: input.status ?? null,
                    durationMs: input.durationMs ?? null,
                    context: this.deps.redactor.redact(input.context ?? {}),
                })
                .returning({ id: diagnosticEvents.id });

            const latestId = inserted[0]?.id;

            if (latestId !== undefined) {
                await this.prune(latestId);
            }
        } catch {
            // Intentionally ignored: a full disk must not break a request.
        }
    }

    /**
     * Truncates an oversized body to the snippet size, redacting first so a
     * secret cannot survive by being cut in half.
     */
    snippet(body: string): string {
        const redacted = this.deps.redactor.redactText(body);
        const limit = Math.max(0, this.deps.config.bodySnippetBytes);
        const characters = Array.from(redacted);

        if (limit === 0 || characters.length <= limit) {
            return redacted;
        }

        return `${characters.slice(0, limit).join('')}…（已截斷）`;
    }

    async clear(): Promise<void> {
        try {
            await this.deps.db.delete(diagnosticEvents);
        } catch {
            // Intentionally ignored.
        }
    }

    /** Whether writes are accepted: the build allows it AND the window is open. */
    async isEnabled(): Promise<boolean> {
        return (await this.recordingExpiresAt()) !== null;
    }

    /** Whether the build ships the feature at all. */
    isAvailable(): boolean {
        return this.deps.config.enabled;
    }

    /**
     * When the current window closes, or null if it is not open. An elapsed
     * window reads as closed: nothing has to run on a timer.
     */
    async recordingExpiresAt(): Promise<Date | null> {
        if (!this.isAvailable()) {
            return null;
        }

        if (!this.windowLoaded) {
            try {
                this.windowUntil = await this.deps.windowStore.get();
                this.windowLoaded = true;
            } catch {
                return null;
            }
        }

        const until = this.windowUntil;

        return until !== null &&
            until.getTime() > this.deps.clock.now().getTime()
            ? until
            : null;
    }

    /** Opens a recording window, or closes it when `enabled` is false. */
    async setRecording(enabled: boolean): Promise<Date | null> {
        if (enabled && !this.isAvailable()) {
            return null;
        }

        const minutes = Math.max(1, this.deps.config.recordingWindowMinutes);
        const until = enabled
            ? new Date(this.deps.clock.now().getTime() + minutes * MINUTE_MS)
            : null;

        await this.deps.windowStore.set(until);
        this.windowUntil = until;
        this.windowLoaded = true;

        await this.pruneExpired();

        return until;
    }

    /** Drops rows past the retention age. */
    async pruneExpired(): Promise<void> {
        const days = Math.max(1, this.deps.config.retentionDays);
        const cutoff = new Date(
            this.deps.clock.now().getTime() - days * DAY_MS,
        );

        try {
            await this.deps.db
                .delete(diagnosticEvents)
                .where(lt(diagnosticEvents.occurredAt, cutoff));
        } catch {
            // Intentionally ignored.
        }
    }

    async count(): Promise<number> {
        const rows = await this.deps.db
            .select({ total: sql<number>`count(*)` })
            .from(diagnosticEvents);

        return Number(rows[0]?.total ?? 0);
    }

    /** Newest first. `problemsOnly` keeps warnings and errors. */
    async list(options: {
        problemsOnly?: boolean;
        limit: number;
    }): Promise<DiagnosticEventViewModel[]> {
        const query = this.deps.db
            .select()
            .from(diagnosticEvents)
            .orderBy(desc(diagnosticEvents.id))
            .limit(options.limit);
        const rows = await (options.problemsOnly === true
            ? query.where(inArray(diagnosticEvents.level, ['warning', 'error']))
            : query);

        return rows.map((row) => ({
            id: row.id,
            occurredAt: row.occurredAt.toISOString(),
            type: row.type as DiagnosticEventType,
            typeLabel:
                diagnosticEventTypeLabels[row.type as DiagnosticEventType] ??
                row.type,
            level: row.level as DiagnosticLevel,
            source: row.source as DiagnosticSource,
            op: row.op,
            requestId: row.requestId,
            summary: row.summary,
            status: row.status,
            durationMs: row.durationMs,
            context: row.context ?? {},
        }));
    }

    /** Keeps only the newest `maxEvents` rows (one indexed delete per write). */
    private async prune(latestId: number): Promise<void> {
        const maxEvents = Math.max(1, this.deps.config.maxEvents);
        const cutoff = latestId - maxEvents;

        if (cutoff > 0) {
            await this.deps.db
                .delete(diagnosticEvents)
                .where(lte(diagnosticEvents.id, cutoff));
        }
    }
}
