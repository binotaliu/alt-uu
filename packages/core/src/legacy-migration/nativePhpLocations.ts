/**
 * Where NativePHP Mobile (verified for 3.2.2, 3.3.6 and 4.5.2) keeps the
 * Laravel SQLite database and the per-install APP_KEY. See README.md.
 */
export interface NativePhpLegacyLocation {
    /** Directory holding the legacy `database.sqlite`. */
    databaseDirectory: string;
    databaseFileName: 'database.sqlite';
    /**
     * Android only: file holding the per-install APP_KEY. On iOS the key
     * lives in the Keychain (generic password, service = bundle id,
     * account = `APP_KEY`).
     */
    appKeyFile: string | null;
}

export const NATIVEPHP_DATABASE_FILE_NAME = 'database.sqlite';
export const NATIVEPHP_IOS_KEYCHAIN_ACCOUNT = 'APP_KEY';

/**
 * Derives the legacy locations from expo-sqlite's `defaultDatabaseDirectory`
 * (iOS: `<container>/Documents/SQLite`, Android: `<dataDir>/files/SQLite`),
 * which is the only absolute app path available without extra modules.
 *
 * - iOS: `<container>/Library/Application Support/database/database.sqlite`
 *   (`FileManager.applicationSupportDirectory` + `database/`).
 * - Android: `<dataDir>/app_storage/persisted_data/database/database.sqlite`
 *   (`context.getDir("storage")` + `persisted_data/database/`), key in
 *   `<dataDir>/app_storage/persisted_data/appkey.txt`.
 */
export function resolveNativePhpLegacyLocation(
    platform: 'ios' | 'android',
    defaultDatabaseDirectory: string,
): NativePhpLegacyLocation {
    const sqliteDirectory = stripTrailingSlash(
        defaultDatabaseDirectory.replace(/^file:\/\//, ''),
    );

    if (platform === 'ios') {
        const container = parentOf(parentOf(sqliteDirectory));

        return {
            databaseDirectory: `${container}/Library/Application Support/database`,
            databaseFileName: NATIVEPHP_DATABASE_FILE_NAME,
            appKeyFile: null,
        };
    }

    const storage = `${parentOf(parentOf(sqliteDirectory))}/app_storage/persisted_data`;

    return {
        databaseDirectory: `${storage}/database`,
        databaseFileName: NATIVEPHP_DATABASE_FILE_NAME,
        appKeyFile: `${storage}/appkey.txt`,
    };
}

function stripTrailingSlash(path: string): string {
    return path.replace(/\/+$/, '');
}

function parentOf(path: string): string {
    const index = path.lastIndexOf('/');

    if (index <= 0) {
        throw new Error(`Cannot resolve the parent of "${path}".`);
    }

    return path.slice(0, index);
}
