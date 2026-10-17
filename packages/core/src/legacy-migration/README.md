# Legacy (NativePHP) data migration

On the first launch after upgrading from the NativePHP app (same bundle ids:
iOS `org.binota.alt-uu`, Android `org.binota.alt_uu`), the RN app imports
the old Laravel SQLite database once. The import never blocks start-up:
failures are logged, recorded and retried on the next launch, up to 3
attempts.

## Findings: where NativePHP keeps things

Checked in the `nativephp/mobile` sources for 3.2.2 (v1.0.x releases),
3.3.6 (v1.1.0, current `main`) and 4.5.2 (`feature/no-ref/supernative`).
All three versions agree.

| | iOS | Android |
|---|---|---|
| Database | `<container>/Library/Application Support/database/database.sqlite` (`NativePHPApp.swift` `setupEnvironment`/`createDatabase`, `PersistentPHPRuntime.boot`) | `<dataDir>/app_storage/persisted_data/database/database.sqlite` (`LaravelEnvironment.kt`, `context.getDir("storage")`) |
| APP_KEY | Keychain generic password, `kSecAttrService` = bundle id, `kSecAttrAccount` = `APP_KEY`, `kSecAttrAccessibleWhenUnlockedThisDeviceOnly`, UTF-8 `base64:...` | `<dataDir>/app_storage/persisted_data/appkey.txt` (`base64:...`) |

**The APP_KEY is generated per install on the device.** The build-time
`APP_KEY` from `.env` is never used:

- `config/nativephp.php` `cleanup_env_keys` strips `APP_KEY` (and
  `DB_DATABASE`) from the bundled `.env`.
- NativePHP generates 32 random bytes on first launch, stores them as above
  and exports them through `setenv("APP_KEY")` before Laravel boots. Laravel's
  immutable dotenv repository never overrides an existing env var.
- Android 3.x generated the key with `php artisan key:generate --show`. If
  that failed, it wrote a hard-coded fallback key into `appkey.txt`. Reading
  the file covers both cases.

So the migration must read the device key. An `extra.legacyAppKey`
build-time secret would not help, and putting it into `app.config.ts` would
only leak a secret into the JS bundle. `APP_PREVIOUS_KEYS` is supported by
the decrypter (`readAppKeys` returns a list), but no shipped build set it.

Edge case: after an iOS device-to-device restore, the database comes over
but the `ThisDeviceOnly` Keychain item does not. NativePHP then generated a
new key and the old ciphertexts were already undecryptable in the legacy
app. Those accounts are imported without password/sessions and the user
signs in again.

## Data mapping

Laravel `encrypted` = `Crypt::encryptString($value)` (no serialize) and
`encrypted:array` = `encryptString(json_encode($value))`. The payload is
`base64(JSON {iv, value, mac, tag})`, AES-256-CBC, and
`mac = hex(HMAC-SHA256(key, iv . value))` over the base64 strings
(`laravelEncrypter.ts`). Datetimes are `Y-m-d H:i:s` in UTC
(`config/app.php` timezone) and become epoch-ms `Date`s.

| Legacy | New |
|---|---|
| `accounts` (non-deleted). Soft-deleted rows are skipped. | `accounts`, **same id** when free (otherwise the id is remapped). Password and sessions are re-encrypted with `CredentialCipher` (same purposes as the stores). Sessions go through `fromLegacySession`, and a PHP `[]` cookie list becomes `{}`. An existing account with the same username wins and is reused. |
| `key_value_store` allowlist (`LEGACY_KEY_VALUE_ALLOWLIST`): `account.active_profile` (remapped id), `preference:*` except `diagnostics-recording-until`, `preference:material-html-scale`, `app-status:dismissed`, `moderation:blocked_contents_synced_at`, `moderation:client_fingerprint`, `subscription:entitlement`, `diagnostics.salt` | `key_value_store`, value verbatim (none is encrypted). Existing keys win. |
| `playback_progress` | Same columns. Rows of skipped accounts are dropped. Rows with a `NULL` account are kept. |
| `account_daily_activities` | Same. |
| `blocked_contents`, `blocked_users` | Same. |
| `attachment_downloads`, `diagnostic_events`, `cache`, `sessions`, `jobs`, `telescope_*` | Not migrated (files, logs and caches are rebuilt). |

