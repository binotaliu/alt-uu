<?php

declare(strict_types=1);

namespace App\Services;

use Illuminate\Http\Client\Response;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\Http;
use Symfony\Component\HttpFoundation\StreamedResponse;

class UUProxyClient
{
    /**
     * @var (callable(): bool)|null
     */
    private $reauthenticationHandler;

    public function __construct(
        private readonly UUCrypto $crypto,
        private readonly UUSessionStore $sessionStore,
    ) {}

    /**
     * @return array{payload: array<string, mixed>}
     */
    public function request(
        string $action,
        string $method = 'GET',
        array $params = [],
        array|string|null $body = null,
        string $bodyType = 'form',
        bool $canRetryOnForbidden = true,
    ): array {
        $session = $this->currentSession();
        $baseUrl = $this->normalizeBaseUrl((string) Arr::get($session, 'base_url', ''));
        $ua = (string) Arr::get($session, 'ua', config('hungu.user_agent'));
        $ticket = (string) (Arr::get($session, 'ticket') ?: Arr::get($session, 'session_idx'));
        $cookies = Arr::get($session, 'cookies', []);

        $query = array_filter(
            [
                'ticket' => $ticket,
                'ua' => $ua,
                ...$params,
            ],
            static fn ($value): bool => ! in_array($value, [null, ''], true),
        );

        $url = $baseUrl.'/xmlapi/index.php?action='.rawurlencode($action);
        $headers = [
            'accept' => 'application/json,text/plain,*/*',
        ];

        if ($body !== null) {
            $headers['content-type'] = $bodyType === 'json'
                ? 'application/json'
                : 'application/x-www-form-urlencoded; charset=UTF-8';
        }

        $response = $this->baseHttp($baseUrl, $ua, is_array($cookies) ? $cookies : [])
            ->withHeaders($headers)
            ->send(strtoupper($method), $url.'&'.http_build_query($query), [
                'body' => $this->buildBody($body, $bodyType),
            ]);

        $updatedSession = $session;
        $updatedSession['cookies'] = $this->mergeCookies(
            is_array($cookies) ? $cookies : [],
            $this->extractSetCookies($response),
        );
        $this->syncSession($updatedSession);

        $responseBody = $response->json();

        if (
            (
                $response->status() === 403
                || Arr::get($responseBody, 'code') === 403
                || Arr::get($responseBody, 'code') === 1
                || str_contains(strtolower(Arr::get($responseBody, 'message', '')), 'access denied')
            )
            && $canRetryOnForbidden
            && is_callable($this->reauthenticationHandler)
        ) {
            try {
                $reauthenticated = (bool) call_user_func($this->reauthenticationHandler);
            } catch (\Throwable) {
                $reauthenticated = false;
            }

            if ($reauthenticated) {
                return $this->request($action, $method, $params, $body, $bodyType, false);
            }
        }

        return [
            'payload' => $response->json() ?? [],
        ];
    }

    /**
     * Send a request to a non-xmlapi endpoint, such as /mooc/controllers/forum_ajax.php.
     *
     * @return array{payload: array<string, mixed>}
     */
    public function requestOnPath(
        string $path,
        string $method = 'GET',
        array $params = [],
        array|string|null $body = null,
        string $bodyType = 'form',
        bool $canRetryOnForbidden = true,
    ): array {
        $session = $this->currentSession();
        $baseUrl = $this->normalizeBaseUrl((string) Arr::get($session, 'base_url', ''));
        $ua = (string) Arr::get($session, 'ua', config('hungu.user_agent'));
        $ticket = (string) (Arr::get($session, 'ticket') ?: Arr::get($session, 'session_idx'));
        $cookies = Arr::get($session, 'cookies', []);

        $query = array_filter(
            [
                ...$params,
            ],
            static fn ($value): bool => ! in_array($value, [null, ''], true),
        );

        $url = rtrim($baseUrl, '/').'/'.ltrim($path, '/');
        $headers = [
            'accept' => 'application/json,text/plain,*/*',
        ];

        if ($body !== null) {
            $headers['content-type'] = $bodyType === 'json'
                ? 'application/json'
                : 'application/x-www-form-urlencoded; charset=UTF-8';
        }

        $response = $this->baseHttp($baseUrl, $ua, is_array($cookies) ? $cookies : [])
            ->withHeaders($headers)
            ->send(strtoupper($method), $url.'?'.http_build_query($query), [
                'body' => $this->buildBody($body, $bodyType),
            ]);

        $updatedSession = $session;
        $updatedSession['cookies'] = $this->mergeCookies(
            is_array($cookies) ? $cookies : [],
            $this->extractSetCookies($response),
        );
        $this->syncSession($updatedSession);

        if ($response->status() === 403 && $canRetryOnForbidden && is_callable($this->reauthenticationHandler)) {
            try {
                $reauthenticated = (bool) call_user_func($this->reauthenticationHandler);
            } catch (\Throwable) {
                $reauthenticated = false;
            }

            if ($reauthenticated) {
                return $this->requestOnPath($path, $method, $params, $body, $bodyType, false);
            }
        }

        return [
            'payload' => $response->json() ?? [],
        ];
    }

