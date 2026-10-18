/** Same string values as the legacy enums so stored rows and the UI keep working. */

export const DIAGNOSTIC_EVENT_TYPES = [
  'api.request',
  'upstream.call',
  'parse.anomaly',
  'exception',
  'client.error',
  'client.nav',
] as const;
export type DiagnosticEventType = (typeof DIAGNOSTIC_EVENT_TYPES)[number];

export const diagnosticEventTypeLabels: Record<DiagnosticEventType, string> = {
  'api.request': 'App 請求',
  'upstream.call': '外部服務呼叫',
  'parse.anomaly': '資料解析異常',
  exception: '伺服器例外',
  'client.error': '前端錯誤',
  'client.nav': '頁面切換',
};

export const DIAGNOSTIC_LEVELS = ['info', 'warning', 'error'] as const;
export type DiagnosticLevel = (typeof DIAGNOSTIC_LEVELS)[number];

export const diagnosticLevelLabels: Record<DiagnosticLevel, string> = {
  info: '資訊',
  warning: '警告',
  error: '錯誤',
};

export type DiagnosticSource = 'server' | 'client';

export const CONNECTIVITY_SERVICES = [
  'hungu',
  'school_portal',
  'nou_tools',
  'iap',
  'google',
  'cloudflare',
  'apple',
] as const;
export type ConnectivityService = (typeof CONNECTIVITY_SERVICES)[number];

export const connectivityServiceLabels: Record<ConnectivityService, string> = {
  hungu: '數位學習平台 (UU平台)',
  school_portal: '教務行政資訊系統',
  nou_tools: 'NOU 小幫手',
  iap: 'Alt UU+ 服務',
  google: 'Google',
  cloudflare: 'Cloudflare',
  apple: 'Apple',
};

/** Reference services are public endpoints, only checked when the user opts in. */
export function isReferenceService(service: ConnectivityService): boolean {
  return ['google', 'cloudflare', 'apple'].includes(service);
}

export function isProblemLevel(level: DiagnosticLevel): boolean {
  return level !== 'info';
}

// View models (field names match legacy resources/js/types/generated.d.ts).

export interface DiagnosticEventViewModel {
  id: number;
  occurredAt: string;
  type: DiagnosticEventType;
  typeLabel: string;
  level: DiagnosticLevel;
  source: DiagnosticSource;
  op: string | null;
  requestId: string | null;
  summary: string;
  status: number | null;
  durationMs: number | null;
  context: Record<string, unknown>;
}

export interface DiagnosticEventListViewModel {
  events: DiagnosticEventViewModel[];
  total: number;
  recordingEnabled: boolean;
}

export interface DiagnosticRecordingStatusViewModel {
  available: boolean;
  recording: boolean;
  /** ISO-8601, or null when not recording. */
  expiresAt: string | null;
  windowMinutes: number;
  retentionDays: number;
}

export interface DiagnosticBundleViewModel {
  filename: string;
  content: string;
}

export interface ConnectivityServiceViewModel {
  service: ConnectivityService;
  label: string;
  isReference: boolean;
}

export interface ConnectivityServiceListViewModel {
  services: ConnectivityServiceViewModel[];
}

export interface ConnectivityCheckResultViewModel {
  service: ConnectivityService;
  label: string;
  checkKind: string;
  reachable: boolean;
  statusCode: number | null;
  latencyMs: number | null;
  error: string | null;
  checkedAt: string;
}

export interface MaterialDirectoryNodeViewModel {
  identifier: string;
  text: string;
  level: number;
  href: string | null;
  leaf: boolean;
  itemDisabled: boolean;
  isInspectable: boolean;
}

export interface MaterialDirectoryInspectionViewModel {
  cid: string;
  apiCode: number | null;
  apiMessage: string | null;
  nodeCount: number;
  nodes: MaterialDirectoryNodeViewModel[];
  rawJson: string;
  rawJsonTruncated: boolean;
}

export type MaterialParseKind =
  'youtube' | 'video' | 'download' | 'html' | 'empty' | 'error';

export interface MaterialParseOutcomeViewModel {
  succeeded: boolean;
  kind: MaterialParseKind;
  videoUrl: string | null;
  htmlLength: number;
  downloadFileName: string | null;
  errorClass: string | null;
  errorMessage: string | null;
  errorLocation: string | null;
}

export interface MaterialSourceInspectionViewModel {
  cid: string;
  scoid: string;
  nodeText: string;
  url: string;
  fetchStatus: number | null;
  contentType: string | null;
  bodyBytes: number;
  isText: boolean;
  body: string | null;
  bodyTruncated: boolean;
  fetchError: string | null;
  parse: MaterialParseOutcomeViewModel;
}

/** One entry of the UI's in-memory ring buffer (legacy ClientDiagnosticEventData). */
export interface ClientDiagnosticEventInput {
  occurredAt: string;
  type: string;
  level: string;
  summary: string;
  op?: string | null;
  requestId?: string | null;
  status?: number | null;
  durationMs?: number | null;
  context?: Record<string, unknown>;
}
