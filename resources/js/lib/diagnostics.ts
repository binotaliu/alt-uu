import { asApiError } from '@/lib/apiError';

/**
 * An in-memory ring buffer of what the frontend just did.
 *
 * The server can only see requests that reached it. A Vue render error, an
 * unhandled rejection, or a request that died before leaving the device never
 * appears in the backend log — and those are exactly the cases where the user
 * says "the app is broken" and we have nothing to look at. This buffer is
 * handed to the server when a bundle is exported, so both halves end up on
 * one timeline.
 *
 * Deliberately in memory only: it is diagnostic scratch, it holds whatever
 * the app was doing, and it should not outlive the session.
 */

export type ClientEventType = 'client.error' | 'client.nav' | 'api.request';

export type ClientEventLevel = 'info' | 'warning' | 'error';

export interface ClientDiagnosticEvent {
    occurredAt: string;
    type: ClientEventType;
    level: ClientEventLevel;
    summary: string;
    op: string | null;
    requestId: string | null;
    status: number | null;
    durationMs: number | null;
    context: Record<string, unknown>;
}

const MAX_EVENTS = 200;

const buffer: ClientDiagnosticEvent[] = [];

export function recordClientEvent(
    event: Omit<ClientDiagnosticEvent, 'occurredAt'> &
        Partial<Pick<ClientDiagnosticEvent, 'occurredAt'>>,
): void {
    buffer.push({
        occurredAt: event.occurredAt ?? new Date().toISOString(),
        type: event.type,
        level: event.level,
        summary: event.summary,
        op: event.op ?? null,
        requestId: event.requestId ?? null,
        status: event.status ?? null,
        durationMs: event.durationMs ?? null,
        context: event.context ?? {},
    });

    if (buffer.length > MAX_EVENTS) {
        buffer.splice(0, buffer.length - MAX_EVENTS);
    }
}

export function clientEvents(): ClientDiagnosticEvent[] {
    return [...buffer];
}

export function clearClientEvents(): void {
    buffer.length = 0;
}

export function recordNavigation(to: string, from: string): void {
    recordClientEvent({
        type: 'client.nav',
        level: 'info',
        summary: `${from} → ${to}`,
        op: null,
        requestId: null,
        status: null,
        durationMs: null,
        context: {},
    });
}

/**
 * Records a JavaScript-side failure — the "our app has a bug" case.
 */
export function recordClientError(
    error: unknown,
    source: string,
    extra: Record<string, unknown> = {},
): void {
    const apiError = asApiError(error);

    // A failed request already has its own richer entry; re-recording it here
    // would just double it up in the timeline.
    if (apiError !== null) {
        return;
    }

    const asError = error instanceof Error ? error : null;

    recordClientEvent({
        type: 'client.error',
        level: 'error',
        summary: asError
            ? `${asError.name}: ${asError.message}`
            : String(error),
        op: null,
        requestId: null,
        status: null,
        durationMs: null,
        context: {
            source,
            stack: asError?.stack?.split('\n').slice(0, 12).join('\n') ?? null,
            ...extra,
        },
    });
}

/**
 * Hands the buffer to the server so an exported bundle contains both halves.
 * Best-effort: a diagnostics failure must never surface to the user.
 */
export async function flushClientEvents(): Promise<void> {
    const events = clientEvents();

    if (events.length === 0) {
        return;
    }

    try {
        await fetch('/api/diagnostics/log/client-events', {
            method: 'POST',
            headers: {
                Accept: 'application/json',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ events }),
        });
    } catch {
        // Intentionally ignored.
    }
}