Users can jump from **any** shipped release. v1.0.x (before 2026-07-11) has
no `accounts` table, so the reader ports the legacy data migrations:

- `091600`: builds an account (id 1, active profile) from the encrypted KV
  `hungu_remembered_credentials`, `hungu_session` and
  `school_portal_session`. When an `accounts` table exists, leftover copies
  of those keys are ignored.
- `113520`: playback rows without `account_id` belong to the only account.
- `150703`: when `account_daily_activities` is missing, daily totals are
  backfilled from playback (Asia/Taipei day of `updated_at`).
- `184036`: playback is de-duplicated per (account, cid, activity), and the
  newest `updated_at` wins.

## Idempotency and failure handling

- All async work happens first: reading, decrypting and re-encrypting. All
  writes then go into one `BEGIN IMMEDIATE … COMMIT` on the new database. The
  status key is written inside that same transaction, so a crash or failure
  leaves nothing behind, and a retry is safe.
- `key_value_store['legacy-migration:nativephp']` holds JSON
  `{status, attempts, updatedAt, summary?, error?}`. `completed` and
  `no-legacy-data` are final. `failed` is retried until `attempts` reaches
  `maxAttempts` (3).
- If the APP_KEY is unreadable or a value fails its MAC, the import still
  goes ahead. Only the affected secrets are dropped (counted in
  `summary.undecryptableValues` and `accountsWithoutPassword`).
- The legacy DB is opened with `PRAGMA query_only = ON`. **It is not
  deleted**, so a later cleanup release can remove
  `Library/Application Support/{database,storage}`, the iOS Keychain
  `APP_KEY` item and Android `app_storage/` once the migration has been out
  for a while.

## Mobile wiring (`apps/mobile/src/platform/legacyDatabase.ts`)

`runLegacyMigrationIfNeeded({ db, clock, cipher, keyValues, bridge, logger })`
works out the legacy path from expo-sqlite's `defaultDatabaseDirectory`
(`resolveNativePhpLegacyLocation`) and opens it with `openDatabaseAsync(name,
{ useNewConnection: true }, directory)`. It needs a native
`LegacyNativePhpBridge`, because expo-secure-store cannot read the iOS item
(it always adds `kSecAttrGeneric` to its queries) and the Android file sits
outside expo's scoped directories. Suggested addition to
`modules/attachment-bridge`:

```swift
// iOS
AsyncFunction("readLegacyNativePhpAppKey") { () -> String? in
  let query: [String: Any] = [
    kSecClass as String: kSecClassGenericPassword,
    kSecAttrService as String: Bundle.main.bundleIdentifier ?? "",
    kSecAttrAccount as String: "APP_KEY",
    kSecReturnData as String: true,
    kSecMatchLimit as String: kSecMatchLimitOne,
  ]
  var result: AnyObject?
  guard SecItemCopyMatching(query as CFDictionary, &result) == errSecSuccess,
        let data = result as? Data else { return nil }
  return String(data: data, encoding: .utf8)
}
AsyncFunction("fileExists") { (path: String) -> Bool in FileManager.default.fileExists(atPath: path) }
```

```kotlin
// Android
AsyncFunction("readLegacyNativePhpAppKey") {
  val file = File(appContext.reactContext!!.getDir("storage", Context.MODE_PRIVATE), "persisted_data/appkey.txt")
  if (file.exists()) file.readText().trim().takeIf { it.startsWith("base64:") } else null
}
AsyncFunction("fileExists") { path: String -> File(path).exists() }
```

Note that `getDir("storage")` creates `app_storage/` when it is missing, which
is harmless. Call it once at start-up, after `openAppDatabase()` and before
any screen reads accounts.

## Fixtures

`__fixtures__/legacy-current.sqlite` (main schema) and
`legacy-v1.0.2.sqlite` (v1.0.2 schema) are real databases built by
`__fixtures__/generate-legacy-fixtures.php`. The script runs the legacy
migrations and seeds data through Laravel's own Encrypter. To regenerate
them:

```sh
php packages/core/src/legacy-migration/__fixtures__/generate-legacy-fixtures.php \
  ../alt-uu-legacy packages/core/src/legacy-migration/__fixtures__
```
