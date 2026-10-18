<?php

/**
 * Generates the legacy NativePHP SQLite fixtures used by the legacy-migration
 * tests. Runs the real legacy Laravel migrations (current main, and the
 * v1.0.2 release schema that predates the accounts table) and seeds them
 * with data encrypted by Laravel's own Encrypter.
 *
 * Usage (from anywhere; the legacy app is never modified):
 *   php generate-legacy-fixtures.php <legacy-worktree> <output-dir>
 *
 * Keys (also hard-coded in the tests):
 *   current  APP_KEY            = base64 of bytes 0x00..0x1f
 *   previous APP_PREVIOUS_KEYS  = base64 of bytes 0x20..0x3f
 */

declare(strict_types=1);

[$script, $legacyRoot, $outputDir] = $argv + [null, null, null];

if ($legacyRoot === null || $outputDir === null) {
    fwrite(STDERR, "Usage: php {$script} <legacy-worktree> <output-dir>\n");
    exit(1);
}

$legacyRoot = realpath($legacyRoot);
$outputDir = realpath($outputDir);
$currentKey = 'base64:'.base64_encode(implode('', array_map('chr', range(0x00, 0x1F))));
$previousKey = 'base64:'.base64_encode(implode('', array_map('chr', range(0x20, 0x3F))));

$variant = $argv[3] ?? null;

if ($variant === null) {
    // Each variant boots a fresh Laravel process (env + migrations differ).
    foreach (['current', 'v1.0.2'] as $name) {
        passthru(sprintf(
            '%s %s %s %s %s',
            escapeshellarg(PHP_BINARY),
            escapeshellarg(__FILE__),
            escapeshellarg($legacyRoot),
            escapeshellarg($outputDir),
            escapeshellarg($name),
        ), $exitCode);

        if ($exitCode !== 0) {
            exit($exitCode);
        }
    }

    exit(0);
}

$fileName = $variant === 'current' ? 'legacy-current.sqlite' : 'legacy-v1.0.2.sqlite';
$databasePath = $outputDir.'/'.$fileName;
@unlink($databasePath);
touch($databasePath);

$migrationsPath = $legacyRoot.'/database/migrations';

if ($variant === 'v1.0.2') {
    $migrationsPath = sys_get_temp_dir().'/altuu-legacy-v102-'.getmypid();
    @mkdir($migrationsPath, 0777, true);
    passthru(sprintf(
        'git -C %s archive v1.0.2 database/migrations | tar -x -C %s',
        escapeshellarg($legacyRoot),
        escapeshellarg($migrationsPath),
    ));
    $migrationsPath .= '/database/migrations';
}

putenv("APP_KEY={$currentKey}");
putenv("APP_PREVIOUS_KEYS={$previousKey}");
putenv('APP_ENV=testing');
putenv('DB_CONNECTION=sqlite');
putenv("DB_DATABASE={$databasePath}");
putenv('CACHE_STORE=array');
putenv('TELESCOPE_ENABLED=false');

require $legacyRoot.'/vendor/autoload.php';
$app = require $legacyRoot.'/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use Illuminate\Encryption\Encrypter;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;

Artisan::call('migrate', ['--force' => true, '--path' => $migrationsPath, '--realpath' => true]);

$previousEncrypter = new Encrypter(base64_decode(substr($previousKey, 7)), 'AES-256-CBC');

$hunguSession = [
    'base_url' => 'https://uu.nou.edu.tw',
    'ua' => 'AltUU/1.1.0',
    'cookies' => ['WM' => 'wm-cookie', 'idx' => '42'],
    'ticket' => 'ticket-1',
    'session_idx' => 7,
    'profile' => ['username' => 's1111111', 'realname' => '王小明'],
];

$kv = static function (string $key, string $value, string $at = '2026-08-01 08:00:00'): void {
    DB::table('key_value_store')->insert(['key' => $key, 'value' => $value, 'created_at' => $at, 'updated_at' => $at]);
};

