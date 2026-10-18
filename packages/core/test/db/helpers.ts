import { randomBytes } from 'node:crypto';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import {
  AccountActiveProfile,
  AccountCredentialsStore,
  AccountManager,
  SchoolPortalSessionStore,
  UUSessionStore,
} from '../../src/accounts';
import {
  CacheRepository,
  CredentialCipher,
  KeyValueStoreRepository,
  migrationBundle,
  runMigrations,
  schema,
  type AltUUDatabase,
} from '../../src/db';
import type { Clock, SecureStorage } from '../../src/platform';

export class FakeClock implements Clock {
  constructor(private current = new Date('2026-10-01T00:00:00Z')) {}

  now(): Date {
    return new Date(this.current);
  }

  advanceSeconds(seconds: number): void {
    this.current = new Date(this.current.getTime() + seconds * 1000);
  }
}

export class MemorySecureStorage implements SecureStorage {
  readonly items = new Map<string, string>();

  async getItem(key: string): Promise<string | null> {
    return this.items.get(key) ?? null;
  }

  async setItem(key: string, value: string): Promise<void> {
    this.items.set(key, value);
  }

  async deleteItem(key: string): Promise<void> {
    this.items.delete(key);
  }
}

export async function createTestContext() {
  const sqlite = new Database(':memory:');
  sqlite.pragma('foreign_keys = ON');
  const db = drizzle(sqlite, { schema }) as unknown as AltUUDatabase;
  await runMigrations(db, migrationBundle);

  const clock = new FakeClock();
  const secureStorage = new MemorySecureStorage();
  const cipher = new CredentialCipher(secureStorage, {
    getRandomBytes: (length) => new Uint8Array(randomBytes(length)),
  });
  const keyValues = new KeyValueStoreRepository(db, clock);
  const activeProfile = new AccountActiveProfile(keyValues);
  const deps = { db, cipher, activeProfile, clock };
  const credentials = new AccountCredentialsStore(deps);
  const hunguSessions = new UUSessionStore(deps);
  const portalSessions = new SchoolPortalSessionStore(deps);

  return {
    sqlite,
    db,
    clock,
    secureStorage,
    cipher,
    keyValues,
    activeProfile,
    credentials,
    hunguSessions,
    portalSessions,
    cache: new CacheRepository(db, clock),
    manager: new AccountManager(credentials, activeProfile, hunguSessions),
  };
}

export type TestContext = Awaited<ReturnType<typeof createTestContext>>;
