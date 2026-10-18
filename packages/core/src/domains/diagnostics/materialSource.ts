import { UserFacingHttpError } from '../../errors/errors';
import { hostOf } from '../../http/url';
import type { HunguPageResult, HunguPayloadResult } from '../../hungu/types';
import type { DiagnosticRecorder } from './recorder';
import type { DiagnosticsConfig } from './config';
import type {
  MaterialDirectoryInspectionViewModel,
  MaterialDirectoryNodeViewModel,
  MaterialParseKind,
  MaterialParseOutcomeViewModel,
  MaterialSourceInspectionViewModel,
} from './types';

type PathNode = Record<string, unknown>;

/** The slice of HunguCourseClient the inspector needs. */
export interface MaterialSourceCourseClient {
  fetchCoursePathInfo(cid: string): Promise<HunguPayloadResult>;
  fetchMaterialContent(url: string): Promise<HunguPageResult>;
}

/** The slice of the course domain's ParsedMaterialContentResult it reads. */
export interface ParsedMaterialSummary {
  videoProvider?: string | null;
  embedVideoUrl?: string | null;
  videoUrl?: string | null;
  downloadUrl?: string | null;
  downloadFileName?: string | null;
  htmlContent: string;
}

export interface MaterialSourceInspectorDeps {
  courseClient: MaterialSourceCourseClient;
  /** Course domain `parseMaterialContent(url, baseHost)`. */
  parseMaterialContent: (
    url: string,
    baseHost: string,
  ) => Promise<ParsedMaterialSummary>;
  recorder: DiagnosticRecorder;
  config: DiagnosticsConfig;
  /** Build flag (`EXPO_PUBLIC_` material source viewer rule). */
  materialSourceViewerEnabled: boolean;
  /** Legacy SyncCurrentCourse: puts the school session "in" the course. */
  syncCurrentCourse?: (cid: string) => Promise<void>;
  /** Host of the active HUNGU session's base URL. */
  resolveBaseHost: () => Promise<string | null>;
}

/**
 * Ports legacy InspectMaterialDirectory / InspectMaterialSource plus the two
 * controllers around them (viewer flag, current-course sync, base host).
 */
export class MaterialSourceInspector {
  constructor(private readonly deps: MaterialSourceInspectorDeps) {}

  /**
   * Always fetches fresh, never from the path-info cache: the tool exists
   * to answer "what does the school say right now".
   */
  async inspectDirectory(
    cid: string,
  ): Promise<MaterialDirectoryInspectionViewModel> {
    this.assertEnabled();
    await this.deps.syncCurrentCourse?.(cid);

    const { payload } = await this.deps.courseClient.fetchCoursePathInfo(cid);
    const redactor = this.deps.recorder.redactor();
    const nodes = flattenMaterialPathNodes(payload).map((node) =>
      this.toNode(node),
    );
    const rawJson = redactor.redactSecrets(JSON.stringify(payload, null, 4));
    const limit = Math.max(0, this.deps.config.materialSourceBytes);
    const truncated = limit > 0 && byteLength(rawJson) > limit;

    return {
      cid,
      apiCode: isNumeric(payload.code)
        ? Math.trunc(Number(payload.code))
        : null,
      apiMessage: typeof payload.message === 'string' ? payload.message : null,
      nodeCount: nodes.length,
      nodes,
      rawJson: truncated ? cutBytes(rawJson, limit) : rawJson,
      rawJsonTruncated: truncated,
    };
  }