    /**
     * @return array{payload: array<string, mixed>, cookies: array<string, string>}
     */
    public function login(string $baseUrl, string $ua, string $username, string $password): array
    {
        $baseUrl = $this->normalizeBaseUrl($baseUrl);
        $cookies = $this->warmupCookies($baseUrl, $ua);

        $url = rtrim($baseUrl, '/').'/xmlapi/index.php?action=login&ua='.rawurlencode($ua);
        $response = $this->baseHttp($baseUrl, $ua, $cookies)
            ->withHeaders([
                'content-type' => 'application/x-www-form-urlencoded; charset=UTF-8',
                'accept' => '*/*',
            ])
            ->post($url, [
                'username' => $this->crypto->encryptImmediately(trim($username)),
                'password' => $this->crypto->encryptImmediately($password),
                'kickOff' => config('app.debug') ? false : true,
            ]);

        $responseCookies = $this->extractSetCookies($response);
        $payloadData = $response->json() ?? [];
        $cookieData = $this->normalizeCookieData($payloadData['data']['cookie_data'] ?? null);

        return [
            'payload' => $payloadData,
            'cookies' => $this->mergeCookies($cookies, $responseCookies, $cookieData),
        ];
    }

    /**
     * @return array{status: int, body: string, headers: array<string, string>}
     */
    public function fetchMaterialContent(string $url): array
    {
        $session = $this->currentSession();
        $baseUrl = $this->normalizeBaseUrl((string) Arr::get($session, 'base_url', ''));
        $ua = (string) Arr::get($session, 'ua', config('hungu.user_agent'));
        $cookies = Arr::get($session, 'cookies', []);

        $response = $this->baseHttp($baseUrl, $ua, is_array($cookies) ? $cookies : [])
            ->withHeaders([
                'accept' => '*/*',
            ])
            ->get($url);

        $updatedSession = $session;
        $updatedSession['cookies'] = $this->mergeCookies(
            is_array($cookies) ? $cookies : [],
            $this->extractSetCookies($response),
        );
        $this->syncSession($updatedSession);

        return [
            'status' => $response->status(),
            'body' => $response->body(),
            'headers' => [
                'content-type' => (string) $response->header('content-type', 'text/plain; charset=utf-8'),
            ],
        ];
    }

    /**
     * @return array{status: int, body: string, headers: array<string, string>}
     */
    public function fetchCourseLearningTimePage(string $cid): array
    {
        $session = $this->currentSession();
        $baseUrl = $this->normalizeBaseUrl((string) Arr::get($session, 'base_url', ''));

        return $this->fetchMaterialContent(
            $baseUrl.'/learn/last10.php?class_id='.rawurlencode($cid),
        );
    }

    /**
     * @return array{status: int, body: string, headers: array<string, string>}
     */
    public function fetchCourseHomeworkPage(): array
    {
        $session = $this->currentSession();
        $baseUrl = $this->normalizeBaseUrl((string) Arr::get($session, 'base_url', ''));

        return $this->fetchMaterialContent(
            $baseUrl.'/learn/homework/homework_list.php',
        );
    }

    /**
     * @return array{status: int, body: string, headers: array<string, string>}
     */
    public function fetchCourseSelfExamPage(): array
    {
        $session = $this->currentSession();
        $baseUrl = $this->normalizeBaseUrl((string) Arr::get($session, 'base_url', ''));

        return $this->fetchMaterialContent(
            $baseUrl.'/learn/exam/co_self_exam_list.php',
        );
    }

    /**
     * @return array{status: int, body: string, headers: array<string, string>}
     */
    public function fetchPendingHomeworkPage(): array
    {
        $session = $this->currentSession();
        $baseUrl = $this->normalizeBaseUrl((string) Arr::get($session, 'base_url', ''));

        return $this->fetchMaterialContent(
            $baseUrl.'/learn/my_homework.php',
        );
    }

    /**
     * @return array{status: int, body: string, headers: array<string, string>}
     */
    public function fetchUnreadArticlesPage(): array
    {
        $session = $this->currentSession();
        $baseUrl = $this->normalizeBaseUrl((string) Arr::get($session, 'base_url', ''));

        return $this->fetchMaterialContent(
            $baseUrl.'/learn/my_forum.php',
        );
    }

    /**
     * @param  (callable(): bool)|null  $handler
     */
    public function setReauthenticationHandler(?callable $handler): void
    {
        $this->reauthenticationHandler = $handler;
    }