if ($variant === 'current') {
    App\Models\Account::query()->create([
        'username' => 's1111111',
        'nickname' => '小明',
        'password' => 'pässword-1',
        'hungu_session' => $hunguSession,
        'school_portal_session' => ['base_url' => 'https://nouapp.nou.edu.tw', 'ua' => 'AltUU/1.1.0', 'cookies' => []],
    ]);
    App\Models\Account::query()->create(['username' => 's2222222', 'password' => 'deleted-pass']);
    App\Models\Account::query()->create(['username' => 's3333333', 'password' => 'placeholder']);

    // Account 2 removed through the app (forget() wipes secrets + soft-deletes).
    DB::table('accounts')->where('id', 2)->update([
        'password' => null, 'hungu_session' => null, 'school_portal_session' => null,
        'deleted_at' => '2026-08-20 09:00:00',
    ]);
    // Account 3 was encrypted with a key that later moved to APP_PREVIOUS_KEYS.
    DB::table('accounts')->where('id', 3)->update([
        'password' => $previousEncrypter->encryptString('rotated-pass-3'),
    ]);
    DB::table('accounts')->update(['created_at' => '2026-07-12 01:02:03', 'updated_at' => '2026-08-15 04:05:06']);

    $kv('account.active_profile', '1');
    $kv('preference:appearance', 'dark');
    $kv('preference:accent-color', 'ocean');
    $kv('preference:nou-tools-integration', '1');
    $kv('preference:screen-reader-enhanced-support', '0');
    $kv('preference:alt-uu-plus-disabled', '0');
    $kv('preference:onboarding-completed', '1');
    $kv('preference:live-sessions-timezone', 'local');
    $kv('preference:live-session-nickname-modal-enabled', '0');
    $kv('preference:cellular-playback-warning-enabled', '1');
    $kv('preference:whats-new-seen-version', '1.1.0');
    $kv('preference:material-html-scale', '1.2');
    $kv('preference:diagnostics-recording-until', json_encode(['until' => '2026-09-01T10:00:00+00:00']));
    $kv('app-status:dismissed', json_encode(['status-1', 'status-2']));
    $kv('moderation:blocked_contents_synced_at', '2026-08-30T12:00:00+00:00');
    $kv('moderation:client_fingerprint', 'fingerprint-abc');
    $kv('subscription:entitlement', json_encode([
        'active' => true, 'productId' => 'plus_monthly', 'expiresAt' => '2026-10-31T00:00:00+00:00',
        'platform' => 'ios', 'reference' => null, 'checkedAt' => '2026-09-01T00:00:00+00:00',
    ]));
    $kv('diagnostics.salt', 'salt-0123456789');
    $kv('unknown:future-key', 'ignored');
    // Leftover from a failed 2026_07_11_091600 run: must be ignored.
    $kv('hungu_remembered_credentials', Crypt::encryptString(json_encode(['username' => 'ghost', 'password' => 'x'])));

    DB::table('playback_progress')->insert([
        ['account_id' => 1, 'cid' => '10001', 'activity_id' => 'act-1', 'duration_seconds' => 120, 'position_seconds' => 61.5, 'media_duration_seconds' => 900.25, 'hungu_upload_success' => 1, 'created_at' => '2026-08-01 15:00:00', 'updated_at' => '2026-08-01 16:30:00'],
        ['account_id' => 1, 'cid' => '10001', 'activity_id' => 'act-2', 'duration_seconds' => 30, 'position_seconds' => 0, 'media_duration_seconds' => null, 'hungu_upload_success' => null, 'created_at' => '2026-08-02 01:00:00', 'updated_at' => '2026-08-02 01:00:00'],
        ['account_id' => 2, 'cid' => '20002', 'activity_id' => 'act-9', 'duration_seconds' => 10, 'position_seconds' => 5, 'media_duration_seconds' => null, 'hungu_upload_success' => 0, 'created_at' => '2026-08-03 01:00:00', 'updated_at' => '2026-08-03 01:00:00'],
        ['account_id' => null, 'cid' => '30003', 'activity_id' => 'act-0', 'duration_seconds' => 5, 'position_seconds' => 2, 'media_duration_seconds' => null, 'hungu_upload_success' => 0, 'created_at' => '2026-06-01 01:00:00', 'updated_at' => '2026-06-01 01:00:00'],
    ]);

    DB::table('account_daily_activities')->insert([
        ['account_id' => 1, 'activity_date' => '2026-08-01', 'total_seconds' => 120, 'created_at' => '2026-08-01 16:30:00', 'updated_at' => '2026-08-01 16:30:00'],
        ['account_id' => 1, 'activity_date' => '2026-08-02', 'total_seconds' => 30, 'created_at' => '2026-08-02 01:00:00', 'updated_at' => '2026-08-02 01:00:00'],
        ['account_id' => 2, 'activity_date' => '2026-08-03', 'total_seconds' => 10, 'created_at' => '2026-08-03 01:00:00', 'updated_at' => '2026-08-03 01:00:00'],
    ]);

    DB::table('diagnostic_events')->insert([
        'occurred_at' => '2026-09-01 10:00:00.123', 'type' => 'request', 'level' => 'info', 'source' => 'server', 'summary' => 'ignored',
    ]);
} else {
    $kv('hungu_remembered_credentials', Crypt::encryptString(json_encode(['username' => ' s0000001 ', 'password' => 'old-pass'])));
    $kv('hungu_session', Crypt::encryptString(json_encode(array_merge($hunguSession, ['profile' => ['username' => 's0000001']]))));
    $kv('preference:appearance', 'light');
    $kv('preference:material-html-scale', '0.9');

    DB::table('playback_progress')->insert([
        // Duplicate (cid, activity_id): the newest updated_at must win.
        ['cid' => '10001', 'activity_id' => 'act-1', 'duration_seconds' => 50, 'position_seconds' => 10, 'hungu_upload_success' => 1, 'created_at' => '2026-05-01 10:00:00', 'updated_at' => '2026-05-01 10:00:00'],
        ['cid' => '10001', 'activity_id' => 'act-1', 'duration_seconds' => 70, 'position_seconds' => 40, 'hungu_upload_success' => 1, 'created_at' => '2026-05-01 17:00:00', 'updated_at' => '2026-05-01 17:00:00'],
        ['cid' => '10002', 'activity_id' => 'act-2', 'duration_seconds' => 20, 'position_seconds' => 15, 'hungu_upload_success' => 0, 'created_at' => '2026-05-02 03:00:00', 'updated_at' => '2026-05-02 03:00:00'],
    ]);
}

DB::table('blocked_contents')->insert([
    ['board_hash' => str_repeat('a', 64), 'node_hash' => str_repeat('b', 64), 'reason' => 'S', 'blocked_at' => '2026-08-10 00:00:00', 'created_at' => '2026-08-10 00:00:01', 'updated_at' => '2026-08-10 00:00:01'],
]);
DB::table('blocked_users')->insert([
    ['poster' => 'u123', 'realname' => '某人', 'created_at' => '2026-08-11 00:00:00', 'updated_at' => '2026-08-11 00:00:00'],
]);
DB::table('attachment_downloads')->insert([
    'cid' => '10001', 'source_url' => 'https://example.test/a.pdf', 'status' => 'completed', 'created_at' => '2026-08-01 00:00:00', 'updated_at' => '2026-08-01 00:00:00',
]);
DB::table('cache')->insert(['key' => 'laravel-cache-x', 'value' => serialize('ignored'), 'expiration' => 2000000000]);

DB::disconnect();
DB::purge();

echo "Wrote {$databasePath}\n";