  /**
   * Fetches one node's page and reports the raw source the school returned
   * together with what the material parser made of it.
   */
  async inspectSource(
    cid: string,
    scoid: string,
  ): Promise<MaterialSourceInspectionViewModel> {
    this.assertEnabled();
    await this.deps.syncCurrentCourse?.(cid);

    const baseHost = await this.deps.resolveBaseHost();

    if (baseHost === null || baseHost === '') {
      throw new UserFacingHttpError(403, '不允許存取外部資源');
    }

    const node = await this.findNode(cid, scoid);
    const href = typeof node.href === 'string' ? node.href.trim() : '';

    if (!isWebUrl(href)) {
      throw new UserFacingHttpError(422, '此節點沒有可檢視的連結');
    }

    if (hostOf(href) !== baseHost) {
      throw new UserFacingHttpError(403, '不允許存取外部資源');
    }

    const fetched = await this.fetchSource(href);

    return {
      cid,
      scoid,
      nodeText: typeof node.text === 'string' ? node.text : '',
      url: this.deps.recorder.redactor().redactUrl(href),
      fetchStatus: fetched.status,
      contentType: fetched.contentType,
      bodyBytes: fetched.bodyBytes,
      isText: fetched.isText,
      body: fetched.body,
      bodyTruncated: fetched.bodyTruncated,
      fetchError: fetched.error,
      parse: await this.parse(href, baseHost),
    };
  }

  private assertEnabled(): void {
    if (!this.deps.materialSourceViewerEnabled) {
      throw new UserFacingHttpError(404, '找不到此功能');
    }
  }

  private async findNode(cid: string, scoid: string): Promise<PathNode> {
    const { payload } = await this.deps.courseClient.fetchCoursePathInfo(cid);

    for (const node of flattenMaterialPathNodes(payload)) {
      if (String(node.identifier ?? '') === scoid) {
        return node;
      }
    }

    throw new UserFacingHttpError(404, '找不到此教材節點');
  }

  private toNode(node: PathNode): MaterialDirectoryNodeViewModel {
    const href = typeof node.href === 'string' ? node.href.trim() : null;
    const webUrl = href !== null && isWebUrl(href);

    return {
      identifier: String(node.identifier ?? ''),
      text: typeof node.text === 'string' ? node.text : '',
      level: Math.trunc(Number(node.level ?? 0)) || 0,
      // Only real URLs go through the URL redactor, which would turn
      // `about:blank` into `about://blank`.
      href:
        href === '' || href === null
          ? null
          : webUrl
            ? this.deps.recorder.redactor().redactUrl(href)
            : href,
      leaf: phpBool(node.leaf),
      itemDisabled: phpBool(node.itemDisabled),
      isInspectable: webUrl,
    };
  }

  private async fetchSource(url: string): Promise<{
    status: number | null;
    contentType: string | null;
    bodyBytes: number;
    isText: boolean;
    body: string | null;
    bodyTruncated: boolean;
    error: string | null;
  }> {
    const redactor = this.deps.recorder.redactor();
    let response: HunguPageResult;

    try {
      response = await this.deps.courseClient.fetchMaterialContent(url);
    } catch (error) {
      return {
        status: null,
        contentType: null,
        bodyBytes: 0,
        isText: false,
        body: null,
        bodyTruncated: false,
        error: describeError(error, (text) => redactor.redactText(text)),
      };
    }

    const raw = response.body;
    const contentType = (response.headers['content-type'] ?? '').toLowerCase();
    const isText = isTextContentType(contentType);
    let body: string | null = null;
    let truncated = false;

    if (isText) {
      const text = redactor.redactSecrets(raw);
      const limit = Math.max(0, this.deps.config.materialSourceBytes);

      truncated = limit > 0 && byteLength(text) > limit;
      body = truncated ? cutBytes(text, limit) : text;
    }

    return {
      status: response.status,
      contentType: contentType === '' ? null : contentType,
      bodyBytes: byteLength(raw),
      isText,
      body,
      bodyTruncated: truncated,
      error: null,
    };
  }

