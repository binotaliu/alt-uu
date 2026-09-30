<?php

declare(strict_types=1);

namespace App\NativeComponents\Account\Support;

use Illuminate\Support\Facades\Date;

/**
 * Deterministic sample data shown behind the Alt UU+ upsell
 * (`buildSampleActivity` in AccountActivityWidget.vue).
 */
final class SampleActivity
{
    /**
     * @return array{days: list<array{date: string, seconds: int}>, currentStreak: int, longestStreak: int, longestStudyDaySeconds: int, longestStudyDayDate: string|null}
     */
    public static function build(): array
    {
        $today = Date::now()->startOfDay();
        $days = [];

        for ($i = 181; $i >= 0; $i--) {
            $roll = self::pseudoRandom($i);

            $days[] = [
                'date' => $today->copy()->subDays($i)->toDateString(),
                'seconds' => $roll < 0.35 ? 0 : (int) round($roll * 5400),
            ];
        }

        return [
            'days' => $days,
            'currentStreak' => 6,
            'longestStreak' => 18,
            'longestStudyDaySeconds' => 5400,
            'longestStudyDayDate' => $days[count($days) - 8]['date'] ?? null,
        ];
    }

    private static function pseudoRandom(int $seed): float
    {
        $value = sin($seed * 12.9898) * 43758.5453;

        return $value - floor($value);
    }
}
