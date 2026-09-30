<?php

declare(strict_types=1);

namespace Tests\Feature\Native\Fixtures;

use App\Models\Account;
use App\Services\AccountActiveProfile;
use App\Services\AccountCredentialsStore;
use App\Services\UUSessionStore;

/**
 * Seeds accounts (with or without a live Hungu session) for native tests.
 */
final class AccountSeeding
{
    public static function seed(string $username, bool $withSession = true, ?string $nickname = null): Account
    {
        app(AccountCredentialsStore::class)->put($username, 'test-password');

        /** @var Account $account */
        $account = Account::query()->where('username', $username)->firstOrFail();

        if ($nickname !== null) {
            $account->update(['nickname' => $nickname]);
        }

        if ($withSession) {
            app(UUSessionStore::class)->put([
                'base_url' => 'https://uu.nou.edu.tw',
                'ua' => 'test-agent',
                'ticket' => "ticket-{$username}",
                'session_idx' => "idx-{$username}",
                'cookies' => ['WM' => "cookie-{$username}"],
                'profile' => [
                    'display_name' => "學生 {$username}",
                    'username' => $username,
                    'picture' => '',
                    'realname' => "學生 {$username}",
                ],
            ], $account->id);
        }

        return $account;
    }

    public static function activate(Account $account): void
    {
        app(AccountActiveProfile::class)->set($account->id);
    }
}
