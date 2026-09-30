<?php

declare(strict_types=1);

namespace App\NativeComponents\Courses;

use Illuminate\View\View;
use Native\Mobile\Edge\NativeComponent;

/**
 * Nickname reminder shown before entering a classroom
 * (LiveSessionNicknameModalDialog.vue).
 *
 * Tag: `<native:live-session-nickname-sheet key="nickname" :visible="$nicknameSheetVisible" :nickname="$pendingNickname" :url="$pendingUrl" :email="$pendingEmail" @close="closeNicknameSheet" @entered="confirmNickname" />`
 *
 * Props: `visible`, `nickname`, `url`, `email`. Events: `close`, `entered`.
 * REQUIRED host action: set `visible` false on `close` and `entered`.
 *
 * There is no clipboard bridge, so the copy buttons of the web dialog become
 * read-only fields whose text the user can select and copy natively.
 */
final class LiveSessionNicknameSheet extends NativeComponent
{
    public bool $visible = false;

    public string $nickname = '';

    public string $url = '';

    public string $email = '';

    public bool $showMoreInfo = false;

    public function toggleMoreInfo(): void
    {
        $this->showMoreInfo = ! $this->showMoreInfo;
    }

    public function close(): void
    {
        $this->emit('close');
    }

    public function enter(): void
    {
        $this->emit('entered');
    }

    public function render(): View
    {
        $fields = [['key' => 'nickname', 'label' => '顯示暱稱', 'value' => $this->nickname]];

        if ($this->showMoreInfo && $this->url !== '') {
            $fields[] = ['key' => 'url', 'label' => '教室連結', 'value' => $this->url];
        }

        if ($this->showMoreInfo && $this->email !== '') {
            $fields[] = ['key' => 'email', 'label' => '電子郵件', 'value' => $this->email];
        }

        return view('native.courses.live-session-nickname-sheet', ['fields' => $fields]);
    }
}
