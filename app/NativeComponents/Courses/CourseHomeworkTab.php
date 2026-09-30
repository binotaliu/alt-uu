<?php

declare(strict_types=1);

namespace App\NativeComponents\Courses;

use App\NativeComponents\Courses\Concerns\OpensAttachmentBrowser;
use Illuminate\View\View;
use Native\Mobile\Edge\NativeComponent;

/**
 * 作業 tab of CourseShow (CourseHomeworkTab.vue).
 *
 * Props: `cid`, `items` (CourseHomeworkItemViewModel[]), `schoolPortalNotices`
 * (SchoolPortalHomeworkNoticeViewModel[]), `loading`, `error`, `errorDetail`.
 * Events: `retry`, `browser-opened` (a homework page was opened in the
 * in-app browser, so the host should refresh when the user returns).
 * School portal attachments use the shared attachment row (download flow).
 */
final class CourseHomeworkTab extends NativeComponent
{
    use OpensAttachmentBrowser;

    public string $cid = '';

    /** @var array<int, mixed> */
    public array $items = [];

    /** @var array<int, mixed> */
    public array $schoolPortalNotices = [];

    public bool $loading = false;

    public string $error = '';

    /** @var array<string, mixed> */
    public array $errorDetail = [];

    public function retry(): void
    {
        $this->emit('retry');
    }

    /**
     * @param  'action'|'result'  $kind
     */
    public function openItem(string $kind, int $index): void
    {
        $item = array_values($this->items)[$index] ?? null;
        $url = $item === null ? null : ($kind === 'result' ? $item->resultUrl : $item->actionUrl);

        if ($url === null || $url === '') {
            return;
        }

        $this->emit('browser-opened');
        $this->openInAttachmentBrowser($url);
    }

    /**
     * The school portal names the file in the `filename` query parameter.
     */
    public function noticeFilename(?string $url, string $fallback): string
    {
        if ($url !== null) {
            parse_str((string) parse_url($url, PHP_URL_QUERY), $query);
            $filename = $query['filename'] ?? null;

            if (is_string($filename) && $filename !== '') {
                return "{$filename}.pdf";
            }
        }

        return $fallback;
    }

    public function hasAnyItems(): bool
    {
        return count($this->items) > 0 || count($this->schoolPortalNotices) > 0;
    }

    public function render(): View
    {
        return view('native.courses.course-homework-tab');
    }
}
