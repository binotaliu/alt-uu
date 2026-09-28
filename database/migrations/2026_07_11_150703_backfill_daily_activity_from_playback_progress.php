<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\Date;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        /** @var array<string, int> $totals */
        $totals = [];

        DB::table('playback_progress')
            ->whereNotNull('account_id')
            ->select('account_id', 'duration_seconds', 'updated_at')
            ->orderBy('id')
            ->each(function (object $row) use (&$totals): void {
                $activityDate = Date::parse($row->updated_at, 'UTC')
                    ->setTimezone('Asia/Taipei')
                    ->toDateString();

                $key = $row->account_id.'|'.$activityDate;
                $totals[$key] = ($totals[$key] ?? 0) + (int) $row->duration_seconds;
            });

        if ($totals === []) {
            return;
        }

        $now = Date::now();
        $rows = [];

        foreach ($totals as $key => $seconds) {
            [$accountId, $activityDate] = explode('|', $key);

            $rows[] = [
                'account_id' => (int) $accountId,
                'activity_date' => $activityDate,
                'total_seconds' => $seconds,
                'created_at' => $now,
                'updated_at' => $now,
            ];
        }

        foreach (array_chunk($rows, 500) as $chunk) {
            DB::table('account_daily_activities')->insertOrIgnore($chunk);
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // No need to reverse this migration since it is a backfill of historical data.
    }
};
