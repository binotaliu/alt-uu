<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api;

use AltUU\Domains\Auth\Actions\GetSessionProfile;
use AltUU\Domains\Auth\ViewModels\SessionProfileViewModel;
use Illuminate\Http\Request;

final class SessionProfileController
{
    public function __invoke(Request $request, GetSessionProfile $getSessionProfile): SessionProfileViewModel
    {
        return $getSessionProfile($request);
    }
}
