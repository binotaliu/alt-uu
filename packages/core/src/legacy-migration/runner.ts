import type { CredentialCipher } from '../db/cipher';
import type { KeyValueStoreRepository } from '../db/keyValueStore';
import type { AltUUDatabase } from '../db/types';
import type { Clock, Logger } from '../platform';
import { importLegacySnapshot } from './importer';
import { LaravelEncrypter, parseLaravelAppKey } from './laravelEncrypter';
import { readLegacySnapshot } from './legacyReader';
import type { LegacyDatabaseHandle, LegacyImportSummary } from './types';

/** key_value_store key recording the outcome of the one-time migration. */
export const LEGACY_MIGRATION_STATUS_KEY = 'legacy-migration:nativephp';

export const DEFAULT_LEGACY_MIGRATION_MAX_ATTEMPTS = 3;

export interface LegacyMigrationStatusRecord {
  status: 'completed' | 'no-legacy-data' | 'failed';
  attempts: number;
  /** ISO 8601. */
  updatedAt: string;
  summary?: LegacyImportSummary;
  error?: string;
}

export type LegacyMigrationOutcome =
  | { status: 'already-done'; record: LegacyMigrationStatusRecord }
  | { status: 'no-legacy-data' }
  | { status: 'completed'; summary: LegacyImportSummary }
  | {
      status: 'failed';
      error: string;
      attempts: number;
      willRetry: boolean;
    };

export interface RunLegacyMigrationDeps {
  db: AltUUDatabase;
  cipher: CredentialCipher;
  keyValues: KeyValueStoreRepository;
  clock: Clock;
  logger?: Logger;
  /** Opens the legacy DB; resolves null when there is none. */
  openLegacyDatabase(): Promise<LegacyDatabaseHandle | null>;
  /**
   * Candidate Laravel APP_KEYs, current first (the per-install key
   * NativePHP generated on the device, then any previous keys).
   */
  readAppKeys(): Promise<readonly string[]>;
  /** Failed attempts before giving up for good (default 3). */
  maxAttempts?: number;
}

/**
 * One-time import of the NativePHP app's data. Safe to call on every
 * launch: it returns immediately once done. Never throws: failures are
 * logged and recorded, and retried on later launches up to `maxAttempts`.
 * The legacy database is only read, never modified or deleted.
 */
export async function runLegacyMigration(
  deps: RunLegacyMigrationDeps,
): Promise<LegacyMigrationOutcome> {
  const maxAttempts = deps.maxAttempts ?? DEFAULT_LEGACY_MIGRATION_MAX_ATTEMPTS;
  let previous: LegacyMigrationStatusRecord | null = null;

  try {
    previous = await readStatus(deps.keyValues);

    if (
      previous !== null &&
      (previous.status !== 'failed' || previous.attempts >= maxAttempts)
    ) {
      return { status: 'already-done', record: previous };
    }
  } catch (error) {
    log(deps, 'error', 'could not read migration status', error);

    return {
      status: 'failed',
      error: describe(error),
      attempts: 0,
      willRetry: true,
    };
  }

  const attempts = (previous?.attempts ?? 0) + 1;
  let handle: LegacyDatabaseHandle | null = null;

  try {
    handle = await deps.openLegacyDatabase();
    const snapshot =
      handle === null
        ? null
        : await readLegacySnapshot(
            handle.reader,
            await createEncrypter(deps, attempts < maxAttempts),
            deps.logger,
          );

    if (snapshot === null) {
      await writeStatus(deps, {
        status: 'no-legacy-data',
        attempts,
        updatedAt: deps.clock.now().toISOString(),
      });
      log(deps, 'info', 'no legacy database found');

      return { status: 'no-legacy-data' };
    }

    // The summary is only known after the import, so the marker written
    // inside the transaction is completed by a second, best-effort write.
    const summary = await importLegacySnapshot(deps, snapshot, {
      completionMarker: {
        key: LEGACY_MIGRATION_STATUS_KEY,
        value: JSON.stringify({
          status: 'completed',
          attempts,
          updatedAt: deps.clock.now().toISOString(),
        } satisfies LegacyMigrationStatusRecord),
      },
    });

    await writeStatus(deps, {
      status: 'completed',
      attempts,
      updatedAt: deps.clock.now().toISOString(),
      summary,
    }).catch(() => undefined);
    deps.logger?.log('info', 'legacy-migration: completed', {
      ...summary,
    });

    return { status: 'completed', summary };
  } catch (error) {
    log(deps, 'error', 'import failed', error);
    const willRetry = attempts < maxAttempts;

    try {
      await writeStatus(deps, {
        status: 'failed',
        attempts,
        updatedAt: deps.clock.now().toISOString(),
        error: describe(error),
      });
    } catch (statusError) {
      log(deps, 'error', 'could not record failure', statusError);
    }

    return {
      status: 'failed',
      error: describe(error),
      attempts,
      willRetry,
    };
  } finally {
    if (handle !== null) {
      await handle.close().catch(() => undefined);
    }
  }
}

/** Reads the recorded outcome (for diagnostics screens). */
export async function readStatus(
  keyValues: KeyValueStoreRepository,
): Promise<LegacyMigrationStatusRecord | null> {
  const raw = await keyValues.get(LEGACY_MIGRATION_STATUS_KEY);

  if (raw === null) {
    return null;
  }

  try {
    return JSON.parse(raw) as LegacyMigrationStatusRecord;
  } catch {
    return null;
  }
}

async function writeStatus(
  deps: RunLegacyMigrationDeps,
  record: LegacyMigrationStatusRecord,
): Promise<void> {
  await deps.keyValues.set(LEGACY_MIGRATION_STATUS_KEY, JSON.stringify(record));
}

/**
 * Builds the decrypter from every usable key. Without a key the import
 * still runs, but secrets (passwords, sessions) are dropped and the user
 * signs in again. A failed key read (e.g. a locked keychain) is rethrown
 * while retries remain, so a transient failure does not drop secrets.
 */
async function createEncrypter(
  deps: RunLegacyMigrationDeps,
  rethrowReadFailure: boolean,
): Promise<LaravelEncrypter | null> {
  let candidates: readonly string[] = [];

  try {
    candidates = await deps.readAppKeys();
  } catch (error) {
    if (rethrowReadFailure) {
      throw error;
    }

    log(deps, 'warn', 'could not read the legacy APP_KEY', error);
  }

  const usable = candidates.filter((key) => {
    try {
      parseLaravelAppKey(key);

      return true;
    } catch {
      return false;
    }
  });

  if (usable.length === 0) {
    log(deps, 'warn', 'no legacy APP_KEY available; secrets are dropped');

    return null;
  }

  return new LaravelEncrypter(usable);
}

function log(
  deps: RunLegacyMigrationDeps,
  level: 'info' | 'warn' | 'error',
  message: string,
  error?: unknown,
): void {
  deps.logger?.log(
    level,
    `legacy-migration: ${message}`,
    error === undefined ? undefined : { error: describe(error) },
  );
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
