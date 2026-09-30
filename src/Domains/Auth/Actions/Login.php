<?php

declare(strict_types=1);

namespace AltUU\Domains\Auth\Actions;

use AltUU\Domains\Auth\Actions\Results\LoginResult;
use AltUU\Domains\Auth\DataTransferObjects\LoginInputData;
use App\Services\UUAuthClient;

final readonly class Login
{
    public function __construct(
        private UUAuthClient $authClient,
    ) {}

    public function __invoke(LoginInputData $input): LoginResult
    {
        $result = $this->authClient->attemptLogin(
            $input->username,
            $input->password,
        );

        if (! $result['ok']) {
            return new LoginResult(
                ok: false,
                message: $this->mapFailedMessage($result['message']),
                raw: $result['raw'] ?? null,
            );
        }

        return new LoginResult(ok: true);
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
