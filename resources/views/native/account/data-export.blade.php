@use ('App\Icons\Android')
@use ('App\Icons\Ios')

<native:column class="bg-theme-background h-full w-full">
    <native:scroll-view class="w-full flex-1">
        <native:column class="w-full gap-4 p-4">
            <native:column
                class="bg-theme-surface border-theme-outline-variant w-full gap-3 rounded-xl border p-4"
            >
                <native:text class="text-theme-on-surface text-sm font-semibold"
                    >匯出資料</native:text
                >
                <native:text
                    class="text-theme-on-surface-variant text-xs leading-relaxed"
                    >將裝置上所有帳號的學習紀錄（播放進度與每日學習活動）匯出為
                    JSON 檔案，方便備份或轉移到其他裝置。</native:text
                >

                <native:button
                    ref="export"
                    variant="secondary"
                    :label="$exporting ? '匯出中…' : '匯出為 JSON 檔案'"
                    :ios-icon="Ios::SquareAndArrowUp"
                    :android-icon="Android::FileDownload"
                    :loading="$exporting"
                    :disabled="$exporting"
                    @tap="exportData"
                />

                @if ($exportError !== '')
                    <native:text
                        ref="export-error"
                        class="text-theme-destructive text-xs"
                        >{{ $exportError }}</native:text
                    >
                @endif
            </native:column>

            <native:column
                class="bg-theme-surface border-theme-outline-variant w-full gap-3 rounded-xl border p-4"
            >
                <native:row class="items-center gap-2">
                    <native:text
                        class="text-theme-on-surface text-sm font-semibold"
                        >匯入資料</native:text
                    >
                    @if (! $subscribed)
                        <native:premium-badge key="import-premium" />
                    @endif
                </native:row>
                <native:text
                    class="text-theme-on-surface-variant text-xs leading-relaxed"
                    >選擇先前匯出的 JSON
                    檔案以還原學習紀錄。只有使用者名稱與本裝置帳號相符的資料才會被匯入。</native:text
                >

                <native:button
                    ref="import"
                    variant="secondary"
                    :label="$importing ? '匯入中…' : '選擇檔案匯入'"
                    :ios-icon="Ios::ArrowUpDoc"
                    :android-icon="Android::FileUpload"
                    :loading="$importing"
                    :disabled="$importing"
                    @tap="openImport"
                />

                @if ($importError !== '' && ! $importSheetVisible)
                    <native:text
                        ref="import-error"
                        class="text-theme-destructive text-xs"
                        >{{ $importError }}</native:text
                    >
                @endif

                @if ($importResult !== null)
                    <native:column ref="import-result" class="w-full gap-1">
                        <native:text class="text-theme-success text-xs"
                            >已匯入 {{ $importResult->importedAccountsCount }} 個帳號的資料，共 {{ $importResult->importedPlaybackProgressCount }} 筆播放進度、{{ $importResult->importedAccountDailyActivitiesCount }} 筆每日學習活動。</native:text
                        >
                        @if (count($importResult->skippedUsernames) > 0)
                            <native:text class="text-theme-success text-xs"
                                >以下使用者名稱在本裝置找不到對應帳號，已略過：{{ implode('、', $importResult->skippedUsernames) }}</native:text
                            >
                        @endif
                    </native:column>
                @endif
            </native:column>

            @if (! $subscribed)
                <native:column
                    class="bg-theme-warning w-full gap-3 rounded-xl p-4"
                >
                    <native:text
                        class="text-theme-on-warning text-sm font-medium"
                        >想要匯入學習紀錄嗎？訂閱 Alt UU+
                        即可解鎖此功能與更多內容。</native:text
                    >
                    <native:button
                        ref="subscribe"
                        variant="secondary"
                        label="訂閱 Alt UU+"
                        :ios-icon="Ios::Sparkles"
                        :android-icon="Android::AutoAwesome"
                        @tap="openSubscription"
                    />
                </native:column>
            @endif
        </native:column>
    </native:scroll-view>

    <native:bottom-sheet
        ref="import-sheet"
        :visible="$importSheetVisible"
        detents="large"
        @dismiss="closeImport"
    >
        <native:column class="w-full gap-4 p-5">
            <native:column class="w-full gap-2">
                <native:text class="text-theme-on-surface text-lg font-semibold"
                    >匯入資料</native:text
                >
                <native:text class="text-theme-on-surface-variant text-sm"
                    >請將匯出的 JSON 檔案內容貼到下方。</native:text
                >
            </native:column>

            <native:outlined-text-input
                ref="import-text"
                native:model="importText"
                placeholder="貼上 JSON 內容"
                :multiline="true"
                :min-lines="6"
                :max-lines="10"
                :error="$importError !== ''"
                :supporting="$importError"
                :disabled="$importing"
            />

            <native:row class="w-full justify-end gap-3">
                <native:button
                    ref="import-cancel"
                    variant="secondary"
                    label="取消"
                    :disabled="$importing"
                    @tap="closeImport"
                />
                <native:button
                    ref="import-submit"
                    variant="primary"
                    :label="$importing ? '匯入中…' : '匯入'"
                    :loading="$importing"
                    :disabled="$importing || trim($importText) === ''"
                    @tap="submitImport"
                />
            </native:row>
        </native:column>
    </native:bottom-sheet>

    <native:confirm-sheet
        key="upgrade"
        :visible="$upgradeSheetVisible"
        title="資料匯入為 Alt UU+ 專屬功能"
        message="升級為 Alt UU+ 即可啟用匯入學習紀錄。"
        confirm-label="升級"
        cancel-label="關閉"
        @confirm="openSubscription"
        @cancel="closeUpgrade"
    />
</native:column>
