import type { Clock, DeviceInfo } from '../../platform';
import type { JsLogBuffer } from './logBuffer';
import type { DiagnosticRecorder } from './recorder';
import type {
  DiagnosticBundleViewModel,
  DiagnosticEventViewModel,
} from './types';

const TIMELINE_LIMIT = 300;
const LOG_TAIL_CHARACTERS = 16384;
const MARKERS = { error: '✗', warning: '!', info: '·' } as const;

export interface DiagnosticBundleDeps {
  recorder: DiagnosticRecorder;
  clock: Clock;
  deviceInfo: () => DeviceInfo | Promise<DeviceInfo>;
  /** Replaces the legacy native shell log tail. */
  logBuffer?: JsLogBuffer;
}

/**
 * Port of legacy BuildDiagnosticBundle: the log as Markdown the user can
 * paste into a GitHub issue. Redacts again on the way out as belt and braces.
 */
export async function buildDiagnosticBundle(
  deps: DiagnosticBundleDeps,
): Promise<DiagnosticBundleViewModel> {
  await deps.recorder.pruneExpired();

  const now = deps.clock.now();
  const events = await deps.recorder.list({ limit: TIMELINE_LIMIT });
  const sections = [
    await header(deps, now),
    timeline(deps.recorder, events),
    logTail(deps),
  ];

  return {
    filename: `alt-uu-diagnostics-${formatFilenameTimestamp(now)}.md`,
    content: sections.filter((section) => section !== '').join('\n'),
  };
}

async function header(deps: DiagnosticBundleDeps, now: Date): Promise<string> {
  const device = await readDeviceInfo(deps);
  const lines = [
    '# Alt UU 診斷記錄',
    '',
    '> 這份記錄中的帳號資訊已以代號取代，密碼、Cookie 與憑證則完全未被記錄。',
    '',
    '| 項目 | 內容 |',
    '| --- | --- |',
    `| 產生時間 | ${now.toISOString()} |`,
    `| App 版本 | ${device?.appVersion ?? 'unknown'} (${device?.buildNumber ?? 'unknown'}) |`,
    `| 平台 | ${platformLabel(device)} |`,
    `| 系統版本 | ${device?.osVersion ?? 'unknown'} |`,
    `| 裝置型號 | ${device?.deviceModel ?? 'unknown'} |`,
    `| 記錄筆數 | ${await deps.recorder.count()} |`,
  ];

  return `${lines.join('\n')}\n`;
}

function timeline(
  recorder: DiagnosticRecorder,
  events: DiagnosticEventViewModel[],
): string {
  if (events.length === 0) {
    return '\n## 事件記錄\n\n目前沒有任何記錄。\n';
  }

  const lines = ['', '## 事件記錄（新到舊）', ''];

  for (const event of events) {
    lines.push(renderEvent(recorder, event));
  }

  return `${lines.join('\n')}\n`;
}

function renderEvent(
  recorder: DiagnosticRecorder,
  event: DiagnosticEventViewModel,
): string {
  const redactor = recorder.redactor();
  const parts = [
    event.occurredAt.slice(11, 23),
    MARKERS[event.level],
    `[${event.type}]`,
    redactor.redactText(event.summary),
    event.status !== null ? `→ ${event.status}` : null,
    event.durationMs !== null ? `${event.durationMs}ms` : null,
    event.op !== null ? `op=${event.op}` : null,
    event.requestId !== null ? `id=${event.requestId}` : null,
  ].filter((part): part is string => part !== null && part !== '');
  const line = `- \`${parts.join(' ')}\``;

  if (Object.keys(event.context).length === 0) {
    return line;
  }

  const encoded = redactor.redactText(
    JSON.stringify(redactor.redact(event.context), null, 4),
  );

  return `${line}\n\n  <details><summary>詳細資料</summary>\n\n  \`\`\`json\n${indent(
    encoded,
  )}\n  \`\`\`\n\n  </details>`;
}

function logTail(deps: DiagnosticBundleDeps): string {
  if (deps.logBuffer === undefined) {
    return '';
  }

  const tail = deps.logBuffer.tail(LOG_TAIL_CHARACTERS);

  if (tail === '') {
    return '';
  }

  return `\n## App 執行記錄（尾端）\n\n\`\`\`\n${deps.recorder
    .redactor()
    .redactText(tail)}\n\`\`\`\n`;
}

async function readDeviceInfo(
  deps: DiagnosticBundleDeps,
): Promise<DeviceInfo | null> {
  try {
    return await deps.deviceInfo();
  } catch {
    return null;
  }
}

function platformLabel(device: DeviceInfo | null): string {
  switch (device?.platform) {
    case 'ios':
      return 'iOS';
    case 'android':
      return 'Android';
    case 'tvos':
      return 'tvOS';
    case 'macos':
      return 'macOS';
    case 'windows':
      return 'Windows';
    default:
      return 'unknown';
  }
}

function indent(text: string): string {
  return text
    .split('\n')
    .map((line) => (line === '' ? line : `  ${line}`))
    .join('\n');
}

/** `Y-m-d-His` in UTC (the legacy app ran with timezone UTC). */
function formatFilenameTimestamp(date: Date): string {
  const iso = date.toISOString();

  return `${iso.slice(0, 10)}-${iso.slice(11, 19).replace(/:/g, '')}`;
}
