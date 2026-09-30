<?php

declare(strict_types=1);

namespace App\NativeComponents\Courses;

use AltUU\Domains\SchoolPortal\ViewModels\SchoolPortalClassSessionInfoViewModel;
use AltUU\Domains\SchoolPortal\ViewModels\SchoolPortalExamInfoViewModel;
use Illuminate\View\View;
use Native\Mobile\Edge\NativeComponent;
use Native\Mobile\Facades\Browser;

/**
 * 課程資訊 tab of CourseShow (CourseInfoTab.vue): NOU Tools course detail
 * (when the integration is on) plus the school portal's class session and
 * exam information. There is no HTML in this tab, so it does not need the
 * shared html-content host.
 *
 * Props: `course` (NOU Tools course array, see CourseShow), `nouToolsEnabled`,
 * `classSessionInfo`, `examInfo`, `loading`, `error`, `errorDetail`.
 * Emits `retry`.
 */
final class CourseInfoTab extends NativeComponent
{
    private const string PAST_EXAM_BASE_URL = 'https://noustud.nou.edu.tw/shared_tmp/work/exa/refans/';

    /** @var array<string, mixed>|null */
    public ?array $course = null;

    public bool $nouToolsEnabled = false;

    public ?SchoolPortalClassSessionInfoViewModel $classSessionInfo = null;

    public ?SchoolPortalExamInfoViewModel $examInfo = null;

    public bool $loading = false;

    public string $error = '';

    /** @var array<string, mixed> */
    public array $errorDetail = [];

    public function retry(): void
    {
        $this->emit('retry');
    }

    public function openTextbookLink(): void
    {
        $url = $this->course['textbook']['referenceUrl'] ?? null;

        if (is_string($url) && $url !== '') {
            Browser::inApp($url);
        }
    }

    public function openExamLink(int $examIndex, string $key): void
    {
        $exam = array_values($this->course['previousExams'] ?? [])[$examIndex] ?? null;
        $href = is_array($exam) ? collect($this->examLinks($exam))->firstWhere('key', $key)['href'] ?? null : null;

        if (is_string($href) && $href !== '') {
            Browser::inApp(self::PAST_EXAM_BASE_URL.$href);
        }
    }

    public function hasSchoolPortalInfo(): bool
    {
        return $this->classSessionInfo !== null
            || ($this->examInfo !== null && (count($this->examInfo->schedules) > 0 || count($this->examInfo->scopes) > 0));
    }

    /**
     * @return list<array{label: string, value: string}>
     */
    public function basicInfoLines(): array
    {
        $course = $this->course ?? [];
        $unknown = '未提供';

        return [
            ['label' => '學分型態', 'value' => (string) ($course['creditType'] ?? '') ?: $unknown],
            ['label' => '學分數', 'value' => (string) ($course['credits'] ?? '') ?: $unknown],
            ['label' => '開設學系', 'value' => (string) ($course['department'] ?? '') ?: $unknown],
            ['label' => '課程性質', 'value' => (string) ($course['nature'] ?? '') ?: $unknown],
            ['label' => '期中考日期', 'value' => (string) ($course['midtermDate'] ?? '') ?: $unknown],
            ['label' => '期末考日期', 'value' => (string) ($course['finalDate'] ?? '') ?: $unknown],
            ['label' => '考試時間', 'value' => $this->formatExamTime($course['examTimeStart'] ?? null, $course['examTimeEnd'] ?? null) ?? $unknown],
        ];
    }

    /**
     * @return list<array{label: string, value: string}>
     */
    public function classSessionLines(): array
    {
        $info = $this->classSessionInfo;

        if ($info === null) {
            return [];
        }

        $lines = [];

        foreach ([
            '授課教師' => $info->teacher,
            '班級類型' => $info->classType,
            '上課時間' => self::formatTimeRange($info->classTime),
            '授課班級代碼' => $info->classCode,
        ] as $label => $value) {
            if ($value !== null && $value !== '') {
                $lines[] = ['label' => $label, 'value' => $value];
            }
        }

        $dates = self::formatClassDates($info->classDates);

        if ($dates !== []) {
            $lines[] = ['label' => '授課日期', 'value' => implode("\n", $dates)];
        }

        return $lines;
    }

    /**
     * @param  array<string, mixed>  $exam
     * @return list<array{key: string, label: string, href: string}>
     */
    public function examLinks(array $exam): array
    {
        $links = [];

        foreach ([
            'midterm-a' => ['期中正參', 'midtermReferencePrimary'],
            'midterm-b' => ['期中副參', 'midtermReferenceSecondary'],
            'final-a' => ['期末正參', 'finalReferencePrimary'],
            'final-b' => ['期末副參', 'finalReferenceSecondary'],
        ] as $key => [$label, $field]) {
            if (! empty($exam[$field])) {
                $links[] = ['key' => $key, 'label' => $label, 'href' => (string) $exam[$field]];
            }
        }

        return $links;
    }

    public function formatExamTime(?string $start, ?string $end): ?string
    {
        if (($start === null || $start === '') && ($end === null || $end === '')) {
            return null;
        }

        if ($start !== null && $start !== '' && $end !== null && $end !== '') {
            return "{$start} - {$end}";
        }

        return $start !== null && $start !== '' ? $start : $end;
    }

    /**
     * "1500~1610第5節" becomes "第五節 – 15:00~16:10"; "1900~2050" becomes
     * "19:00~20:50" (port of lib/schoolPortalFormat.ts).
     */
    public static function formatTimeRange(?string $raw): ?string
    {
        if ($raw === null || $raw === '') {
            return null;
        }

        if (! preg_match('/^(\d{2})(\d{2})~(\d{2})(\d{2})(?:第(\d+)節)?$/', $raw, $match)) {
            return $raw;
        }

        $range = "{$match[1]}:{$match[2]}~{$match[3]}:{$match[4]}";

        return isset($match[5]) && $match[5] !== ''
            ? '第'.self::chineseOrdinal((int) $match[5])."節 – {$range}"
            : $range;
    }

    /**
     * "第1次 2026/09/22 第2次 2026/10/20" becomes one entry per session.
     *
     * @return list<string>
     */
    public static function formatClassDates(?string $raw): array
    {
        if ($raw === null || $raw === '') {
            return [];
        }

        preg_match_all('/第\d+次\s*\S+/u', $raw, $matches);

        return $matches[0] !== [] ? array_values($matches[0]) : [$raw];
    }

    private static function chineseOrdinal(int $value): string
    {
        $digits = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九'];

        if ($value < 10) {
            return $digits[$value];
        }

        if ($value < 20) {
            return '十'.($value % 10 === 0 ? '' : $digits[$value % 10]);
        }

        $ones = $value % 10;

        return $digits[intdiv($value, 10)].'十'.($ones === 0 ? '' : $digits[$ones]);
    }

    public function render(): View
    {
        return view('native.courses.course-info-tab');
    }
}
