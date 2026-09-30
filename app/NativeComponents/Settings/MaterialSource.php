<?php

declare(strict_types=1);

namespace App\NativeComponents\Settings;

use AltUU\Domains\Course\Actions\ListCourses;
use AltUU\Domains\Course\Actions\SyncCurrentCourse;
use AltUU\Domains\Course\ViewModels\CourseItemViewModel;
use AltUU\Domains\Diagnostics\Actions\InspectMaterialDirectory;
use AltUU\Domains\Diagnostics\Actions\InspectMaterialSource;
use App\NativeComponents\Concerns\GuardsHunguSession;
use App\Services\UUCourseClient;
use Illuminate\View\View;
use Native\Mobile\Edge\NativeComponent;
use Symfony\Component\HttpKernel\Exception\HttpExceptionInterface;
use Throwable;

/**
 * Material source inspector (MaterialSource.vue), a dev-flag screen. Pick a
 * course, see the directory the school sent, then open one node to compare the
 * raw page with what `ParseMaterialContent` made of it.
 *
 * The Vue "copy" buttons are dropped (no clipboard bridge, conventions 11.6).
 */
final class MaterialSource extends NativeComponent
{
    use GuardsHunguSession;

    private const array PARSE_KIND_LABELS = [
        'html' => '解析出文字內容',
        'video' => '解析出影片',
        'youtube' => '解析出 YouTube 影片',
        'download' => '判定為檔案下載',
        'empty' => '解析後沒有可顯示的內容',
        'error' => '解析時發生錯誤',
    ];

    /** @var list<array{courseId: string, name: string}> */
    public array $courses = [];

    public bool $loadingCourses = false;

    public ?string $coursesError = null;

    public string $selectedCid = '';

    /** @var array<string, mixed>|null */
    public ?array $directory = null;

    public bool $loadingDirectory = false;

    public ?string $directoryError = null;

    public bool $showRawJson = false;

    /** @var array<string, mixed>|null */
    public ?array $source = null;

    public string $activeScoid = '';

    public bool $loadingSource = false;

    public ?string $sourceError = null;

    public function mount(): void
    {
        if (! config('app.material_source_viewer_enabled')) {
            $this->back();

            return;
        }

        if (! $this->ensureHunguSession()) {
            return;
        }

        $this->loadCourses();
    }

    public function navTitle(): string
    {
        return '教材來源檢視';
    }

    public function onBackPressed(): void
    {
        if ($this->isViewingSource()) {
            $this->backToDirectory();

            return;
        }

        $this->back();
    }

    public function loadCourses(): void
    {
        $this->loadingCourses = true;
        $this->coursesError = null;

        try {
            $this->courses = array_map(
                static fn (CourseItemViewModel $course): array => ['courseId' => $course->courseId, 'name' => $course->name],
                app(ListCourses::class)()->all(),
            );
        } catch (Throwable) {
            $this->coursesError = '載入課程失敗，請稍後再試。';
        } finally {
            $this->loadingCourses = false;
        }
    }

    public function selectCourse(string $cid): void
    {
        $this->selectedCid = $cid;
        $this->directory = null;
        $this->source = null;
        $this->activeScoid = '';
        $this->showRawJson = false;
        $this->directoryError = null;
        $this->sourceError = null;

        $this->loadDirectory();
    }

    public function loadDirectory(): void
    {
        if ($this->selectedCid === '') {
            return;
        }

        $this->loadingDirectory = true;
        $this->directoryError = null;

        try {
            $this->directory = app(InspectMaterialDirectory::class)($this->selectedCid)->toArray();
        } catch (Throwable $e) {
            $this->directory = null;
            $this->directoryError = $this->messageFor($e, '載入教材目錄失敗，請稍後再試。');
        } finally {
            $this->loadingDirectory = false;
        }
    }

    public function inspect(string $scoid): void
    {
        $this->activeScoid = $scoid;
        $this->loadSource();
    }

    public function loadSource(): void
    {
        $this->loadingSource = true;
        $this->sourceError = null;
        $this->source = null;

        try {
            app(SyncCurrentCourse::class)($this->selectedCid);

            $host = parse_url(app(UUCourseClient::class)->currentBaseUrl(), PHP_URL_HOST);

            if (! is_string($host) || $host === '') {
                throw new \RuntimeException('不允許存取外部資源');
            }

            $this->source = app(InspectMaterialSource::class)($this->selectedCid, $this->activeScoid, $host)->toArray();
        } catch (Throwable $e) {
            $this->sourceError = $this->messageFor($e, '載入教材來源失敗，請稍後再試。');
        } finally {
            $this->loadingSource = false;
        }
    }

    public function backToDirectory(): void
    {
        $this->source = null;
        $this->sourceError = null;
        $this->activeScoid = '';
    }

    public function toggleRawJson(): void
    {
        $this->showRawJson = ! $this->showRawJson;
    }

    public function render(): View
    {
        return view('native.settings.material-source', [
            'viewingSource' => $this->isViewingSource(),
            'verdict' => $this->verdict(),
            'parseKindLabels' => self::PARSE_KIND_LABELS,
        ]);
    }

    private function isViewingSource(): bool
    {
        return $this->loadingSource || $this->source !== null || $this->sourceError !== null;
    }

    /**
     * One-line reading of the two halves; it only says what the data shows.
     */
    private function verdict(): ?string
    {
        $source = $this->source;

        if ($source === null) {
            return null;
        }

        $kind = $source['parse']['kind'] ?? null;
        $status = $source['fetchStatus'] ?? null;

        return match (true) {
            ($source['fetchError'] ?? null) !== null => '無法取得學校的頁面，問題出在連線，而不是解析。',
            $status !== null && $status >= 400 => "學校伺服器回應了 {$status}，頁面本身就取不到。",
            $kind === 'error' => 'App 在解析這個頁面時發生錯誤，這是 App 的問題。',
            $kind === 'empty' && ($source['bodyBytes'] ?? 0) === 0 => '學校回傳了空白頁面，App 沒有東西可以顯示。',
            $kind === 'empty' => '學校頁面有內容，但 App 解析後沒有可顯示的部分。請檢視下方原始碼，並將它回報給作者。',
            default => null,
        };
    }

    private function messageFor(Throwable $e, string $fallback): string
    {
        if ($e instanceof HttpExceptionInterface && $e->getMessage() !== '') {
            return $e->getMessage();
        }

        return $fallback;
    }
}
