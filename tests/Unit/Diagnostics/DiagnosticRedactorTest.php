<?php

declare(strict_types=1);

use App\Services\Diagnostics\DiagnosticRedactor;

function redactor(string $salt = 'test-salt'): DiagnosticRedactor
{
    return new DiagnosticRedactor($salt);
}

it('drops secret-bearing keys entirely', function (string $key) {
    $result = redactor()->redact([$key => 'super-secret-value']);

    expect($result[$key])->toBe(DiagnosticRedactor::REDACTED)
        ->and($result[$key])->not->toContain('super-secret-value');
})->with([
    'password' => 'password',
    'ticket' => 'ticket',
    'session_idx' => 'session_idx',
    'cookies' => 'cookies',
    'Set-Cookie' => 'Set-Cookie',
    'authorization' => 'authorization',
    'access_token' => 'access_token',
    'refreshToken' => 'refreshToken',
    'apiKey' => 'apiKey',
    'signedPayload' => 'signedPayload',
    'receipt' => 'receipt',
    'APP_KEY' => 'APP_KEY',
]);

it('pseudonymizes personal identifiers instead of dropping them', function (string $key) {
    $result = redactor()->redact([$key => 'u1001']);

    expect($result[$key])->toStartWith('user#')
        ->and($result[$key])->not->toContain('u1001');
})->with(['username', 'studentId', 'displayName', 'nickname', 'email']);

it('keeps our own local account id, which carries no personal information', function () {
    $result = redactor()->redact(['accountId' => 42, 'account_id' => 7]);

    expect($result['accountId'])->toBe(42)
        ->and($result['account_id'])->toBe(7);
});

it('produces a stable handle for the same identifier', function () {
    $redactor = redactor();

    expect($redactor->pseudonymize('u1001'))
        ->toBe($redactor->pseudonymize('u1001'))
        ->and($redactor->pseudonymize('U1001'))
        ->toBe($redactor->pseudonymize('u1001'));
});

it('produces different handles across installs so two reports cannot be correlated', function () {
    expect(redactor('salt-a')->pseudonymize('u1001'))
        ->not->toBe(redactor('salt-b')->pseudonymize('u1001'));
});

it('redacts nested structures recursively', function () {
    $result = redactor()->redact([
        'session' => [
            'ticket' => 'abc123',
            'profile' => ['username' => 'u1001', 'displayName' => '測試教師甲'],
            'cookies' => ['WM' => 'deadbeef'],
        ],
        'status' => 500,
    ]);

    expect($result['session']['ticket'])->toBe(DiagnosticRedactor::REDACTED)
        ->and($result['session']['cookies'])->toBe(DiagnosticRedactor::REDACTED)
        ->and($result['session']['profile']['username'])->toStartWith('user#')
        ->and($result['session']['profile']['displayName'])->toStartWith('user#')
        ->and($result['status'])->toBe(500);
});

it('sweeps secrets out of free-text response bodies', function () {
    $body = '{"code":403,"ticket":"abc123xyz","username":"u1001","message":"access denied"}';

    $result = redactor()->redactText($body);

    expect($result)->not->toContain('abc123xyz')
        ->and($result)->not->toContain('u1001')
        ->and($result)->toContain('access denied')
        ->and($result)->toContain('403');
});

it('pseudonymizes account handles anywhere in free text', function () {
    $result = redactor()->redactText('Login failed for u123456 after 3 attempts');

    expect($result)->not->toContain('u123456')
        ->and($result)->toContain('user#')
        ->and($result)->toContain('after 3 attempts');
});

it('pseudonymizes bare e-mail addresses in free text', function () {
    $result = redactor()->redactText('contact student@nou.edu.tw for details');

    expect($result)->not->toContain('student@nou.edu.tw')
        ->and($result)->toContain('user#');
});

it('strips credential query parameters from urls but keeps the diagnostic part', function () {
    $url = 'https://uu.nou.edu.tw/xmlapi/index.php?action=getCourseList&ticket=SECRET123&ua=Mozilla&page=2';

    $result = redactor()->redactUrl($url);

    expect($result)->not->toContain('SECRET123')
        ->and($result)->toContain('uu.nou.edu.tw/xmlapi/index.php')
        ->and($result)->toContain('action=getCourseList')
        ->and($result)->toContain('page=2');
});

it('leaves an ordinary message untouched', function () {
    $message = '讀取作業列表失敗。';

    expect(redactor()->redactText($message))->toBe($message);
});

it('redactSecrets drops credentials from html source but leaves identifiers and structure alone', function () {
    $html = '<meta name="viewport" content="width=1"><a href="https://uu.nou.edu.tw/x?ticket=abc123&page=2">u</a>'
        .'<script>var cfg = {"password":"hunter2"};</script> user u1001 mail@example.com';

    $result = redactor()->redactSecrets($html);

    expect($result)->toContain('<meta name="viewport"')
        ->toContain('page=2')
        ->toContain('u1001')
        ->toContain('mail@example.com')
        ->not->toContain('abc123')
        ->not->toContain('hunter2');
});

it('redactSecrets returns empty text unchanged', function () {
    expect(redactor()->redactSecrets(''))->toBe('');
});

it('redactText masks a credential in a URL query string inside free text', function () {
    // A failed upstream response body is free text, and links in it carry
    // the school's own ticket. The assignment sweep reads `https:` as a key
    // and swallows the URL, so the query string needs a pass of its own.
    $body = '<a href="https://uu.nou.edu.tw/learn/x.php?ticket=abc123&page=2&session_idx=idx9">go</a>';

    $result = redactor()->redactText($body);

    expect($result)->toContain('page=2')
        ->toContain('uu.nou.edu.tw/learn/x.php')
        ->not->toContain('abc123')
        ->not->toContain('idx9');
});
