<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api;

use AltUU\Domains\Auth\Actions\GetSessionProfile;
use AltUU\Domains\Auth\ViewModels\SessionProfileViewModel;

final class SessionProfileController
{
    public function __invoke(GetSessionProfile $getSessionProfile): SessionProfileViewModel
    {
        return $getSessionProfile();
    }
}
