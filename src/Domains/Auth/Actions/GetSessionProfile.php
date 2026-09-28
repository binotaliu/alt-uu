<?php

declare(strict_types=1);

namespace AltUU\Domains\Auth\Actions;

use AltUU\Domains\Auth\ViewModels\SessionProfileViewModel;
use App\Models\Account;
use App\Services\AccountManager;
use Illuminate\Http\Request;

final readonly class GetSessionProfile
{
    public function __construct(private AccountManager $accounts) {}

    public function __invoke(Request $request): SessionProfileViewModel
    {
        $profile = $request->session()->get('hungu.profile');
        $profile = is_array($profile) ? $profile : [];

        $activeAccountId = $this->accounts->activeId();
        $nickname = $activeAccountId !== null
            ? Account::query()->find($activeAccountId)?->nickname
            : null;

        return new SessionProfileViewModel(
            displayName: $profile['display_name'] ?? null,
            nickname: $nickname,
            picture: $profile['picture'] ?? null,
            username: $profile['username'] ?? null,
        );
    }
}
