<?php

declare(strict_types=1);

namespace AltUU\Domains\Auth\Actions;

use AltUU\Domains\Diagnostics\Actions\ForgetDiagnosticLog;
use App\Services\UUAuthClient;
use Illuminate\Contracts\Session\Session;
use Illuminate\Support\Facades\DB;

final readonly class Logout
{
    public function __construct(
        private UUAuthClient $authClient,
        private ForgetDiagnosticLog $forgetDiagnosticLog,
        private Session $session,
    ) {}

    public function __invoke(): void
    {
        try {
            $this->authClient->logout();
        } finally {
            if ($this->session->isStarted()) {
                $this->session->invalidate();
                $this->session->regenerateToken();
            }

            DB::table('cache')->delete();

            // Signing out means the device may change hands, so drop the
            // request history and close any open recording window rather
            // than letting it keep capturing for the rest of its 30 minutes.
            ($this->forgetDiagnosticLog)(stopRecording: true);
        }
    }
}
