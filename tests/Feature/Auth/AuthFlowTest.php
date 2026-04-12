<?php

use App\Models\KeyValueStore;
use App\Services\UURememberedCredentialsStore;
use App\Services\UUSessionStore;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;

use function Pest\Laravel\assertDatabaseHas;
use function Pest\Laravel\assertDatabaseMissing;
use function Pest\Laravel\get;
use function Pest\Laravel\post;
use function Pest\Laravel\postJson;
use function Pest\Laravel\withCookie;
use function Pest\Laravel\withSession;

it('shows login page', function () {
    $response = get('/login');

    $response->assertSuccessful();
    $response->assertViewIs('app');
});

it('returns error json on invalid login', function () {
    Http::fake([
        'https://uu.nou.edu.tw/xmlapi/index.php?action=login*' => Http::response([
            'code' => 503,
            'message' => 'Auth fail',
            'data' => [],
        ]),
    ]);

    $response = postJson('/login', [
        'username' => 's1234567',
        'password' => 'wrong-password',
    ]);

    $response->assertUnprocessable();
    $response->assertJson([
        'ok' => false,
        'message' => '登入失敗，請確認帳號密碼。',
    ]);
});

it('stores proxy session and remembered credentials after successful login', function () {
    Http::fake([
        'https://uu.nou.edu.tw/' => Http::response('<html/>', 200, [
            'Set-Cookie' => 'PHPSESSID=home; path=/',
        ]),
        'https://uu.nou.edu.tw/learn/index.php' => Http::response('<html/>', 200, [
            'Set-Cookie' => 'WMSESSID=learn; path=/',
        ]),
        'https://uu.nou.edu.tw/xmlapi/index.php?action=login*' => Http::response([
            'code' => 0,
            'message' => 'success',
            'data' => [
                'session_data' => ['ticket' => 'ticket-1'],
                'idx_data' => ['session_idx' => 'idx-1'],
                'login_data' => ['realname' => '測試學生'],
                'cookie_data' => ['WM' => 'cookie-from-payload'],
            ],
        ], 200, [
            'Set-Cookie' => 'APPCOOKIE=app; path=/',
        ]),
        'https://uu.nou.edu.tw/xmlapi/index.php?action=my-profile*' => Http::response([
            'code' => 0,
            'message' => 'success',
            'data' => [
                'username' => 's1234567',
                'realname' => '測試學生',
                'picture' => 'https://uu.nou.edu.tw/avatar.jpg',
            ],
        ]),
    ]);

    $response = postJson('/login', [
        'username' => 's1234567',
        'password' => 'secret',
    ]);

    $response->assertSuccessful();
    $response->assertJson(['ok' => true]);
    $response->assertSessionHas('hungu.profile.username', 's1234567');
    $response->assertSessionHas('hungu.profile.display_name', '測試學生');
    $response->assertSessionHas('hungu.profile.picture', 'https://uu.nou.edu.tw/avatar.jpg');

    assertDatabaseHas('key_value_store', [
        'key' => config('hungu.cookie_name'),
    ]);
    assertDatabaseHas('key_value_store', [
        'key' => config('hungu.remember_credentials_key'),
    ]);
});

it('always remembers credentials after successful login', function () {
    app(UURememberedCredentialsStore::class)->put('s1234567', 'old-password');

    Http::fake([
        'https://uu.nou.edu.tw/' => Http::response('<html/>', 200, [
            'Set-Cookie' => 'PHPSESSID=home; path=/',
        ]),
        'https://uu.nou.edu.tw/learn/index.php' => Http::response('<html/>', 200, [
            'Set-Cookie' => 'WMSESSID=learn; path=/',
        ]),
        'https://uu.nou.edu.tw/xmlapi/index.php?action=login*' => Http::response([
            'code' => 0,
            'message' => 'success',
            'data' => [
                'session_data' => ['ticket' => 'ticket-1'],
                'idx_data' => ['session_idx' => 'idx-1'],
                'login_data' => ['realname' => '測試學生'],
                'cookie_data' => ['WM' => 'cookie-from-payload'],
            ],
        ]),
        'https://uu.nou.edu.tw/xmlapi/index.php?action=my-profile*' => Http::response([
            'code' => 0,
            'message' => 'success',
            'data' => [
                'username' => 's1234567',
                'realname' => '測試學生',
                'picture' => '',
            ],
        ]),
    ]);

    $response = postJson('/login', [
        'username' => 's1234567',
        'password' => 'secret',
    ]);

    $response->assertSuccessful();
    $response->assertJson(['ok' => true]);
    assertDatabaseHas('key_value_store', [
        'key' => config('hungu.remember_credentials_key'),
    ]);
});

