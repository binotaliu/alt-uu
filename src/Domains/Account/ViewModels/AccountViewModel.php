<?php

declare(strict_types=1);

namespace AltUU\Domains\Account\ViewModels;

use App\Models\Account;
use Illuminate\Support\Arr;
use Spatie\LaravelData\Resource;
use Spatie\TypeScriptTransformer\Attributes\TypeScript;

#[TypeScript]
final class AccountViewModel extends Resource
{
    public function __construct(
        public int $id,
        public string $username,
        public string $displayName,
        public ?string $nickname,
        public string $picture,
        public bool $isActive,
    ) {}

    public static function fromAccount(Account $account, bool $isActive): self
    {
        $profile = Arr::get($account->hungu_session, 'profile', []);

        return new self(
            id: $account->id,
            username: $account->username,
            displayName: (string) Arr::get($profile, 'display_name', $account->username),
            nickname: $account->nickname,
            picture: (string) Arr::get($profile, 'picture', ''),
            isActive: $isActive,
        );
    }
}
