<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api;

use AltUU\Domains\AppPreference\Actions\GetAppearance;
use AltUU\Domains\AppPreference\Actions\GetNouToolsIntegrationEnabled;
use AltUU\Domains\AppPreference\Actions\GetScreenReaderEnhancedSupportEnabled;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

final class AppConfigController
{
    /**
     * @return array<string, mixed>
     */
    public function __invoke(
        Request $request,
        GetAppearance $getAppearance,
        GetNouToolsIntegrationEnabled $getNouToolsEnabled,
        GetScreenReaderEnhancedSupportEnabled $getScreenReaderSupportEnabled,
    ): JsonResponse {
        $isLoggedIn = is_array($request->session()->get('hungu.profile'));

        return response()->json([
            'appearance' => $getAppearance(),
            'nouToolsIntegrationEnabled' => $getNouToolsEnabled(),
            'screenReaderEnhancedSupportEnabled' => $getScreenReaderSupportEnabled(),
            'appName' => config('app.name'),
            'appVersion' => (string) config('nativephp.version', 'unknown'),
            'appVersionCode' => (string) config('nativephp.version_code', 'unknown'),
            'frameworkVersion' => app()->version(),
            'isLoggedIn' => $isLoggedIn,
        ]);
    }
}
