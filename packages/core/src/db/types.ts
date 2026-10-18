import type { BaseSQLiteDatabase } from 'drizzle-orm/sqlite-core';
import type { Schema } from './schema';

/**
 * Drizzle SQLite database the repositories are written against. Mobile
 * provides the expo-sqlite driver, tests use better-sqlite3 (both 'sync').
 */
export type AltUUDatabase = BaseSQLiteDatabase<
  'sync' | 'async',
  unknown,
  Schema
>;
