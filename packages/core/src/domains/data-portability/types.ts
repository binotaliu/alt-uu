/** Legacy PlaybackProgressExportItemViewModel / PlaybackProgressImportItemData. */
export interface PlaybackProgressTransferItem {
    username: string;
    cid: string;
    activityId: string;
    durationSeconds: number;
    positionSeconds: number;
    hunguUploadSuccess: boolean | null;
    /** Only sent by device sync; the manual export file never carries it. */
    updatedAt?: string | null;
}

/** Legacy AccountDailyActivityExportItemViewModel / ...ImportItemData. */
export interface AccountDailyActivityTransferItem {
    username: string;
    /** `Y-m-d` (Asia/Taipei day). */
    activityDate: string;
    totalSeconds: number;
    updatedAt?: string | null;
}

/**
 * Legacy DataExportViewModel, the content of an `alt-uu-data-export-*.json`
 * file. `accounts` maps username to the exporting device's account id.
 */
export interface DataExport {
    exportedAt: string;
    accounts: Record<string, number>;
    playbackProgress: PlaybackProgressTransferItem[];
    accountDailyActivities: AccountDailyActivityTransferItem[];
}

/** Legacy ImportDataInputData. */
export interface DataImportInput {
    accounts: Record<string, number> | number[];
    playbackProgress?: PlaybackProgressTransferItem[];
    accountDailyActivities?: AccountDailyActivityTransferItem[];
}

/** Legacy DataImportResultViewModel. */
export interface DataImportResult {
    importedAccountsCount: number;
    skippedUsernames: string[];
    importedPlaybackProgressCount: number;
    importedAccountDailyActivitiesCount: number;
}
