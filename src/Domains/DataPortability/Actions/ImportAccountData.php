<?php

declare(strict_types=1);

namespace AltUU\Domains\DataPortability\Actions;

use AltUU\Domains\Account\Exceptions\PremiumRequiredException;
use AltUU\Domains\DataPortability\DataTransferObjects\AccountDailyActivityImportItemData;
use AltUU\Domains\DataPortability\DataTransferObjects\ImportDataInputData;
use AltUU\Domains\DataPortability\DataTransferObjects\PlaybackProgressImportItemData;
use AltUU\Domains\DataPortability\ViewModels\DataImportResultViewModel;
use AltUU\Domains\Subscription\Actions\GetEntitlementStatus;
use App\Models\Account;
use Illuminate\Support\Facades\DB;

final readonly class ImportAccountData
{
    public function __construct(
        private GetEntitlementStatus $getEntitlementStatus,
        private MergeAccountData $mergeAccountData,
    ) {}

    public function __invoke(ImportDataInputData $input): DataImportResultViewModel
    {
        if (! ($this->getEntitlementStatus)()->active) {
            throw new PremiumRequiredException;
        }

        $usernames = array_keys($input->accounts);

        $localAccountIdsByUsername = Account::query()
            ->whereIn('username', $usernames)
            ->pluck('id', 'username');

        $skippedUsernames = collect($usernames)
            ->reject(fn (string $username): bool => $localAccountIdsByUsername->has($username))
            ->values()
            ->all();

        return DB::transaction(function () use ($input, $localAccountIdsByUsername, $skippedUsernames): DataImportResultViewModel {
            $playbackProgressItems = collect($input->playbackProgress)
                ->map(fn (PlaybackProgressImportItemData $item): array => [
                    'username' => $item->username,
                    'cid' => $item->cid,
                    'activityId' => $item->activityId,
                    'durationSeconds' => $item->durationSeconds,
                    'positionSeconds' => $item->positionSeconds,
                    'hunguUploadSuccess' => $item->hunguUploadSuccess,
                ])
                ->all();

            $accountDailyActivityItems = collect($input->accountDailyActivities)
                ->map(fn (AccountDailyActivityImportItemData $item): array => [
                    'username' => $item->username,
                    'activityDate' => $item->activityDate,
                    'totalSeconds' => $item->totalSeconds,
                ])
                ->all();

            $result = ($this->mergeAccountData)($playbackProgressItems, $accountDailyActivityItems, $localAccountIdsByUsername);

            return new DataImportResultViewModel(
                importedAccountsCount: $localAccountIdsByUsername->count(),
                skippedUsernames: $skippedUsernames,
                importedPlaybackProgressCount: $result['importedPlaybackProgressCount'],
                importedAccountDailyActivitiesCount: $result['importedAccountDailyActivitiesCount'],
            );
        });
    }
}
