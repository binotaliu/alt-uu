<?php

declare(strict_types=1);

namespace AltUU\Domains\Moderation\Actions;

use App\Models\BlockedUser;

final readonly class UnblockUser
{
    public function __invoke(string $poster, string $realname): void
    {
        BlockedUser::where('poster', $poster)
            ->where('realname', $realname)
            ->delete();
    }
}
