<?php

declare(strict_types=1);

namespace App\NativeComponents\Courses\Discuss;

use AltUU\AttachmentBridge\Facades\AttachmentBridge;
use AltUU\Domains\Discuss\ViewModels\AttachmentViewModel;
use AltUU\Domains\Discuss\ViewModels\PostViewModel;
use AltUU\Domains\Discuss\ViewModels\WhisperViewModel;
use App\NativeComponents\Support\AttachmentKind;
use Illuminate\View\View;
use Native\Mobile\Edge\NativeComponent;
use Native\Mobile\Facades\Browser;

/**
 * One floor of a discussion thread (port of the `<article>` in
 * DiscussThread.vue): header with like, the post body, attachments, whispers
 * and the report / block row. It also renders the two blocked states (reported
 * content and blocked user).
 *
 * The card owns no data changes; it emits and the screen acts:
 *  - `like` (node, liked), `reveal` (node), `report` (node)
 *  - `block` (poster, realname), `unblock` (poster, realname)
 *  - `whisper-add` (node, floor), `whisper-edit` (node, wid, text), `whisper-delete` (node, wid)
 *  - `open-image` (local path, alt)
 * Link taps inside the post are handled here: tronclass -> AttachmentBridge,
 * mailto/tel -> system, school files / material-proxy URLs -> an inline
 * download row, everything else -> the in-app browser.
 *
 * Tag: `<native:discuss-post-card key="post-{{ $post->floor }}" :post="$post" :index="$i" cid="{{ $cid }}" board-id="{{ $bid }}" appearance="{{ $appearance }}" :user-blocked="..." :revealed="..." ... />`
 */
final class DiscussPostCard extends NativeComponent
{
    public ?PostViewModel $post = null;

    public int $index = 0;

    public string $cid = '';

    public string $boardId = '';

    public string $appearance = 'auto';

    public ?string $baseUrl = null;

    public bool $userBlocked = false;

    public bool $revealed = false;

    /** Why the post is hidden, already mapped to the Chinese label. */
    public string $blockedReasonLabel = '其他';

    public ?string $linkDownloadHref = null;

    public string $linkDownloadName = '';

    public function like(): void
    {
        if ($this->post?->node === null) {
            return;
        }

        $this->emit('like', $this->post->node, $this->post->liked);
    }

    public function reveal(): void
    {
        if ($this->post?->node !== null) {
            $this->emit('reveal', $this->post->node);
        }
    }

    public function report(): void
    {
        if ($this->post?->node !== null) {
            $this->emit('report', $this->post->node);
        }
    }

    public function block(): void
    {
        if ($this->post?->poster !== null && $this->post->realname !== null) {
            $this->emit('block', $this->post->poster, $this->post->realname);
        }
    }

    public function unblock(): void
    {
        if ($this->post?->poster !== null && $this->post->realname !== null) {
            $this->emit('unblock', $this->post->poster, $this->post->realname);
        }
    }

    public function addWhisper(): void
    {
        if ($this->post?->node !== null) {
            $this->emit('whisper-add', $this->post->node, $this->floor());
        }
    }

    public function editWhisper(string $whisperId): void
    {
        $whisper = $this->whisperById($whisperId);

        if ($whisper !== null && $this->post?->node !== null) {
            $this->emit('whisper-edit', $this->post->node, $whisperId, PostText::whisper($whisper->content));
        }
    }

    public function deleteWhisper(string $whisperId): void
    {
        if ($this->whisperById($whisperId) !== null && $this->post?->node !== null) {
            $this->emit('whisper-delete', $this->post->node, $whisperId);
        }
    }

    public function openImage(string $path, string $alt): void
    {
        $this->emit('open-image', $path, $alt);
    }

    public function openExternal(string $url): void
    {
        $download = PostText::downloadTarget($url, $this->baseUrl);

        if ($download !== null) {
            $this->linkDownloadHref = $download['href'];
            $this->linkDownloadName = $download['filename'];

            return;
        }

        Browser::inApp($url);
    }

    public function dismissLinkDownload(): void
    {
        $this->linkDownloadHref = null;
        $this->linkDownloadName = '';
    }

    public function openTronclass(string $url): void
    {
        AttachmentBridge::openTronclass($url);
    }

    public function openSystem(string $url): void
    {
        Browser::open($url);
    }

    public function floor(): int
    {
        return $this->post?->floor ?? $this->index + 1;
    }

    public function author(): string
    {
        $name = $this->post?->realname ?? $this->post?->poster;

        return $name !== null && $name !== '' ? $name : '匿名';
    }

    /**
     * @return array<int, AttachmentViewModel>
     */
    public function imageAttachments(): array
    {
        return array_values(array_filter(
            $this->post?->attachments ?? [],
            fn (AttachmentViewModel $attachment): bool => $attachment->href !== null
                && $attachment->href !== ''
                && AttachmentKind::isImage($attachment->filename, $attachment->href),
        ));
    }

    /**
     * @return array<int, AttachmentViewModel>
     */
    public function fileAttachments(): array
    {
        return array_values(array_filter(
            $this->post?->attachments ?? [],
            fn (AttachmentViewModel $attachment): bool => ! ($attachment->href !== null
                && $attachment->href !== ''
                && AttachmentKind::isImage($attachment->filename, $attachment->href)),
        ));
    }

    public function showWhispers(): bool
    {
        return $this->index !== 0 || ($this->post?->whisperCount ?? 0) > 0 || ($this->post?->whispers ?? []) !== [];
    }

    public function render(): View
    {
        $plain = PostText::plain($this->post?->content);

        return view('native.courses.discuss.discuss-post-card', [
            'plainText' => $plain,
            'blockedByReport' => $this->post !== null && $this->post->isBlocked && $this->post->node !== null && ! $this->revealed,
        ]);
    }

    private function whisperById(string $whisperId): ?WhisperViewModel
    {
        foreach ($this->post?->whispers ?? [] as $whisper) {
            if ($whisper->wid === $whisperId) {
                return $whisper;
            }
        }

        return null;
    }
}
