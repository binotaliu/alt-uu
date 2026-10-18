import type {
  UpstreamCallEvent,
  UpstreamCallListener,
} from '../../http/transport';
import type { DiagnosticRecorder } from './recorder';
import type { UpstreamRecordingSwitch } from './recordingSwitch';
import type { DiagnosticEventType, DiagnosticLevel } from './types';

const ENCODER = new TextEncoder();

/**
 * Port of legacy UpstreamCallSubscriber, as the `onUpstreamCall` hook of
 * HttpTransport. Records every outbound call BEFORE any caller swallows a
 * failure, which is what separates "the API failed" from "our parsing is
 * wrong": an upstream 500 that becomes an empty list is still visible here.
 */
export function createUpstreamCallRecorder(deps: {
  recorder: DiagnosticRecorder;
  recordingSwitch: UpstreamRecordingSwitch;
}): UpstreamCallListener {
  return (event) => {
    // Checked synchronously: the switch is only held while a probe runs.
    if (deps.recordingSwitch.isSuppressed()) {
      return;
    }

    void recordUpstreamCall(deps.recorder, event).catch(() => undefined);
  };
}

export async function recordUpstreamCall(
  recorder: DiagnosticRecorder,
  event: UpstreamCallEvent,
): Promise<void> {
  const summary = `${event.method.toUpperCase()} ${recorder
    .redactor()
    .redactUrl(event.url)}`;
  const base = {
    summary,
    status: event.status,
    durationMs: event.durationMs,
  };

  if (event.body === null || event.status === null) {
    await recorder.record({
      ...base,
      type: 'upstream.call',
      level: 'error',
      context: {
        reason: 'connection_failed',
        exception: event.error?.name ?? 'Error',
        detail: event.error?.message ?? '',
        host: event.host,
        service: event.service,
      },
    });

    return;
  }

  const successful = event.status >= 200 && event.status < 300;
  const bodyBytes = ENCODER.encode(event.body).length;
  // A 2xx whose body will not decode: the service answered, but not with
  // anything usable.
  const undecodableJson =
    successful &&
    event.expectsJson &&
    event.body !== '' &&
    decodesToNull(event.body);

  if (successful && !undecodableJson) {
    await recorder.record({
      ...base,
      type: 'upstream.call',
      level: 'info',
      context: {
        bodyBytes,
        host: event.host,
        service: event.service,
      },
    });

    return;
  }

  const type: DiagnosticEventType = undecodableJson
    ? 'parse.anomaly'
    : 'upstream.call';
  const level: DiagnosticLevel = successful ? 'warning' : 'error';

  await recorder.record({
    ...base,
    type,
    level,
    context: {
      bodyBytes,
      reason: successful ? 'undecodable_json' : 'upstream_status',
      bodySnippet: recorder.snippet(event.body),
      host: event.host,
      service: event.service,
    },
  });
}

/** PHP `json_decode($body, true) === null`: invalid JSON or a literal null. */
function decodesToNull(body: string): boolean {
  try {
    return JSON.parse(body) === null;
  } catch {
    return true;
  }
}
