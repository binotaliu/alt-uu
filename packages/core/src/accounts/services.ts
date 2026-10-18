import { CacheRepository } from '../db/cache';
import { CredentialCipher } from '../db/cipher';
import { KeyValueStoreRepository } from '../db/keyValueStore';
import type { AltUUDatabase } from '../db/types';
import type { Clock, RandomBytes, SecureStorage } from '../platform';
import { AccountActiveProfile } from './activeProfile';
import { AccountManager } from './accountManager';
import { AccountCredentialsStore } from './credentialsStore';
import { SchoolPortalSessionStore, UUSessionStore } from './sessionStores';

export interface StorageServicesDeps {
  db: AltUUDatabase;
  secureStorage: SecureStorage;
  random: RandomBytes;
  clock: Clock;
}

/** Wires every storage-backed service from the injected platform. */
export function createStorageServices(deps: StorageServicesDeps) {
  const { db, clock } = deps;
  const cipher = new CredentialCipher(deps.secureStorage, deps.random);
  const keyValues = new KeyValueStoreRepository(db, clock);
  const activeProfile = new AccountActiveProfile(keyValues);
  const sessionDeps = { db, cipher, activeProfile, clock };
  const credentials = new AccountCredentialsStore(sessionDeps);
  const hunguSessions = new UUSessionStore(sessionDeps);
  const schoolPortalSessions = new SchoolPortalSessionStore(sessionDeps);

  return {
    cipher,
    keyValues,
    cache: new CacheRepository(db, clock),
    activeProfile,
    credentials,
    hunguSessions,
    schoolPortalSessions,
    accounts: new AccountManager(credentials, activeProfile, hunguSessions),
  };
}

export type StorageServices = ReturnType<typeof createStorageServices>;
