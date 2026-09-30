<?php

declare(strict_types=1);

namespace App\NativeComponents\Account;

use AltUU\Domains\SchoolPortal\Actions\GetExamAgenda;
use AltUU\Domains\SchoolPortal\ViewModels\SchoolPortalExamAgendaItemViewModel;
use App\NativeComponents\Concerns\GuardsHunguSession;
use App\NativeComponents\Concerns\ShowsSessionExpiredPicker;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\View\View;
use Native\Mobile\Edge\NativeComponent;
use Symfony\Component\HttpKernel\Exception\HttpExceptionInterface;
use Throwable;

/**
 * Regular exam agenda of the current semester (Account/ExamInfo.vue), grouped
 * by exam kind (期中考 / 期末考 first) and then by date.
 *
 * Error handling matches Grades: offline gets the connectivity message, an
 * expired upstream session (HTTP 401) opens the session picker / reauth flow.
 */
final class ExamInfo extends NativeComponent
{
    use GuardsHunguSession;
    use ShowsSessionExpiredPicker;

    private const array GROUP_ORDER = ['期中考', '期末考'];

    private const array DIGITS = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九'];

    /** @var array<int, SchoolPortalExamAgendaItemViewModel> */
    public array $items = [];

    public bool $loading = true;

    public string $error = '';

    public function navTitle(): string
    {
        return '考試資訊';
    }

    public function mount(): void
    {
        if (! $this->ensureHunguSession()) {
            return;
        }

        $this->loadAgenda();
    }

    public function onResume(): void
    {
        $this->handleSessionExpired();
    }

    public function loadAgenda(): void
    {
        $this->loading = true;
        $this->error = '';

        try {
            $this->items = app(GetExamAgenda::class)();
        } catch (Throwable $exception) {
            $this->items = [];

            if ($exception instanceof HttpExceptionInterface && $exception->getStatusCode() === 401 && $this->handleSessionExpired()) {
                return;
            }

            $this->error = $exception instanceof ConnectionException
                ? '外部服務暫時無法連線，請稍後再試。'
                : '載入考試資訊失敗';
        } finally {
            $this->loading = false;
        }
    }

    protected function onAccountSwitched(int $accountId): void
    {
        $this->loadAgenda();
    }

    /**
     * "期中考(正考)" reads as "期中考": everything in this agenda is a regular
     * exam, so the qualifier is redundant.
     */
    public static function groupLabel(string $category): string
    {
        $label = trim((string) preg_replace('/[（(][^）)]*[）)]\s*$/u', '', $category));

        return $label !== '' ? $label : $category;
    }

    /**
     * Formats "1500~1610第5節" as "第五節 – 15:00~16:10" and "1900~2050" as
     * "19:00~20:50". Unrecognised values pass through unchanged.
     */
    public static function formatTimeRange(?string $raw): ?string
    {
        if ($raw === null || $raw === '') {
            return null;
        }

        if (preg_match('/^(\d{2})(\d{2})~(\d{2})(\d{2})(?:第(\d+)節)?$/u', $raw, $match) !== 1) {
            return $raw;
        }

        $range = "{$match[1]}:{$match[2]}~{$match[3]}:{$match[4]}";

        return isset($match[5]) && $match[5] !== ''
            ? '第'.self::chineseOrdinal((int) $match[5])."節 – {$range}"
            : $range;
    }

    /**
     * @return array<int, array{label: string, dateGroups: array<int, array{date: string, items: array<int, SchoolPortalExamAgendaItemViewModel>}>}>
     */
    public function examGroups(): array
    {
        $byLabel = [];

        foreach ($this->items as $item) {
            $byLabel[self::groupLabel($item->category)][] = $item;
        }

        $labels = [
            ...array_filter(self::GROUP_ORDER, fn (string $label): bool => isset($byLabel[$label])),
            ...array_filter(array_keys($byLabel), fn (string $label): bool => ! in_array($label, self::GROUP_ORDER, true)),
        ];

        return array_map(function (string $label) use ($byLabel): array {
            $byDate = [];

            foreach ($byLabel[$label] as $item) {
                $byDate[$item->date ?? ''][] = $item;
            }

            ksort($byDate, SORT_STRING);

            $dateGroups = [];

            foreach ($byDate as $date => $items) {
                $dateGroups[] = ['date' => (string) $date, 'items' => $items];
            }

            return ['label' => $label, 'dateGroups' => $dateGroups];
        }, array_values($labels));
    }

    public function render(): View
    {
        return view('native.account.exam-info', [
            'groups' => $this->examGroups(),
            'returnTo' => $this->route('native.courses.account.exam-info'),
        ]);
    }

    private static function chineseOrdinal(int $value): string
    {
        if ($value < 10) {
            return self::DIGITS[$value];
        }

        if ($value < 20) {
            return '十'.($value % 10 === 0 ? '' : self::DIGITS[$value % 10]);
        }

        $ones = $value % 10;

        return self::DIGITS[intdiv($value, 10)].'十'.($ones === 0 ? '' : self::DIGITS[$ones]);
    }
}