  private async parse(
    url: string,
    baseHost: string,
  ): Promise<MaterialParseOutcomeViewModel> {
    const redactor = this.deps.recorder.redactor();

    try {
      const result = await this.deps.parseMaterialContent(url, baseHost);
      const kind: MaterialParseKind =
        result.videoProvider === 'youtube' && result.embedVideoUrl != null
          ? 'youtube'
          : result.videoUrl != null
            ? 'video'
            : result.downloadUrl != null
              ? 'download'
              : result.htmlContent.trim() !== ''
                ? 'html'
                : 'empty';

      return {
        succeeded: true,
        kind,
        videoUrl:
          result.videoUrl == null ? null : redactor.redactUrl(result.videoUrl),
        htmlLength: Array.from(result.htmlContent).length,
        downloadFileName: result.downloadFileName ?? null,
        errorClass: null,
        errorMessage: null,
        errorLocation: null,
      };
    } catch (error) {
      return {
        succeeded: false,
        kind: 'error',
        videoUrl: null,
        htmlLength: 0,
        downloadFileName: null,
        errorClass: errorClassName(error),
        errorMessage: redactor.redactText(errorMessage(error)),
        errorLocation: errorLocation(error),
      };
    }
  }
}

/**
 * Flattens the raw `my-course-path-info` tree the way the course directory
 * does, WITHOUT normalising the nodes (about:blank stays), because the tool
 * exists to show what the school actually sent.
 */
export function flattenMaterialPathNodes(
  payload: Record<string, unknown>,
): PathNode[] {
  const items = (
    (payload.data as Record<string, unknown> | undefined)?.path as
      Record<string, unknown> | undefined
  )?.item;

  return Array.isArray(items) ? walk(items, 0) : [];
}

function walk(nodes: unknown[], level: number): PathNode[] {
  const result: PathNode[] = [];

  for (const node of nodes) {
    if (typeof node !== 'object' || node === null || Array.isArray(node)) {
      continue;
    }

    const { item: children, ...rest } = node as PathNode;

    result.push({ ...rest, level });

    if (Array.isArray(children) && children.length > 0) {
      result.push(...walk(children, level + 1));
    }
  }

  return result;
}

function isWebUrl(value: string): boolean {
  return /^https?:\/\//i.test(value);
}

function isNumeric(value: unknown): boolean {
  return (
    typeof value === 'number' ||
    (typeof value === 'string' &&
      value.trim() !== '' &&
      !Number.isNaN(Number(value)))
  );
}

/** PHP `(bool)` for the scalar shapes the school sends. */
function phpBool(value: unknown): boolean {
  return !(
    value === undefined ||
    value === null ||
    value === false ||
    value === 0 ||
    value === '' ||
    value === '0'
  );
}

/** Mirrors MaterialContentProxyController: anything else is a download. */
function isTextContentType(contentType: string): boolean {
  return (
    contentType.startsWith('text/') ||
    contentType.includes('application/json') ||
    contentType.includes('application/javascript') ||
    contentType.includes('application/xml')
  );
}

const ENCODER = new TextEncoder();
const DECODER = new TextDecoder();

function byteLength(text: string): number {
  return ENCODER.encode(text).length;
}

/** PHP `mb_strcut`: cuts at a byte offset without splitting a character. */
function cutBytes(text: string, limit: number): string {
  const bytes = ENCODER.encode(text);
  let end = Math.min(limit, bytes.length);

  while (end > 0 && end < bytes.length && (bytes[end] & 0xc0) === 0x80) {
    end -= 1;
  }

  return DECODER.decode(bytes.slice(0, end));
}

function errorClassName(error: unknown): string {
  return error instanceof Error ? error.name : typeof error;
}

function errorMessage(error: unknown): string {
  if (!(error instanceof Error)) {
    return String(error);
  }

  const cause = error.cause;

  return cause instanceof Error && cause.message !== error.message
    ? `${error.message} (${cause.message})`
    : error.message;
}

function describeError(
  error: unknown,
  redact: (text: string) => string,
): string {
  return `${errorClassName(error)}: ${redact(errorMessage(error))}`;
}

function errorLocation(error: unknown): string | null {
  if (!(error instanceof Error) || error.stack === undefined) {
    return null;
  }

  const frame = error.stack
    .split('\n')
    .slice(1)
    .find((line) => /:\d+/.test(line));
  const match =
    frame === undefined ? null : /([^\s()]+:\d+)(?::\d+)?\)?\s*$/.exec(frame);

  return match?.[1] ?? null;
}