it('uses session ticket when fetching profile after login', function () {
    config()->set('hungu.reviewer_base_url', 'https://uu.nou.edu.tw/xmlapi/index.php');

    Http::fake([
        'https://uu.nou.edu.tw/' => Http::response('<html/>', 200, [
            'Set-Cookie' => 'PHPSESSID=home; path=/',
        ]),
        'https://uu.nou.edu.tw/learn/index.php' => Http::response('<html/>', 200, [
            'Set-Cookie' => 'WMSESSID=learn; path=/',
        ]),
        'https://uu.nou.edu.tw/xmlapi/index.php?action=login*' => Http::response([
            'code' => 0,
            'message' => 'success',
            'data' => [
                'session_data' => ['ticket' => 'ticket-from-session-data'],
                'idx_data' => ['session_idx' => 'idx-should-not-be-used'],
                'login_data' => ['realname' => '測試學生'],
                'cookie_data' => ['WM' => 'cookie-from-payload'],
            ],
        ]),
        'https://uu.nou.edu.tw/xmlapi/index.php?action=my-profile*' => Http::response([
            'code' => 0,
            'message' => 'success',
            'data' => [
                'username' => 'reviewer',
                'realname' => '測試學生',
                'picture' => '',
            ],
        ]),
    ]);

    $response = postJson('/login', [
        'username' => 'reviewer',
        'password' => 'secret',
    ]);

    $response->assertSuccessful();
    $response->assertJson(['ok' => true]);

    Http::assertSent(function (Request $request): bool {
        if (! str_contains($request->url(), 'action=my-profile')) {
            return true;
        }

        return str_contains($request->url(), 'ticket=ticket-from-session-data')
            && ! str_contains($request->url(), 'ticket=idx-should-not-be-used');
    });
});

it('renders booting page as SPA shell', function () {
    app(UUSessionStore::class)->put([
        'base_url' => 'https://uu.nou.edu.tw',
        'ua' => (string) config('hungu.user_agent'),
        'ticket' => 'ticket-booting-page',
        'session_idx' => 'idx-booting-page',
        'cookies' => ['WMSESSID' => 'cookie-booting-page'],
        'profile' => [
            'display_name' => '測試學生',
            'username' => 's1234567',
            'picture' => '',
            'realname' => '測試學生',
        ],
    ]);

    $response = get('/auth/booting');

    $response->assertSuccessful();
    $response->assertViewIs('app');
});

it('validates existing session in bootstrap api and queues app boot cookie', function () {
    app(UUSessionStore::class)->put([
        'base_url' => 'https://uu.nou.edu.tw',
        'ua' => (string) config('hungu.user_agent'),
        'ticket' => 'ticket-boot',
        'session_idx' => 'idx-boot',
        'cookies' => ['WMSESSID' => 'cookie-boot'],
        'profile' => [
            'display_name' => '舊名稱',
            'username' => 's1234567',
            'picture' => '',
            'realname' => '舊名稱',
        ],
    ]);

    Http::fake([
        'https://uu.nou.edu.tw/xmlapi/index.php?action=my-profile*' => Http::response([
            'code' => 0,
            'message' => 'success',
            'data' => [
                'username' => 's1234567',
                'realname' => '新名稱',
                'picture' => 'https://uu.nou.edu.tw/new-avatar.jpg',
            ],
        ]),
    ]);

    $response = post('/api/auth/bootstrap-session');

    $response->assertSuccessful();
    $response->assertJson([
        'ok' => true,
        'redirect' => '/courses',
        'nouToolsIntegrationEnabled' => false,
    ]);

    expect(app(UUSessionStore::class)->get())
        ->toBeArray()
        ->and(app(UUSessionStore::class)->get()['profile']['display_name'] ?? null)
        ->toBe('新名稱');
});

