<?php

declare(strict_types=1);

namespace App\NativeComponents\Auth;

use AltUU\Domains\AppPreference\Actions\GetOnboardingCompleted;
use AltUU\Domains\Auth\Actions\Login as LoginAction;
use AltUU\Domains\Auth\DataTransferObjects\LoginInputData;
use Illuminate\Validation\ValidationException;
use Illuminate\View\View;
use Native\Mobile\Edge\NativeComponent;
use Native\Mobile\Facades\Browser;
use Throwable;

/**
 * Native port of pages/Auth/Login.vue.
 *
 * The password field is `revealable`, which draws the show/hide toggle
 * natively (the revealed state never reaches PHP).
 */
final class Login extends NativeComponent
{
    public const USAGE_POLICY_URL = 'https://alt-uu-statics.wcsvdzeimhwq.workers.dev/usage-policy';

    public const PRIVACY_POLICY_URL = 'https://alt-uu-statics.wcsvdzeimhwq.workers.dev/privacy-policy';

    private const FALLBACK_ERROR = '登入失敗，請稍後再試。';

    public string $username = '';

    public string $password = '';

    public bool $processing = false;

    public string $error = '';

    public ?string $rawResponse = null;

    public bool $showRawResponse = false;

    /**
     * Equivalent of the SPA router guard: a first launch sees onboarding
     * before the login form.
     */
    public function mount(): void
    {
        if (! $this->onboardingCompleted()) {
            $this->replace($this->route('native.onboarding'));
        }
    }

    public function submit(): void
    {
        if ($this->processing) {
            return;
        }

        $this->processing = true;
        $this->error = '';
        $this->rawResponse = null;
        $this->showRawResponse = false;

        try {
            $input = LoginInputData::validateAndCreate([
                'username' => $this->username,
                'password' => $this->password,
            ]);

            $result = app(LoginAction::class)($input);

            if (! $result->ok) {
                $this->error = $result->message !== '' ? $result->message : self::FALLBACK_ERROR;
                $this->rawResponse = $result->raw !== null
                    ? json_encode($result->raw, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) ?: null
                    : null;

                return;
            }

            $this->password = '';
            $this->replace($this->route('native.courses.index'));
        } catch (ValidationException $exception) {
            $this->error = (string) collect($exception->errors())->flatten()->first() ?: self::FALLBACK_ERROR;
        } catch (Throwable) {
            $this->error = self::FALLBACK_ERROR;
        } finally {
            $this->processing = false;
        }
    }

    public function toggleRawResponse(): void
    {
        $this->showRawResponse = ! $this->showRawResponse;
    }

    public function openUsagePolicy(): void
    {
        Browser::inApp(self::USAGE_POLICY_URL);
    }

    public function openPrivacyPolicy(): void
    {
        Browser::inApp(self::PRIVACY_POLICY_URL);
    }

    public function openSettings(): void
    {
        $this->navigate($this->route('native.settings'));
    }

    public function render(): View
    {
        return view('native.auth.login');
    }

    private function onboardingCompleted(): bool
    {
        try {
            return (bool) app(GetOnboardingCompleted::class)();
        } catch (Throwable) {
            return true;
        }
    }
}
