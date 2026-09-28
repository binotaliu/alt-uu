<?php

declare(strict_types=1);

namespace AltUU\Domains\DataPortability\Actions;

use App\Models\AccountDailyActivity;
use App\Models\PlaybackProgress;
use DateTimeInterface;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Date;
use Throwable;

/**
 * Shared upsert-by-natural-key merge logic used by both the manual file-based
 * import (ImportAccountData) and the automated device sync pull (PullSyncData),
 * so the two flows can never drift on how incoming rows are applied locally.
 */
final class MergeAccountData
{
    /**
     * @param  array<int, array{username: string, cid: string, activityId: string, durationSeconds: int, positionSeconds: float, hunguUploadSuccess: ?bool, updatedAt?: ?string}>  $playbackProgressItems
     * @param  array<int, array{username: string, activityDate: string, totalSeconds: int, updatedAt?: ?string}>  $accountDailyActivityItems
     * @param  Collection<string, int>  $localAccountIdsByUsername
     * @return array{importedPlaybackProgressCount: int, importedAccountDailyActivitiesCount: int}
     */
    public function __invoke(
        array $playbackProgressItems,
        array $accountDailyActivityItems,
        Collection $localAccountIdsByUsername,
    ): array {
        $importedPlaybackProgressCount = 0;
        $importedAccountDailyActivitiesCount = 0;

        foreach ($playbackProgressItems as $item) {
            $accountId = $localAccountIdsByUsername->get($item['username']);

            if ($accountId === null) {
                continue;
            }

            $existing = PlaybackProgress::query()
                ->where('account_id', $accountId)
                ->where('cid', $item['cid'])
                ->where('activity_id', $item['activityId'])
                ->first();

            if ($existing !== null && $this->isIncomingStale($existing->updated_at, $item['updatedAt'] ?? null)) {
                continue;
            }

            PlaybackProgress::query()->updateOrCreate(
                [
                    'account_id' => $accountId,
                    'cid' => $item['cid'],
                    'activity_id' => $item['activityId'],
                ],
                [
                    'duration_seconds' => $item['durationSeconds'],
                    'position_seconds' => $item['positionSeconds'],
                    'hungu_upload_success' => $item['hunguUploadSuccess'],
                ],
            );

            $importedPlaybackProgressCount++;
        }

        foreach ($accountDailyActivityItems as $item) {
            $accountId = $localAccountIdsByUsername->get($item['username']);

            if ($accountId === null) {
                continue;
            }

            $existing = AccountDailyActivity::query()
                ->where('account_id', $accountId)
                ->where('activity_date', $item['activityDate'])
                ->first();

            if ($existing !== null && $this->isIncomingStale($existing->updated_at, $item['updatedAt'] ?? null)) {
                continue;
            }

            AccountDailyActivity::query()->updateOrCreate(
                [
                    'account_id' => $accountId,
                    'activity_date' => $item['activityDate'],
                ],
                [
                    'total_seconds' => $item['totalSeconds'],
                ],
            );

            $importedAccountDailyActivitiesCount++;
        }

        return [
            'importedPlaybackProgressCount' => $importedPlaybackProgressCount,
            'importedAccountDailyActivitiesCount' => $importedAccountDailyActivitiesCount,
        ];
    }

    /**
     * Last-write-wins: an incoming row is considered stale (and skipped) only when we
     * know both timestamps and the local row was updated more recently. Rows with no
     * incoming timestamp (e.g. the legacy manual import payload) always win, preserving
     * the historical overwrite behaviour of the manual import flow.
     */
    private function isIncomingStale(?DateTimeInterface $existingUpdatedAt, ?string $incomingUpdatedAt): bool
    {
        if ($existingUpdatedAt === null || $incomingUpdatedAt === null) {
            return false;
        }

        try {
            $incoming = Date::parse($incomingUpdatedAt);
        } catch (Throwable) {
            return false;
        }

        return $existingUpdatedAt->getTimestamp() > $incoming->getTimestamp();
    }
}
