<?php

declare(strict_types=1);

namespace App\NativeComponents\Auth;

use AltUU\Domains\Account\Actions\HasAnyAccounts;
use AltUU\Domains\AppConfig\Actions\GetAppConfig;
use AltUU\Domains\AppPreference\Actions\GetNouToolsIntegrationEnabled;
use AltUU\Domains\AppPreference\Actions\UpdateAppPreferences;
use AltUU\Domains\AppPreference\DataTransferObjects\UpdateAppPreferencesInputData;
use Illuminate\View\View;
use Native\Mobile\Edge\NativeComponent;
use Throwable;

/**
 * Native port of pages/Auth/Onboarding.vue: a three slide carousel (swipe or
 * buttons) whose last slide holds the NOU Tools integration switch. Finishing
 * saves `onboardingCompleted` and `whatsNewSeenVersion`, then continues to the
 * courses tab (an account exists) or the login screen.
 */
final class Onboarding extends NativeComponent
{
    public int $currentSlide = 0;

    public bool $nouToolsIntegrationEnabled = false;

    public bool $savingNouToolsIntegration = false;

    public bool $savingOnboarding = false;

    public ?string $errorMessage = null;

    /**
     * @return list<array{id: string, title: string, description: string, note: ?string}>
     */
    public static function slides(): array
    {
        return [
            [
                'id' => 'about',
                'title' => '這是什麼 App？',
                'description' => 'Alt UU 是一款由學生開發的，用於替代網頁版 UU 平台的瀏覽器 App。使用 Alt UU 能讓你在行動裝置上方便地存取 UU 平台的教材，隨時隨地學習。',
                'note' => '備註：你必須擁有有效的 UU 平台帳號，才可以使用本 App。',
            ],
            [
                'id' => 'study-time',
                'title' => '保存學習時數',
                'description' => '選擇教材後，你會在畫面的右上方看到計時器，這個時間表示你本次學習的時數。觀看完畢後，記得點擊左上角的返回按鈕來保存本次的學習時數喔！',
                'note' => null,
            ],
            [
                'id' => 'nou-tools',
                'title' => 'NOU 小幫手整合',
                'description' => 'Alt UU 支援整合「NOU 小幫手」，開啟後即可看到學校行事曆、視訊面授、以及考古題等資訊。',
                'note' => '備註：開啟本功能時，將傳送部分詮釋資料（如課程名稱等）給「NOU 小幫手」，此資料不會與其他人分享，你可以選擇是否要開啟此功能。此功能可於稍後在 App 內的「設定」頁中開啟或關閉。',
            ],
        ];
    }

    public function mount(): void
    {
        try {
            $this->nouToolsIntegrationEnabled = (bool) app(GetNouToolsIntegrationEnabled::class)();
        } catch (Throwable) {
            $this->nouToolsIntegrationEnabled = false;
        }
    }

    public function next(): void
    {
        if ($this->savingOnboarding) {
            return;
        }

        if ($this->currentSlide < count(self::slides()) - 1) {
            $this->currentSlide++;

            return;
        }

        $this->finish();
    }

    public function previous(): void
    {
        if ($this->savingOnboarding) {
            return;
        }

        if ($this->currentSlide > 0) {
            $this->currentSlide--;
        }
    }

    public function goToSlide(int $index): void
    {
        if ($index >= 0 && $index < count(self::slides())) {
            $this->currentSlide = $index;
        }
    }

    /**
     * @param  string  $direction  "left" or "right" as sent by the gesture area
     */
    public function onSwipe(string $direction): void
    {
        if ($this->savingOnboarding) {
            return;
        }

        if ($direction === 'left' && $this->currentSlide < count(self::slides()) - 1) {
            $this->currentSlide++;
        } elseif ($direction === 'right' && $this->currentSlide > 0) {
            $this->currentSlide--;
        }
    }

    public function setNouToolsIntegration(bool $enabled): void
    {
        if ($this->savingNouToolsIntegration) {
            return;
        }

        $this->savingNouToolsIntegration = true;
        $this->errorMessage = null;

        try {
            app(UpdateAppPreferences::class)(UpdateAppPreferencesInputData::from([
                'nouToolsIntegrationEnabled' => $enabled,
            ]));

            $this->nouToolsIntegrationEnabled = $enabled;
        } catch (Throwable) {
            $this->errorMessage = '更新 NOU 小幫手整合失敗，請稍後再試。';
        } finally {
            $this->savingNouToolsIntegration = false;
        }
    }

    public function render(): View
    {
        $slides = self::slides();

        return view('native.auth.onboarding', [
            'slides' => $slides,
            'slide' => $slides[$this->currentSlide],
            'isLastSlide' => $this->currentSlide === count($slides) - 1,
        ]);
    }

    private function finish(): void
    {
        $this->savingOnboarding = true;
        $this->errorMessage = null;

        try {
            $version = app(GetAppConfig::class)()->appVersion;

            app(UpdateAppPreferences::class)(UpdateAppPreferencesInputData::from([
                'onboardingCompleted' => true,
                'whatsNewSeenVersion' => $version,
            ]));

            $target = app(HasAnyAccounts::class)() ? 'native.courses.index' : 'native.login';

            $this->replace($this->route($target));
        } catch (Throwable) {
            $this->errorMessage = '儲存 onboarding 狀態失敗，請稍後再試。';
        } finally {
            $this->savingOnboarding = false;
        }
    }
}
