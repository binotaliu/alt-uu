/**
 * Interfaces for platform services injected into core. Each app (mobile, and
 * later TV / desktop) provides its own implementations.
 */

export interface SecureStorage {
    getItem(key: string): Promise<string | null>;
    setItem(key: string, value: string): Promise<void>;
    deleteItem(key: string): Promise<void>;
}

export type SqlValue = string | number | boolean | null | Uint8Array;

/** Minimal SQLite driver surface (backed by expo-sqlite on mobile). */
export interface SqlDatabase {
    execute(sql: string, params?: readonly SqlValue[]): Promise<void>;
    query<Row = Record<string, SqlValue>>(
        sql: string,
        params?: readonly SqlValue[],
    ): Promise<Row[]>;
    transaction<T>(work: () => Promise<T>): Promise<T>;
}

export interface Clock {
    now(): Date;
}

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface Logger {
    log(
        level: LogLevel,
        message: string,
        context?: Record<string, unknown>,
    ): void;
}

export interface DeviceInfo {
    platform: 'ios' | 'android' | 'tvos' | 'macos' | 'windows';
    osVersion: string;
    appVersion: string;
    buildNumber: string | null;
    deviceModel: string | null;
}

export interface FetchRequestInit {
    method?: string;
    headers?: Record<string, string>;
    body?: string | Uint8Array | null;
    redirect?: 'follow' | 'manual' | 'error';
    signal?: AbortSignal;
}

export interface FetchResponse {
    status: number;
    headers: { get(name: string): string | null };
    /** Every Set-Cookie header, kept separate (they cannot be comma-joined). */
    setCookies(): string[];
    text(): Promise<string>;
    arrayBuffer(): Promise<ArrayBuffer>;
}

export type Fetch = (
    url: string,
    init?: FetchRequestInit,
) => Promise<FetchResponse>;
export * from './random';
