<?php

declare(strict_types=1);

use App\Models\Account;
use App\Models\DiagnosticEvent;
use App\Services\AccountCredentialsStore;
use App\Services\Diagnostics\DiagnosticRecorder;
use App\Services\UUSessionStore;
use Illuminate\Support\Facades\Http;

use function Pest\Laravel\deleteJson;
use function Pest\Laravel\post;

function seedAccountForDiagnosticsCleanup(string $username = 's1234567'): Account
{
    app(AccountCredentialsStore::class)->put($username, 'test-password');

    /** @var Account $account */
    $account = Account::query()->where('username', $username)->firstOrFail();

    app(UUSessionStore::class)->put([
        'base_url' => 'https://uu.nou.edu.tw',
        'ua' => 'test-agent',
        'ticket' => 'ticket-1',
        'session_idx' => 'idx-1',
        'cookies' => ['WM' => 'cookie-1'],
        'profile' => [
            'display_name' => '測試學生',
            'username' => $username,
            'picture' => '',
            'realname' => '測試學生',
        ],
    ], $account->id);

    return $account;
}

function removeAccountForDiagnosticsCleanup(Account $account)
{
    return deleteJson(route('api.accounts.destroy', ['account' => $account->id]));
}

beforeEach(function () {
    enableDiagnosticRecording();
    Http::fake(['*' => Http::response('<html><body></body></html>')]);
});

it('clears the log and closes the recording window on logout', function () {
    DiagnosticEvent::factory()->count(3)->create();

    expect(app(DiagnosticRecorder::class)->recordingExpiresAt())->not->toBeNull();

    post(route('logout'))->assertSuccessful();

    app()->forgetInstance(DiagnosticRecorder::class);

    expect(DiagnosticEvent::count())->toBe(0)
        ->and(app(DiagnosticRecorder::class)->recordingExpiresAt())->toBeNull();
});

it('stops capturing after logout, so the next person is not recorded', function () {
    post(route('logout'))->assertSuccessful();

    app()->forgetInstance(DiagnosticRecorder::class);
    DiagnosticEvent::query()->delete();

    $this->getJson('/api/config')->assertSuccessful();

    expect(DiagnosticEvent::count())->toBe(0);
});

it('clears the accumulated history when an account is removed', function () {
    $account = seedAccountForDiagnosticsCleanup();

    DiagnosticEvent::factory()->count(3)->create(['summary' => 'GET /api/courses']);

    removeAccountForDiagnosticsCleanup($account)->assertSuccessful();

    // Recording is still on, so the removal request itself is recorded on the
    // way out — which is worth keeping, since a misbehaving removal is
    // exactly the thing someone would be diagnosing. What matters is that the
    // history accumulated before it is gone.
    expect(DiagnosticEvent::where('summary', 'GET /api/courses')->exists())->toBeFalse()
        ->and(DiagnosticEvent::pluck('summary')->all())
        ->toBe(['DELETE /api/accounts/'.$account->id]);
});

it('keeps recording running after an account is removed', function () {
    $account = seedAccountForDiagnosticsCleanup();

    removeAccountForDiagnosticsCleanup($account)->assertSuccessful();

    app()->forgetInstance(DiagnosticRecorder::class);

    // Removing an account is itself a plausible thing to be diagnosing, so
    // the window stays open rather than cutting the session short.
    expect(app(DiagnosticRecorder::class)->recordingExpiresAt())->not->toBeNull();
});
