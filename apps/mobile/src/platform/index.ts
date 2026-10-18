import type {
  AltUUDatabase,
  Clock,
  RandomBytes,
  SecureStorage,
} from '@altuu/core';
import { clock } from './clock';
import { openAppDatabase } from './database';
import { random } from './random';
import { secureStorage } from './secureStorage';

export interface MobilePlatform {
  db: AltUUDatabase;
  secureStorage: SecureStorage;
  random: RandomBytes;
  clock: Clock;
}

/**
 * Builds the injected platform services. Async because the database must be
 * opened and migrated first. The fetch implementation is provided separately
 * (see the fetch* files in this folder).
 */
export async function createPlatform(): Promise<MobilePlatform> {
  return { db: await openAppDatabase(), secureStorage, random, clock };
}

export { clock, random, secureStorage, openAppDatabase };
export { fetch } from './fetch';
export { getDeviceInfo } from './deviceInfo';
export { nativePhpBridge, runLegacyMigrationIfNeeded } from './legacyDatabase';
