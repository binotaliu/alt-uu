<?php

declare(strict_types=1);

namespace AltUU\Domains\Diagnostics\Actions;

use AltUU\Domains\Diagnostics\Enums\DiagnosticLevelEnum;
use AltUU\Domains\Diagnostics\ViewModels\DiagnosticBundleViewModel;
use App\Models\DiagnosticEvent;
use App\Services\Diagnostics\DiagnosticRecorder;
use Illuminate\Support\Facades\File;
use Native\Mobile\Facades\System;
use Throwable;

/**
 * Renders the diagnostic log as text the user can paste into a GitHub issue.
 *
 * Plain Markdown rather than JSON on purpose: the destination is an issue
 * body a human will read, and Alt UU is open source, so the whole thing is
 * meant to be readable.
 *
 * Rows were already redacted on the way into the store. Redacting again here
 * is deliberate belt-and-braces: this output is headed somewhere public, and
 * a row written by a future code path that bypassed the recorder would
 * otherwise walk straight out.
 */
final readonly class BuildDiagnosticBundle
{
    public function __construct(private DiagnosticRecorder $recorder) {}

    public function __invoke(): DiagnosticBundleViewModel
    {
        $this->recorder->pruneExpired();

        $sections = [
            $this->header(),
            $this->timeline(),
            $this->nativeLogTail(),
        ];

        return new DiagnosticBundleViewModel(
            filename: 'alt-uu-diagnostics-'.now()->format('Y-m-d-His').'.md',
            content: implode("\n", array_filter($sections)),
        );
    }

    private function header(): string
    {
        $lines = [
            '# Alt UU 診斷記錄',
            '',
            '> 這份記錄中的帳號資訊已以代號取代，密碼、Cookie 與憑證則完全未被記錄。',
            '',
            '| 項目 | 內容 |',
            '| --- | --- |',
            '| 產生時間 | '.now()->toIso8601String().' |',
            '| App 版本 | '.config('nativephp.version', 'unknown').' ('.config('nativephp.version_code', 'unknown').') |',
            '| Laravel | '.app()->version().' |',
            '| PHP | '.PHP_VERSION.' |',
            '| 平台 | '.$this->platform().' |',
            '| 記錄筆數 | '.DiagnosticEvent::query()->count().' |',
        ];

        return implode("\n", $lines)."\n";
    }

    private function timeline(): string
    {
        $events = DiagnosticEvent::query()->orderByDesc('id')->limit(300)->get();

        if ($events->isEmpty()) {
            return "\n## 事件記錄\n\n目前沒有任何記錄。\n";
        }

        $lines = ['', '## 事件記錄（新到舊）', ''];

        foreach ($events as $event) {
            $lines[] = $this->renderEvent($event);
        }

        return implode("\n", $lines)."\n";
    }

    private function renderEvent(DiagnosticEvent $event): string
    {
        $marker = match ($event->level) {
            DiagnosticLevelEnum::Error => '✗',
            DiagnosticLevelEnum::Warning => '!',
            DiagnosticLevelEnum::Info => '·',
        };

        $redactor = $this->recorder->redactor();

        $parts = array_filter([
            $event->occurred_at->format('H:i:s.v'),
            $marker,
            '['.$event->type->value.']',
            $redactor->redactText($event->summary),
            $event->status !== null ? '→ '.$event->status : null,
            $event->duration_ms !== null ? $event->duration_ms.'ms' : null,
            $event->op !== null ? 'op='.$event->op : null,
            $event->request_id !== null ? 'id='.$event->request_id : null,
        ]);

        $line = '- `'.implode(' ', $parts).'`';

        if ($event->context === null || $event->context === []) {
            return $line;
        }

        $encoded = $redactor->redactText((string) json_encode(
            $redactor->redact($event->context),
            JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES,
        ));

        return $line."\n\n  <details><summary>詳細資料</summary>\n\n  ```json\n".
            $this->indent($encoded)."\n  ```\n\n  </details>";
    }

    /**
     * The NativePHP shell writes its own log beside the Laravel storage
     * directory. It is the half of a native crash that PHP never sees, so a
     * report is much more useful with its tail attached.
     */
    private function nativeLogTail(): string
    {
        $bytes = (int) config('diagnostics.native_log_tail_bytes', 16384);

        if ($bytes <= 0) {
            return '';
        }

        $path = dirname(storage_path()).DIRECTORY_SEPARATOR.'nativephp_debug.log';

        try {
            if (! File::exists($path)) {
                return '';
            }

            $contents = (string) File::get($path);
        } catch (Throwable) {
            return '';
        }

        if ($contents === '') {
            return '';
        }

        $tail = mb_strlen($contents) > $bytes
            ? '…（已截斷）'.mb_substr($contents, -$bytes)
            : $contents;

        return "\n## NativePHP 原生記錄（尾端）\n\n```\n".
            $this->recorder->redactor()->redactText($tail)."\n```\n";
    }

    private function platform(): string
    {
        try {
            return match (true) {
                System::isIos() => 'iOS',
                System::isAndroid() => 'Android',
                default => 'Web',
            };
        } catch (Throwable) {
            return 'Web';
        }
    }

    private function indent(string $text): string
    {
        return implode("\n", array_map(
            static fn (string $line): string => $line === '' ? $line : '  '.$line,
            explode("\n", $text),
        ));
    }
}
