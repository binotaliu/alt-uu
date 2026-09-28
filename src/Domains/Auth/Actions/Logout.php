<?php

declare(strict_types=1);

namespace AltUU\Domains\Auth\Actions;

use AltUU\Domains\Diagnostics\Actions\ForgetDiagnosticLog;
use App\Services\UUAuthClient;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

final readonly class Logout
{
    public function __construct(
        private UUAuthClient $authClient,
        private ForgetDiagnosticLog $forgetDiagnosticLog,
    ) {}

    public function __invoke(Request $request): JsonResponse
    {
        try {
            $this->authClient->logout($request);
        } finally {
            if ($request->hasSession()) {
                $request->session()->invalidate();
                $request->session()->regenerateToken();
            }

            DB::table('cache')->delete();

            // Signing out means the device may change hands, so drop the
            // request history and close any open recording window rather
            // than letting it keep capturing for the rest of its 30 minutes.
            ($this->forgetDiagnosticLog)(stopRecording: true);
        }

        return response()->json(['ok' => true]);
    }
}