    public function streamMaterialContent(string $url): StreamedResponse
    {
        $session = $this->currentSession();
        $baseUrl = $this->normalizeBaseUrl((string) Arr::get($session, 'base_url', ''));
        $ua = (string) Arr::get($session, 'ua', config('hungu.user_agent'));
        $cookies = Arr::get($session, 'cookies', []);

        $headResponse = $this->baseHttp($baseUrl, $ua, is_array($cookies) ? $cookies : [])
            ->withOptions(['stream' => true])
            ->withHeaders([
                'accept' => '*/*',
            ])
            ->head($url);

        $updatedSession = $session;
        $updatedSession['cookies'] = $this->mergeCookies(
            is_array($cookies) ? $cookies : [],
            $this->extractSetCookies($headResponse),
        );
        $this->syncSession($updatedSession);

        $status = $headResponse->status();
        $contentType = (string) $headResponse->header('content-type') ?: 'application/octet-stream';
        $contentLength = $headResponse->header('content-length');
        $headers = [
            'content-type' => $contentType,
        ];

        if (is_string($contentLength) && trim($contentLength) !== '') {
            $headers['content-length'] = $contentLength;
        }

        return new StreamedResponse(
            function () use ($url, $baseUrl, $ua, $cookies): void {
                $response = $this->baseHttp($baseUrl, $ua, is_array($cookies) ? $cookies : [])
                    ->withOptions(['stream' => true])
                    ->withHeaders([
                        'accept' => '*/*',
                    ])
                    ->get($url);

                $stream = $response->toPsrResponse()->getBody();

                if ($stream->isSeekable()) {
                    $stream->rewind();
                }

                while (! $stream->eof()) {
                    echo $stream->read(8192);

                    if (function_exists('ob_flush')) {
                        @ob_flush();
                    }

                    flush();
                }
            },
            $status,
            $headers,
        );
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

    public function setCookie(string $name, string $value): void
    {
        $session = $this->currentSession();
        $cookies = Arr::get($session, 'cookies', []);

        $cookies[$name] = $value;
        $session['cookies'] = $cookies;

        $this->syncSession($session);
    }

    public function fetchCoursePathTree(): array
    {
        $session = $this->currentSession();
        $baseUrl = $this->normalizeBaseUrl((string) Arr::get($session, 'base_url', ''));

        return $this->fetchMaterialContent($baseUrl.'/learn/path/pathtree.php');
    }

    /**
     * @return array<string, mixed>
     */
    private function currentSession(): array
    {
        $stored = $this->sessionStore->get();

        return is_array($stored) ? $stored : [];
    }

    /**
     * @return array<string, string>
     */
    private function warmupCookies(string $baseUrl, string $ua): array
    {
        $base = rtrim($baseUrl, '/');

        $home = $this->baseHttp($baseUrl, $ua, [])->withHeaders([
            'accept' => 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        ])->get($base.'/');
        $cookies = $this->extractSetCookies($home);

        $learn = $this->baseHttp($baseUrl, $ua, $cookies)->withHeaders([
            'accept' => 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        ])->get($base.'/learn/index.php');

        return $this->mergeCookies($cookies, $this->extractSetCookies($learn));
    }

    /**
     * @param  array<string, string>  $cookies
     */
    private function baseHttp(string $baseUrl, string $ua, array $cookies)
    {
        return Http::timeout(30)
            ->acceptJson()
            ->withHeaders([
                'user-agent' => $ua,
                'origin' => rtrim($baseUrl, '/'),
                'referer' => rtrim($baseUrl, '/').'/learn/index.php',
                'cookie' => $this->cookieHeader($cookies),
            ]);
    }

    private function buildBody(array|string|null $body, string $bodyType): ?string
    {
        if ($body === null) {
            return null;
        }

        if ($bodyType === 'json') {
            if (is_string($body)) {
                return $body;
            }

            return json_encode($body, JSON_THROW_ON_ERROR);
        }

        if (is_string($body)) {
            return $body;
        }

        return http_build_query(array_filter($body, static fn ($value): bool => $value !== null));
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
     * @return array<string, string>
     */
    private function normalizeCookieData(mixed $cookieData): array
    {
        if (! is_array($cookieData)) {
            return [];
        }

        if (Arr::isAssoc($cookieData)) {
            return collect($cookieData)
                ->mapWithKeys(static fn ($value, $key): array => [(string) $key => (string) $value])
                ->all();
        }

        return collect($cookieData)
            ->filter(static fn ($item): bool => is_array($item) && isset($item['name'], $item['value']))
            ->mapWithKeys(static fn ($item): array => [(string) $item['name'] => (string) $item['value']])
            ->all();
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
        $base = rtrim(trim($baseUrl), '/');

        foreach (['/xmlapi/index.php', '/xmlapi'] as $suffix) {
            if (str_ends_with($base, $suffix)) {
                $base = substr($base, 0, -strlen($suffix));

                break;
            }
        }

        return rtrim($base, '/');
    }
}
