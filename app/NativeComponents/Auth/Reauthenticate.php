<?php

declare(strict_types=1);

namespace App\NativeComponents\Auth;

use AltUU\Domains\Account\Actions\ReauthenticateAccount;
use AltUU\Domains\Account\DataTransferObjects\ReauthenticateAccountInputData;
use AltUU\Domains\Account\ViewModels\AccountViewModel;
use App\Models\Account;
use App\Services\NativeSessionGuard;
use Illuminate\Validation\ValidationException;
use Illuminate\View\View;
use Native\Mobile\Edge\NativeComponent;
use Throwable;

/**
 * Native port of pages/Auth/Reauthenticate.vue.
 *
 * Route param `accountId`; optional navigation data `returnTo` (a native URI)
 * is where the user lands after a successful re-login, otherwise the courses
 * tab. The account is loaded with trashed rows because the session guard
 * soft-deletes an account whose remembered login failed.
 */
final class Reauthenticate extends NativeComponent
{
    private const FALLBACK_ERROR = '登入失敗，請稍後再試。';

    public int $accountId = 0;

    public string $password = '';

    public bool $processing = false;

    public string $error = '';

    public string $displayName = '此帳號';

    public string $picture = '';

    public string $returnTo = '';

    public function mount(): void
    {
        $this->accountId = (int) $this->param('accountId');
        $this->returnTo = $this->sanitizeReturnTo($this->data('returnTo'));

        $account = $this->account();

        if ($account === null) {
            $this->replace($this->route('native.login'));

            return;
        }

        $viewModel = AccountViewModel::fromAccount($account, false);

        $this->displayName = $account->nickname ?: ($viewModel->displayName !== '' ? $viewModel->displayName : $account->username);
        $this->picture = $viewModel->picture;
    }

    public function submit(): void
    {
        if ($this->processing) {
            return;
        }

        $account = $this->account();

        if ($account === null) {
            $this->replace($this->route('native.login'));

            return;
        }

        $this->processing = true;
        $this->error = '';

        try {
            $input = ReauthenticateAccountInputData::validateAndCreate(['password' => $this->password]);
            $result = app(ReauthenticateAccount::class)($account, $input);

            if (! $result->ok) {
                $this->error = $result->message !== '' ? $result->message : self::FALLBACK_ERROR;

                return;
            }

            $this->password = '';
            app(NativeSessionGuard::class)->check();
            $this->replace($this->returnTo !== '' ? $this->returnTo : $this->route('native.courses.index'));
        } catch (ValidationException $exception) {
            $this->error = (string) collect($exception->errors())->flatten()->first() ?: self::FALLBACK_ERROR;
        } catch (Throwable) {
            $this->error = self::FALLBACK_ERROR;
        } finally {
            $this->processing = false;
        }
    }

    public function render(): View
    {
        return view('native.auth.reauthenticate');
    }

    private function account(): ?Account
    {
        return Account::withTrashed()->find($this->accountId);
    }

    private function sanitizeReturnTo(mixed $value): string
    {
        if (! is_string($value) || ! str_starts_with($value, '/') || str_starts_with($value, '//')) {
            return '';
        }

        return $value;
    }
}
