<?php

use AltUU\Domains\Course\Support\MaterialProxyUrl;
use App\Services\UUSessionStore;
use Illuminate\Support\Facades\Http;
use Mockery as MockeryManager;
use Native\Mobile\Facades\Device;

use function Pest\Laravel\withCookie;

beforeEach(function () {
    $sessionStore = MockeryManager::mock(UUSessionStore::class);
    $sessionStore->shouldReceive('get')->andReturn([
        'base_url' => 'https://uu.nou.edu.tw',
        'ua' => 'test-agent',
        'ticket' => 'ticket-1',
        'session_idx' => 'idx-1',
        'cookies' => ['WM' => 'cookie', 'PHPSESSID' => 'abc'],
        'profile' => ['display_name' => '測試', 'username' => 's123'],
    ]);
    $sessionStore->shouldReceive('put');
    app()->instance(UUSessionStore::class, $sessionStore);

    Device::shouldReceive('getInfo')->andReturn(json_encode(['platform' => 'ios']));
});

afterEach(function () {
    MockeryManager::close();
});

function materialProxyPath(string $url): string
{
    return route('material.content', ['encodedUrl' => MaterialProxyUrl::encode($url)], absolute: false);
}

function decodeNativeFetchHeader(string $header): array
{
    return json_decode(base64_decode($header, true), true, flags: JSON_THROW_ON_ERROR);
}

it('hands the upstream fetch off to a native shell that supports it', function () {
    Http::fake();

    $response = withCookie(config('hungu.app_boot_cookie_name'), '1')
        ->withHeader('X-Native-Fetch-Supported', '1')
        ->get(materialProxyPath('https://uu.nou.edu.tw/media/lesson-1.mp3'));

    $response->assertOk();
    expect($response->getContent())->toBe('');
    expect(decodeNativeFetchHeader($response->headers->get('X-Native-Fetch')))->toBe([
        'url' => 'https://uu.nou.edu.tw/media/lesson-1.mp3',
        'headers' => [
            'User-Agent' => 'test-agent',
            'Origin' => 'https://uu.nou.edu.tw',
            'Referer' => 'https://uu.nou.edu.tw/learn/index.php',
            'Cookie' => 'WM=cookie; PHPSESSID=abc',
            'Accept' => '*/*',
        ],
    ]);

    Http::assertNothingSent();
});

it('falls back to a base64 body when the native shell does not advertise native fetch', function () {
    Http::fake([
        'uu.nou.edu.tw/*' => Http::response("\x89PNG-bytes", 200, ['Content-Type' => 'image/png']),
    ]);

    $response = withCookie(config('hungu.app_boot_cookie_name'), '1')
        ->get(materialProxyPath('https://uu.nou.edu.tw/images/cover.png'));

    $response->assertOk();
    $response->assertHeader('X-Body-Encoding', 'base64');
    $response->assertHeaderMissing('X-Native-Fetch');
    expect(base64_decode($response->getContent(), true))->toBe("\x89PNG-bytes");
});

it('falls back to a base64 body when native fetch is switched off', function () {
    config(['hungu.material_proxy_native_fetch' => false]);

    Http::fake([
        'uu.nou.edu.tw/*' => Http::response("\x89PNG-bytes", 200, ['Content-Type' => 'image/png']),
    ]);

    $response = withCookie(config('hungu.app_boot_cookie_name'), '1')
        ->withHeader('X-Native-Fetch-Supported', '1')
        ->get(materialProxyPath('https://uu.nou.edu.tw/images/cover.png'));

    $response->assertOk();
    $response->assertHeader('X-Body-Encoding', 'base64');
    $response->assertHeaderMissing('X-Native-Fetch');
});

it('does not hand off fetches for hosts outside the session base url', function () {
    Http::fake();

    withCookie(config('hungu.app_boot_cookie_name'), '1')
        ->withHeader('X-Native-Fetch-Supported', '1')
        ->get(materialProxyPath('https://evil.example.com/media/lesson-1.mp3'))
        ->assertForbidden()
        ->assertHeaderMissing('X-Native-Fetch');

    Http::assertNothingSent();
});
