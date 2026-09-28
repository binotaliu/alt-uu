<?php

declare(strict_types=1);

namespace AltUU\Domains\DataPortability\ViewModels;

use App\Models\AccountDailyActivity;
use DateTimeInterface;
use Spatie\LaravelData\Resource;
use Spatie\TypeScriptTransformer\Attributes\TypeScript;

#[TypeScript]
final class AccountDailyActivityExportItemViewModel extends Resource
{
    public function __construct(
        public string $username,
        public string $activityDate,
        public int $totalSeconds,
    ) {}

    public static function fromModel(AccountDailyActivity $activity, string $username): self
    {
        return new self(
            username: $username,
            activityDate: $activity->activity_date instanceof DateTimeInterface
                ? $activity->activity_date->format('Y-m-d')
                : (string) $activity->activity_date,
            totalSeconds: $activity->total_seconds,
        );
    }
}
