<?php

declare(strict_types=1);

namespace AltUU\Domains\Moderation\Actions;

use App\Models\BlockedUser;

final readonly class BlockUser
{
    public function __invoke(string $poster, string $realname): BlockedUser
    {
        return BlockedUser::firstOrCreate([
            'poster' => $poster,
            'realname' => $realname,
        ]);
    }
}
