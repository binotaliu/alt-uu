<?php

declare(strict_types=1);

namespace App\Services;

use Illuminate\Http\Client\Response;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;
use RuntimeException;
use Symfony\Component\DomCrawler\Crawler;

class SchoolPortalProxyClient
{
    /**
     * @var (callable(): bool)|null
     */
    private $reauthenticationHandler;

    public function __construct(
        private readonly SchoolPortalSessionStore $sessionStore,
        private readonly AccountCredentialsStore $accountCredentialsStore,
    ) {}

    public function login(string $username, string $password): bool
    {
        $baseUrl = $this->normalizeBaseUrl($this->resolveBaseUrl($username));
        $ua = (string) config('school_portal.user_agent');

        $loginPage = $this->baseHttp($baseUrl, $ua, [])
            ->withHeaders(['accept' => 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'])
            ->get($baseUrl.'/device/compliant/login/login', ['authority' => 'nou']);

        $cookies = $this->extractSetCookies($loginPage);
        $anticsrf = $this->extractAnticsrf((string) $loginPage->body());

        $loginResponse = $this->baseHttp($baseUrl, $ua, $cookies)
            ->withOptions(['allow_redirects' => false])
            ->asForm()
            ->post($baseUrl.'/device/compliant/login/login', [
                'startOver' => 1,
                'anticsrf' => $anticsrf,
                'authority' => 'nou',
                'loginUser' => trim($username),
                'loginPassword' => $password,
                'agreeTerm' => 1,
            ]);

        $cookies = $this->mergeCookies($cookies, $this->extractSetCookies($loginResponse));

        $sessionCheck = $this->baseHttp($baseUrl, $ua, $cookies)
            ->acceptJson()
            ->get($baseUrl.'/rest/login/session');

        $cookies = $this->mergeCookies($cookies, $this->extractSetCookies($sessionCheck));

        $userId = Arr::get($sessionCheck->json(), 'response.user.userID');

        if ($userId === null || $userId === '') {
            return false;
        }

        $this->syncSession([
            'base_url' => $baseUrl,
            'ua' => $ua,
            'cookies' => $cookies,
        ]);

        return true;
    }

    /**
     * @return array{status: int, body: string}
     */
    public function fetchHtmlPage(string $path, bool $canRetryOnFailure = true): array
    {
        $session = $this->currentSession();
        $baseUrl = $this->normalizeBaseUrl((string) Arr::get($session, 'base_url', $this->resolveBaseUrl()));
        $ua = (string) Arr::get($session, 'ua', config('school_portal.user_agent'));
        $cookies = Arr::get($session, 'cookies', []);

        $response = $this->baseHttp($baseUrl, $ua, is_array($cookies) ? $cookies : [])
            ->withHeaders(['accept' => 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'])
            ->get(rtrim($baseUrl, '/').'/'.ltrim($path, '/'));

        $updatedCookies = $this->mergeCookies(
            is_array($cookies) ? $cookies : [],
            $this->extractSetCookies($response),
        );
        $updatedSession = $session;
        $updatedSession['base_url'] = $baseUrl;
        $updatedSession['ua'] = $ua;
        $updatedSession['cookies'] = $updatedCookies;
        $this->syncSession($updatedSession);

        if ($this->looksLikeLoginPage((string) $response->body()) && $canRetryOnFailure && is_callable($this->reauthenticationHandler)) {
            try {
                $reauthenticated = (bool) call_user_func($this->reauthenticationHandler);
            } catch (\Throwable) {
                $reauthenticated = false;
            }

            if ($reauthenticated) {
                return $this->fetchHtmlPage($path, false);
            }
        }

        return [
            'status' => $response->status(),
            'body' => (string) $response->body(),
        ];
    }

    /**
     * @return array{status: int, mimeType: string, fileSize: int}
     */
    public function downloadToLocalDisk(string $url, string $relativePath): array
    {
        $session = $this->currentSession();
        $baseUrl = $this->normalizeBaseUrl((string) Arr::get($session, 'base_url', $this->resolveBaseUrl()));
        $ua = (string) Arr::get($session, 'ua', config('school_portal.user_agent'));
        $cookies = Arr::get($session, 'cookies', []);

        $response = $this->baseHttp($baseUrl, $ua, is_array($cookies) ? $cookies : [])
            ->withOptions(['stream' => true])
            ->withHeaders(['accept' => '*/*'])
            ->get($url);

        if (! $response->successful()) {
            throw new RuntimeException('下載失敗，HTTP 狀態碼：'.$response->status());
        }

        $disk = Storage::disk('local');
        $directory = dirname($relativePath);
        if ($directory !== '' && $directory !== '.') {
            $disk->makeDirectory($directory);
        }

        $absolutePath = $disk->path($relativePath);
        $fileHandle = fopen($absolutePath, 'wb');

        if ($fileHandle === false) {
            throw new RuntimeException('無法建立附件暫存檔案。');
        }

        $stream = $response->toPsrResponse()->getBody();
        $completed = false;
        $writtenSize = 0;

        try {
            if ($stream->isSeekable()) {
                $stream->rewind();
            }

            while (! $stream->eof()) {
                $chunk = $stream->read(8192);

                if ($chunk === '') {
                    continue;
                }

                $written = fwrite($fileHandle, $chunk);

                if ($written === false) {
                    throw new RuntimeException('寫入附件檔案失敗。');
                }

                $writtenSize += $written;
            }

            $completed = true;
        } finally {
            fclose($fileHandle);

            if (! $completed) {
                $disk->delete($relativePath);
            }
        }

        return [
            'status' => $response->status(),
            'mimeType' => (string) $response->header('content-type', 'application/octet-stream'),
            'fileSize' => $writtenSize,
        ];
    }

    /**
     * @param  (callable(): bool)|null  $handler
     */
    public function setReauthenticationHandler(?callable $handler): void
    {
        $this->reauthenticationHandler = $handler;
    }

    public function hasSession(): bool
    {
        return $this->sessionStore->has();
    }

    /**
     * @param  array<string, mixed>  $session
     */
    public function syncSession(array $session): void
    {
        if ($session === []) {
            return;
        }

        $this->sessionStore->put($session);
    }

    /**
     * @return array<string, mixed>
     */
    private function currentSession(): array
    {
        $stored = $this->sessionStore->get();

        return is_array($stored) ? $stored : [];
    }

    private function extractAnticsrf(string $html): string
    {
        if ($html === '') {
            return '';
        }

        $crawler = new Crawler($html);
        $node = $crawler->filter('input[name="anticsrf"]')->first();

        if ($node->count() === 0) {
            return '';
        }

        return (string) ($node->attr('value') ?? '');
    }

    private function looksLikeLoginPage(string $html): bool
    {
        return $html !== '' && str_contains($html, 'name="loginUser"');
    }

    /**
     * @param  array<string, string>  $cookies
     */
    private function baseHttp(string $baseUrl, string $ua, array $cookies)
    {
        return Http::timeout(30)
            ->withHeaders([
                'user-agent' => $ua,
                'origin' => rtrim($baseUrl, '/'),
                'referer' => rtrim($baseUrl, '/').'/device/compliant/home/',
                'cookie' => $this->cookieHeader($cookies),
            ]);
    }

    /**
     * @param  array<string, string>  ...$sources
     * @return array<string, string>
     */
    private function mergeCookies(array ...$sources): array
    {
        $merged = [];
        foreach ($sources as $source) {
            foreach ($source as $name => $value) {
                $merged[$name] = $value;
            }
        }

        return $merged;
    }

    /**
     * @return array<string, string>
     */
    private function extractSetCookies(Response $response): array
    {
        $cookies = [];
        $headers = $response->toPsrResponse()->getHeader('Set-Cookie');

        foreach ($headers as $header) {
            $firstPair = explode(';', $header)[0] ?? '';
            if (! str_contains($firstPair, '=')) {
                continue;
            }

            [$key, $value] = explode('=', $firstPair, 2);
            $cookies[trim($key)] = trim($value);
        }

        return $cookies;
    }

    /**
     * @param  array<string, string>  $cookies
     */
    private function cookieHeader(array $cookies): string
    {
        return collect($cookies)
            ->map(static fn ($value, $key): string => $key.'='.$value)
            ->implode('; ');
    }

    private function normalizeBaseUrl(string $baseUrl): string
    {
        return rtrim(trim($baseUrl), '/');
    }

    private function resolveBaseUrl(?string $username = null): string
    {
        if ($username === null) {
            $username = (string) ($this->accountCredentialsStore->get()['username'] ?? '');
        }

        $reviewerUsername = (string) config('school_portal.reviewer_username', 'reviewer');

        if ($username !== '' && str_starts_with(trim($username), trim($reviewerUsername))) {
            return (string) config('school_portal.reviewer_base_url');
        }

        return (string) config('school_portal.base_url');
    }
}
