<?php

declare(strict_types=1);

namespace AltUU\Domains\Moderation\Actions;

use AltUU\Domains\Moderation\ViewModels\BlockedUserViewModel;
use App\Models\BlockedUser;

final readonly class GetBlockedUsers
{
    /** @return BlockedUserViewModel[] */
    public function __invoke(): array
    {
        return BlockedUser::all()
            ->map(static fn (BlockedUser $user): BlockedUserViewModel => new BlockedUserViewModel(
                poster: $user->poster,
                realname: $user->realname,
            ))
            ->all();
    }
}
