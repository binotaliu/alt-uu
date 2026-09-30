<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api;

use AltUU\Domains\NouTools\Actions\ListLiveSessions;
use Illuminate\Http\Request;

final class NouToolsLiveSessionsController
{
    /**
     * @return array<int, array<string, mixed>>
     */
    public function __invoke(Request $request, ListLiveSessions $listLiveSessions): array
    {
        return $listLiveSessions($request->boolean('allAccounts'));
    }
}
