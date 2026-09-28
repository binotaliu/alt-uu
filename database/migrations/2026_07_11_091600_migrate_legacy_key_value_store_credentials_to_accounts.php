<?php

use App\Models\Account;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    private const LEGACY_CREDENTIALS_KEY = 'hungu_remembered_credentials';

    private const LEGACY_HUNGU_SESSION_KEY = 'hungu_session';

    private const LEGACY_SCHOOL_PORTAL_SESSION_KEY = 'school_portal_session';

    private const ACTIVE_PROFILE_KEY = 'account.active_profile';

    /**
     * Run the migrations.
     */
    public function up(): void
    {
        if (! Schema::hasTable('key_value_store')) {
            return;
        }

        $credentials = $this->resolveLegacyCredentials();

        if ($credentials === null) {
            return;
        }

        $account = Account::query()->create([
            'username' => $credentials['username'],
            'password' => $credentials['password'],
            'hungu_session' => $this->resolveLegacySession(self::LEGACY_HUNGU_SESSION_KEY),
            'school_portal_session' => $this->resolveLegacySession(self::LEGACY_SCHOOL_PORTAL_SESSION_KEY),
        ]);

        DB::table('key_value_store')->updateOrInsert(
            ['key' => self::ACTIVE_PROFILE_KEY],
            ['value' => (string) $account->id, 'created_at' => now(), 'updated_at' => now()],
        );

        DB::table('key_value_store')
            ->whereIn('key', [
                self::LEGACY_CREDENTIALS_KEY,
                self::LEGACY_HUNGU_SESSION_KEY,
                self::LEGACY_SCHOOL_PORTAL_SESSION_KEY,
            ])
            ->delete();
    }

    /**
     * Reverse the migrations.
     *
     * One-way data migration normalizing legacy global key_value_store keys
     * into the accounts table; the legacy key format is no longer read by
     * the app.
     */
    public function down(): void
    {
        //
    }

    /**
     * @return array{username: string, password: string}|null
     */
    private function resolveLegacyCredentials(): ?array
    {
        $row = DB::table('key_value_store')->where('key', self::LEGACY_CREDENTIALS_KEY)->first();

        if ($row === null) {
            return null;
        }

        try {
            $decoded = json_decode(Crypt::decryptString($row->value), true, flags: JSON_THROW_ON_ERROR);
        } catch (Throwable) {
            return null;
        }

        if (! is_array($decoded)) {
            return null;
        }

        $username = trim((string) ($decoded['username'] ?? ''));
        $password = (string) ($decoded['password'] ?? '');

        if ($username === '' || $password === '') {
            return null;
        }

        return ['username' => $username, 'password' => $password];
    }

    /**
     * @return array<string, mixed>|null
     */
    private function resolveLegacySession(string $legacyKey): ?array
    {
        $row = DB::table('key_value_store')->where('key', $legacyKey)->first();

        if ($row === null) {
            return null;
        }

        try {
            $decoded = json_decode(Crypt::decryptString($row->value), true, flags: JSON_THROW_ON_ERROR);
        } catch (Throwable) {
            return null;
        }

        return is_array($decoded) ? $decoded : null;
    }
};
