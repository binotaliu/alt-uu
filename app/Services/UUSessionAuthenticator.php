<?php

declare(strict_types=1);

namespace App\Services;

use AltUU\Domains\Course\Actions\SyncCurrentCourse;
use Illuminate\Http\Request;
use Illuminate\Support\Arr;

class UUSessionAuthenticator
{
    public function __construct(
        private readonly UUProxyClient $proxyClient,
        private readonly UUProfileSession $profileSession,
        private readonly UUSessionStore $sessionStore,
        private readonly UURememberedCredentialsStore $rememberedCredentialsStore,
    ) {}

    /**
     * @return array{ok: bool, message: string}
     */
    public function attemptLogin(
        Request $request,
        string $username,
        string $password,
    ): array {
        $normalizedUsername = trim($username);
        $baseUrl = $this->resolveBaseUrl($normalizedUsername);
        $ua = (string) config('hungu.user_agent');

        $result = $this->proxyClient->login(
            $baseUrl,
            $ua,
            $normalizedUsername,
            $password,
        );

        $payload = $result['payload'] ?? [];

        if (($payload['code'] ?? 500) !== 0) {
            return [
                'ok' => false,
                'message' => (string) ($payload['message'] ?? '登入失敗，請確認帳號密碼。'),
            ];
        }

        $sessionData = [
            'base_url' => $baseUrl,
            'ua' => $ua,
            'ticket' => $payload['data']['session_data']['ticket'] ?? '',
            'session_idx' => $payload['data']['idx_data']['session_idx'] ?? '',
            'cookies' => $result['cookies'] ?? [],
            'profile' => $this->profileSession->normalize(
                Arr::get($payload, 'data.login_data'),
                $normalizedUsername,
            ) ?? [
                'display_name' => $normalizedUsername,
                'username' => $normalizedUsername,
                'picture' => '',
                'realname' => '',
            ],
        ];

        $this->proxyClient->syncSession($sessionData);
        $this->profileSession->put($request, $sessionData['profile']);

        $this->rememberedCredentialsStore->put($normalizedUsername, $password);

        $this->refreshProfileFromRemote($request, $sessionData, false);

        return [
            'ok' => true,
            'message' => '',
        ];
    }

    public function validateCurrentSession(Request $request): bool
    {
        $session = $this->sessionStore->get();

        if (! is_array($session)) {
            return false;
        }

        return is_array($this->refreshProfileFromRemote($request, $session, true));
    }

    public function attemptRememberedLogin(Request $request): bool
    {
        $credentials = $this->rememberedCredentialsStore->get();

        if (! is_array($credentials)) {
            return false;
        }

        $result = $this->attemptLogin(
            $request,
            $credentials['username'],
            $credentials['password'],
            true,
        );

        if (! $result['ok']) {
            $this->rememberedCredentialsStore->forget();

            return false;
        }

        $currentCourseId = '';

        if ($request->hasSession()) {
            $currentCourseId = (string) $request->session()->get('hungu.current_course_id', '');
        }

        if ($currentCourseId !== '') {
            try {
                app(SyncCurrentCourse::class)($request, $currentCourseId, true);
            } catch (\Throwable $e) {
                report($e);
            }
        }

        return true;
    }

    /**
     * @param  array<string, mixed>  $session
     * @return array<string, mixed>|null
     */
    private function refreshProfileFromRemote(
        Request $request,
        array $session,
        bool $invalidateOnFailure,
    ): ?array {
        $profileResult = $this->proxyClient->request('my-profile');
        $payload = $profileResult['payload'] ?? [];

        if (($payload['code'] ?? 500) !== 0) {
            if ($invalidateOnFailure) {
                $this->sessionStore->forget();
                $this->profileSession->forget($request);
            }

            return null;
        }

        $profile = $this->profileSession->normalize(
            Arr::get($payload, 'data'),
            (string) Arr::get($session, 'profile.username', ''),
        );

        if (! is_array($profile)) {
            if ($invalidateOnFailure) {
                $this->sessionStore->forget();
                $this->profileSession->forget($request);
            }

            return null;
        }

        $session['profile'] = $profile;
        $this->proxyClient->syncSession($session);
        $this->profileSession->put($request, $profile);

        return $session;
    }

    private function resolveBaseUrl(string $username): string
    {
        $reviewerUsername = (string) config('hungu.reviewer_username', 'reviewer');

        if (strcasecmp(trim($username), trim($reviewerUsername)) === 0) {
            return (string) config('hungu.reviewer_base_url', 'https://alt-uu-staging.binota.org/xmlapi/index.php');
        }

        return (string) config('hungu.base_url');
    }
}