it('returns saved onboarding and nou tools preferences in bootstrap api', function () {
    app(UUSessionStore::class)->put([
        'base_url' => 'https://uu.nou.edu.tw',
        'ua' => (string) config('hungu.user_agent'),
        'ticket' => 'ticket-boot-pref',
        'session_idx' => 'idx-boot-pref',
        'cookies' => ['WMSESSID' => 'cookie-boot-pref'],
        'profile' => [
            'display_name' => '測試學生',
            'username' => 's1234567',
            'picture' => '',
            'realname' => '測試學生',
        ],
    ]);

    KeyValueStore::query()->updateOrCreate(
        ['key' => 'preference:onboarding-completed'],
        ['value' => json_encode(['completed' => true], JSON_THROW_ON_ERROR)],
    );

    KeyValueStore::query()->updateOrCreate(
        ['key' => 'preference:nou-tools-integration'],
        ['value' => json_encode(['enabled' => true], JSON_THROW_ON_ERROR)],
    );

    Http::fake([
        'https://uu.nou.edu.tw/xmlapi/index.php?action=my-profile*' => Http::response([
            'code' => 0,
            'message' => 'success',
            'data' => [
                'username' => 's1234567',
                'realname' => '測試學生',
                'picture' => '',
            ],
        ]),
    ]);

    post('/api/auth/bootstrap-session')
        ->assertSuccessful()
        ->assertJson([
            'ok' => true,
            'redirect' => '/courses',
            'nouToolsIntegrationEnabled' => true,
        ]);
});

it('tries remembered credentials when bootstrap api cannot validate current session', function () {
    app(UUSessionStore::class)->put([
        'base_url' => 'https://uu.nou.edu.tw',
        'ua' => (string) config('hungu.user_agent'),
        'ticket' => 'ticket-expired',
        'session_idx' => 'idx-expired',
        'cookies' => ['WMSESSID' => 'cookie-expired'],
        'profile' => [
            'display_name' => '過期使用者',
            'username' => 's9999999',
            'picture' => '',
            'realname' => '過期使用者',
        ],
    ]);

    app(UURememberedCredentialsStore::class)->put('s1234567', 'remembered-secret');

    Http::fake([
        'https://uu.nou.edu.tw/xmlapi/index.php?action=my-profile*' => Http::sequence()
            ->push([
                'code' => 503,
                'message' => 'Auth fail',
                'data' => [],
            ])
            ->push([
                'code' => 0,
                'message' => 'success',
                'data' => [
                    'username' => 's1234567',
                    'realname' => '測試學生',
                    'picture' => 'https://uu.nou.edu.tw/avatar.jpg',
                ],
            ]),
        'https://uu.nou.edu.tw/' => Http::response('<html/>', 200, [
            'Set-Cookie' => 'PHPSESSID=home; path=/',
        ]),
        'https://uu.nou.edu.tw/learn/index.php' => Http::response('<html/>', 200, [
            'Set-Cookie' => 'WMSESSID=learn; path=/',
        ]),
        'https://uu.nou.edu.tw/xmlapi/index.php?action=login*' => Http::response([
            'code' => 0,
            'message' => 'success',
            'data' => [
                'session_data' => ['ticket' => 'ticket-relogin'],
                'idx_data' => ['session_idx' => 'idx-relogin'],
                'login_data' => ['realname' => '測試學生'],
                'cookie_data' => ['WM' => 'cookie-from-payload'],
            ],
        ]),
    ]);

    $response = post('/api/auth/bootstrap-session');

    $response->assertSuccessful();
    $response->assertJson([
        'ok' => true,
        'redirect' => '/courses',
    ]);
    $response->assertCookie(config('hungu.app_boot_cookie_name'));
    $response->assertSessionHas('hungu.profile.username', 's1234567');
    expect(app(UUSessionStore::class)->get())
        ->toBeArray()
        ->and(app(UUSessionStore::class)->get()['profile']['username'] ?? null)
        ->toBe('s1234567');
});

it('returns unauthorized when bootstrap api validation and remembered login both fail', function () {
    app(UUSessionStore::class)->put([
        'base_url' => 'https://uu.nou.edu.tw',
        'ua' => (string) config('hungu.user_agent'),
        'ticket' => 'ticket-expired',
        'session_idx' => 'idx-expired',
        'cookies' => ['WMSESSID' => 'cookie-expired'],
        'profile' => [
            'display_name' => '過期使用者',
            'username' => 's9999999',
            'picture' => '',
            'realname' => '過期使用者',
        ],
    ]);

    app(UURememberedCredentialsStore::class)->put('s1234567', 'wrong-secret');

    Http::fake([
        'https://uu.nou.edu.tw/xmlapi/index.php?action=my-profile*' => Http::response([
            'code' => 503,
            'message' => 'Auth fail',
            'data' => [],
        ]),
        'https://uu.nou.edu.tw/' => Http::response('<html/>', 200, [
            'Set-Cookie' => 'PHPSESSID=home; path=/',
        ]),
        'https://uu.nou.edu.tw/learn/index.php' => Http::response('<html/>', 200, [
            'Set-Cookie' => 'WMSESSID=learn; path=/',
        ]),
        'https://uu.nou.edu.tw/xmlapi/index.php?action=login*' => Http::response([
            'code' => 403,
            'message' => 'invalid account',
            'data' => [],
        ]),
    ]);

    $response = post('/api/auth/bootstrap-session');

    $response->assertJson([
        'ok' => true,
        'redirect' => '/login',
        'nouToolsIntegrationEnabled' => false,
    ]);
    $response->assertSessionMissing('hungu.profile');
    expect(app(UUSessionStore::class)->get())->toBeNull();

    assertDatabaseMissing('key_value_store', [
        'key' => config('hungu.remember_credentials_key'),
    ]);
});

