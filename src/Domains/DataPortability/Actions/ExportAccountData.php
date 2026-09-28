<?php

declare(strict_types=1);

namespace AltUU\Domains\DataPortability\Actions;

use AltUU\Domains\DataPortability\ViewModels\AccountDailyActivityExportItemViewModel;
use AltUU\Domains\DataPortability\ViewModels\DataExportViewModel;
use AltUU\Domains\DataPortability\ViewModels\PlaybackProgressExportItemViewModel;
use App\Models\Account;
use App\Models\AccountDailyActivity;
use App\Models\PlaybackProgress;
use Illuminate\Support\Facades\Date;

final readonly class ExportAccountData
{
    public function __invoke(): DataExportViewModel
    {
        $accounts = Account::query()->get(['id', 'username']);
        $usernamesById = $accounts->pluck('username', 'id');

        $playbackProgress = PlaybackProgress::query()
            ->whereIn('account_id', $accounts->pluck('id'))
            ->get()
            ->map(fn (PlaybackProgress $item): PlaybackProgressExportItemViewModel => PlaybackProgressExportItemViewModel::fromModel(
                $item,
                (string) $usernamesById->get($item->account_id),
            ))
            ->values()
            ->all();

        $accountDailyActivities = AccountDailyActivity::query()
            ->whereIn('account_id', $accounts->pluck('id'))
            ->get()
            ->map(fn (AccountDailyActivity $item): AccountDailyActivityExportItemViewModel => AccountDailyActivityExportItemViewModel::fromModel(
                $item,
                (string) $usernamesById->get($item->account_id),
            ))
            ->values()
            ->all();

        return new DataExportViewModel(
            exportedAt: Date::now()->toIso8601String(),
            accounts: $usernamesById->flip()->all(),
            playbackProgress: $playbackProgress,
            accountDailyActivities: $accountDailyActivities,
        );
    }
}
