import type { StudyTimeInput } from '@altuu/core';

import { MAX_STUDY_SECONDS, MIN_STUDY_SECONDS } from './studyTimer';

/** Key-value slot holding the material that was open when the app went away. */
export const ACTIVE_MATERIAL_SESSION_KEY = 'material:active-session';

/**
 * The material visit in progress, checkpointed while the material page is
 * open (replaces the legacy native player's `sessionContext` plus the
 * `sendBeacon` on page hide). It survives the app being killed:
 * the next launch reports the unreported study time and, when media was
 * playing, offers to go back to the material.
 */
export interface ActiveMaterialSession {
  accountId: number | null;
  routePath: string;
  cid: string;
  activityId: string;
  href: string;
  startedAt: string;
  /** Last moment the visit was known to be alive (ISO 8601). */
  lastActiveAt: string;
  positionSeconds: number | null;
  mediaDurationSeconds: number | null;
  wasPlaying: boolean;
  materialName: string;
  courseName: string;
}

export interface KeyValueSlot {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  delete(key: string): Promise<void>;
}

const isString = (value: unknown): value is string => typeof value === 'string';
const optionalNumber = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) ? value : null;

/** Validates a stored session; anything malformed yields null. */
export function parseActiveMaterialSession(
  raw: string | null,
): ActiveMaterialSession | null {
  if (raw === null) {
    return null;
  }

  let value: unknown;

  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }

  if (typeof value !== 'object' || value === null) {
    return null;
  }

  const record = value as Record<string, unknown>;

  if (
    !isString(record.routePath) ||
    !record.routePath.startsWith('/') ||
    !isString(record.cid) ||
    !isString(record.activityId) ||
    !isString(record.href) ||
    !isString(record.startedAt) ||
    !isString(record.lastActiveAt) ||
    Number.isNaN(Date.parse(record.startedAt)) ||
    Number.isNaN(Date.parse(record.lastActiveAt))
  ) {
    return null;
  }

  return {
    accountId: optionalNumber(record.accountId),
    routePath: record.routePath,
    cid: record.cid,
    activityId: record.activityId,
    href: record.href,
    startedAt: record.startedAt,
    lastActiveAt: record.lastActiveAt,
    positionSeconds: optionalNumber(record.positionSeconds),
    mediaDurationSeconds: optionalNumber(record.mediaDurationSeconds),
    wasPlaying: record.wasPlaying === true,
    materialName: isString(record.materialName) ? record.materialName : '',
    courseName: isString(record.courseName) ? record.courseName : '',
  };
}

/**
 * The study time still owed for an interrupted visit: from its start to the
 * last checkpoint (time the app was dead does not count). Null when it is
 * too short to report.
 */
export function pendingStudyTimeInput(
  session: ActiveMaterialSession,
): StudyTimeInput | null {
  const seconds = Math.floor(
    (Date.parse(session.lastActiveAt) - Date.parse(session.startedAt)) / 1000,
  );

  if (!Number.isFinite(seconds) || seconds < MIN_STUDY_SECONDS) {
    return null;
  }

  const input: StudyTimeInput = {
    cid: session.cid,
    activityId: session.activityId,
    url: session.href,
    seconds: Math.min(MAX_STUDY_SECONDS, seconds),
    startedAt: session.startedAt,
  };

  if (session.positionSeconds !== null && session.positionSeconds >= 0) {
    input.positionSeconds = session.positionSeconds;
  }

  if (
    session.mediaDurationSeconds !== null &&
    session.mediaDurationSeconds > 0
  ) {
    input.mediaDurationSeconds = session.mediaDurationSeconds;
  }

  return input;
}

export async function readActiveMaterialSession(
  store: KeyValueSlot,
): Promise<ActiveMaterialSession | null> {
  try {
    return parseActiveMaterialSession(
      await store.get(ACTIVE_MATERIAL_SESSION_KEY),
    );
  } catch {
    return null;
  }
}

export async function writeActiveMaterialSession(
  store: KeyValueSlot,
  session: ActiveMaterialSession,
): Promise<void> {
  try {
    await store.set(ACTIVE_MATERIAL_SESSION_KEY, JSON.stringify(session));
  } catch {
    // Best effort: losing a checkpoint only loses a crash recovery.
  }
}

export async function clearActiveMaterialSession(
  store: KeyValueSlot,
): Promise<void> {
  try {
    await store.delete(ACTIVE_MATERIAL_SESSION_KEY);
  } catch {
    // Best effort.
  }
}