it('can re-login from remembered credentials when session record is missing', function () {
    app(UURememberedCredentialsStore::class)->put('s1234567', 'remembered-secret');

    Http::fake([
        'https://uu.nou.edu.tw/' => Http::response('<html/>', 200, [
            'Set-Cookie' => 'PHPSESSID=home; path=/',
        ]),
        'https://uu.nou.edu.tw/learn/index.php' => Http::response('<html/>', 200, [
            'Set-Cookie' => 'WMSESSID=learn; path=/',
        ]),
        'https://uu.nou.edu.tw/xmlapi/index.php?action=login*' => Http::response([
            'code' => 0,
            'message' => 'success',
            'data' => [
                'session_data' => ['ticket' => 'ticket-from-remembered'],
                'idx_data' => ['session_idx' => 'idx-from-remembered'],
                'login_data' => ['realname' => '記住我使用者'],
                'cookie_data' => ['WM' => 'cookie-from-payload'],
            ],
        ]),
        'https://uu.nou.edu.tw/xmlapi/index.php?action=my-profile*' => Http::response([
            'code' => 0,
            'message' => 'success',
            'data' => [
                'username' => 's1234567',
                'realname' => '記住我使用者',
                'picture' => '',
            ],
        ]),
        'https://uu.nou.edu.tw/xmlapi/index.php?action=my-course-list*' => Http::response([
            'code' => 0,
            'message' => 'success',
            'data' => ['list' => []],
        ]),
    ]);

    $response = withCookie(config('hungu.app_boot_cookie_name'), '1')->get('/courses');

    $response->assertSuccessful();
    $response->assertViewIs('app');
    $response->assertSessionHas('hungu.profile.username', 's1234567');
})->skip('Disabled.');

it('clears cached course list and remembered credentials on logout', function () {
    app(UUSessionStore::class)->put([
        'base_url' => 'https://uu.nou.edu.tw',
        'ua' => (string) config('hungu.user_agent'),
        'ticket' => 'ticket-logout',
        'session_idx' => 'idx-logout',
        'cookies' => ['WMSESSID' => 'cookie-logout'],
        'profile' => [
            'display_name' => '測試學生',
            'username' => 's1234567',
            'picture' => '',
            'realname' => '測試學生',
        ],
    ]);
    app(UURememberedCredentialsStore::class)->put('s1234567', 'remembered-secret');

    Cache::store('database')->put('alt-uu:courses:list:s1234567', [
        ['course_id' => '1001', 'title' => '(114下)行動學習導論-ZZZ001班'],
    ]);
    Cache::store('database')->put('alt-uu:courses:list:s7654321', [
        ['course_id' => '2001', 'title' => '(114下)跨帳號測試課程-ZZZ002班'],
    ]);

    $response = withSession([
        'hungu.profile' => [
            'display_name' => '測試學生',
            'username' => 's1234567',
            'picture' => '',
            'realname' => '測試學生',
        ],
        'hungu.current_course_id' => '1001',
        'alt-uu:courses:node-resources:1001.2001' => [
            'loaded' => true,
            'items' => [['title' => 'cached resource']],
        ],
    ])
        ->postJson('/logout');

    $response->assertSuccessful();
    $response->assertJson(['ok' => true]);
    $response->assertSessionMissing('hungu.profile');
    $response->assertSessionMissing('hungu.current_course_id');
    $response->assertSessionMissing('alt-uu:courses:node-resources:1001.2001');
    expect(Cache::store('database')->has('alt-uu:courses:list:s1234567'))->toBeFalse();
    expect(Cache::store('database')->has('alt-uu:courses:list:s7654321'))->toBeFalse();
    assertDatabaseMissing('key_value_store', [
        'key' => config('hungu.remember_credentials_key'),
    ]);
});
