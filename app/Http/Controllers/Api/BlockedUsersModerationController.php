<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api;

use AltUU\Domains\Moderation\Actions\GetBlockedUsers;
use AltUU\Domains\Moderation\ViewModels\BlockedUserViewModel;

final class BlockedUsersModerationController
{
    /**
     * @return array<int, BlockedUserViewModel>
     */
    public function __invoke(GetBlockedUsers $get): array
    {
        return $get();
    }
}
