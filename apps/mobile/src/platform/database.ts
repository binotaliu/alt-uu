import { drizzle } from 'drizzle-orm/expo-sqlite';
import { openDatabaseAsync } from 'expo-sqlite';
import {
  migrationBundle,
  runMigrations,
  schema,
  type AltUUDatabase,
} from '@altuu/core';

export const DATABASE_NAME = 'altuu.db';

/**
 * Opens the app database, enables foreign keys and applies pending
 * migrations. Call once at startup, before rendering anything that reads data.
 */
export async function openAppDatabase(): Promise<AltUUDatabase> {
  const sqlite = await openDatabaseAsync(DATABASE_NAME);
  await sqlite.execAsync(
    'PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;',
  );

  const db = drizzle(sqlite, { schema }) as unknown as AltUUDatabase;
  await runMigrations(db, migrationBundle);

  return db;
}
