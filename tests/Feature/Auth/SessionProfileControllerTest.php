<?php

use App\Models\Account;
use App\Services\AccountCredentialsStore;
use App\Services\UUSessionStore;

use function Pest\Laravel\getJson;

it('rejects an unauthenticated request', function () {
    getJson('/api/auth/profile')->assertUnauthorized();
});

it('returns the active session profile', function () {
    app(AccountCredentialsStore::class)->put('s1234567', 'test-password');
    app(UUSessionStore::class)->put([
        'base_url' => 'https://uu.nou.edu.tw',
        'ua' => (string) config('hungu.user_agent'),
        'ticket' => 'ticket-1',
        'session_idx' => 'idx-1',
        'cookies' => ['WMSESSID' => 'cookie-1'],
        'profile' => [
            'display_name' => '測試學生',
            'username' => 's1234567',
            'picture' => 'https://uu.nou.edu.tw/avatar.jpg',
            'realname' => '測試學生',
        ],
    ]);

    Account::query()->where('username', 's1234567')->update(['nickname' => '暱稱測試']);

    $response = getJson('/api/auth/profile');

    $response->assertSuccessful();
    $response->assertExactJson([
        'displayName' => '測試學生',
        'nickname' => '暱稱測試',
        'picture' => 'https://uu.nou.edu.tw/avatar.jpg',
        'username' => 's1234567',
    ]);
});
