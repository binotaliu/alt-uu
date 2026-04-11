<?php

declare(strict_types=1);

namespace AltUU\Domains\Auth\Actions;

use AltUU\Domains\Auth\DataTransferObjects\LoginInputData;
use App\Services\UUAuthClient;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

final readonly class Login
{
    public function __construct(
        private UUAuthClient $authClient,
    ) {}

    public function __invoke(Request $request, LoginInputData $input): JsonResponse
    {
        $result = $this->authClient->attemptLogin(
            $request,
            $input->username,
            $input->password,
        );

        if (! $result['ok']) {
            $message = $this->mapFailedMessage($result['message']);

            return response()->json(['ok' => false, 'message' => $message], 422);
        }

        $this->queueAppBootCookie();

        return response()->json(['ok' => true]);
    }

    private function queueAppBootCookie(): void
    {
        cookie()->queue(cookie(
            $this->appBootCookieName(),
            '1',
            (int) config('hungu.cookie_minutes', 720),
        ));
    }

    private function appBootCookieName(): string
    {
        return (string) config('hungu.app_boot_cookie_name', 'hungu_app_boot');
    }

    private function mapFailedMessage(?string $sourceMessage): string
    {
        return match ($sourceMessage) {
            'Auth fail::loginType:wm',
            'Auth fail' => '登入失敗，請確認帳號密碼。',
            default => '登入失敗，請稍後再試。',
        };
    }
}
