import { Platform } from 'react-native';
import { defaultDatabaseDirectory, openDatabaseAsync } from 'expo-sqlite';
import type {
    AltUUDatabase,
    Clock,
    CredentialCipher,
    KeyValueStoreRepository,
    Logger,
    SqlValue,
} from '@altuu/core';
import {
    resolveNativePhpLegacyLocation,
    runLegacyMigration,
    type LegacyDatabaseHandle,
    type LegacyMigrationOutcome,
} from '@altuu/core';

/**
 * Native access to what the NativePHP app left on the device. The APP_KEY
 * is generated per install by NativePHP and never shipped in the bundle,
 * so it can only be read natively:
 * - iOS: Keychain generic password, service = bundle id
 *   (`org.binota.alt-uu`), account = `APP_KEY`, no `kSecAttrGeneric`
 *   (expo-secure-store always queries with `kSecAttrGeneric`, so it cannot
 *   find this item).
 * - Android: text file `<dataDir>/app_storage/persisted_data/appkey.txt`.
 */
export interface LegacyNativePhpBridge {
    /** The `base64:...` APP_KEY, or null when there is none. */
    readAppKey(): Promise<string | null>;
    /**
     * Optional existence check. Without it, opening a missing legacy DB
     * makes SQLite create an empty file (harmless: it is detected as
     * "no legacy data").
     */
    fileExists?(absolutePath: string): Promise<boolean>;
}

export interface LegacyMigrationServices {
    db: AltUUDatabase;
    clock: Clock;
    cipher: CredentialCipher;
    keyValues: KeyValueStoreRepository;
    bridge: LegacyNativePhpBridge;
    logger?: Logger;
}

/**
 * Imports the NativePHP app's data on the first launch after the upgrade.
 * Call once at startup after the app database is migrated and before any
 * screen reads accounts. Never throws and returns immediately once the
 * migration is recorded as done. The legacy database is opened with
 * `PRAGMA query_only` and is left in place (removed by a later cleanup
 * release).
 */
export function runLegacyMigrationIfNeeded(
    services: LegacyMigrationServices,
): Promise<LegacyMigrationOutcome> {
    const { bridge } = services;

    return runLegacyMigration({
        db: services.db,
        cipher: services.cipher,
        keyValues: services.keyValues,
        clock: services.clock,
        logger: services.logger,
        openLegacyDatabase: () => openLegacyDatabase(bridge),
        readAppKeys: async () => {
            const appKey = await bridge.readAppKey();

            return appKey === null || appKey.trim() === ''
                ? []
                : [appKey.trim()];
        },
    });
}

/** Absolute path of the legacy NativePHP database on this device. */
export function legacyDatabasePath(): string | null {
    const location = resolveLocation();

    return location === null
        ? null
        : `${location.databaseDirectory}/${location.databaseFileName}`;
}

function resolveLocation() {
    if (
        (Platform.OS !== 'ios' && Platform.OS !== 'android') ||
        typeof defaultDatabaseDirectory !== 'string'
    ) {
        return null;
    }

    return resolveNativePhpLegacyLocation(
        Platform.OS,
        defaultDatabaseDirectory,
    );
}

async function openLegacyDatabase(
    bridge: LegacyNativePhpBridge,
): Promise<LegacyDatabaseHandle | null> {
    const location = resolveLocation();

    if (location === null) {
        return null;
    }

    const path = `${location.databaseDirectory}/${location.databaseFileName}`;

    if (bridge.fileExists !== undefined && !(await bridge.fileExists(path))) {
        return null;
    }

    const sqlite = await openDatabaseAsync(
        location.databaseFileName,
        { useNewConnection: true },
        location.databaseDirectory,
    );

    try {
        await sqlite.execAsync('PRAGMA query_only = ON;');
    } catch (error) {
        await sqlite.closeAsync();
        throw error;
    }

    return {
        reader: {
            query: <Row = Record<string, SqlValue>>(
                sql: string,
                params: readonly SqlValue[] = [],
            ) => sqlite.getAllAsync<Row>(sql, [...params]),
        },
        close: () => sqlite.closeAsync(),
    };
}
