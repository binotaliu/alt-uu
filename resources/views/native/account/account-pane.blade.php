@use ('App\Icons\Android')
@use ('App\Icons\Ios')

<native:column class="bg-theme-background h-full w-full">
    <native:top-bar title="我的帳號" display-mode="large">
        <native:top-bar-action
            id="settings"
            label="設定"
            :ios-icon="Ios::Gearshape"
            :android-icon="Android::Settings"
            @tap="openSettings"
        />
    </native:top-bar>

    <native:refreshable @refresh="refresh">
        <native:column class="w-full gap-4 px-4 pt-3 pb-6">
            <native:row
                class="bg-theme-surface border-theme-outline-variant w-full items-center gap-4 rounded-xl border p-4"
            >
                @if ($profile?->picture)
                    <native:image
                        src="{{ $profile->picture }}"
                        alt=""
                        class="h-14 w-14 rounded-full"
                    />
                @else
                    <native:icon
                        :ios="Ios::PersonCircle"
                        :android="Android::AccountCircle"
                        :size="56"
                        class="text-theme-on-surface-variant"
                    />
                @endif

                <native:column class="flex-1 gap-0.5">
                    <native:text
                        class="text-theme-on-surface text-lg font-semibold"
                        >{{ $profile?->displayName ?? '學生' }}</native:text
                    >
                    @if ($profile?->username)
                        <native:text
                            class="text-theme-on-surface-variant text-sm"
                            >{{ $profile->username }}</native:text
                        >
                    @endif
                </native:column>

                <native:pressable
                    ref="switch-account"
                    a11y-label="切換帳號"
                    @tap="openAccounts"
                >
                    <native:row class="items-center gap-1 px-2 py-1">
                        <native:text
                            class="text-theme-on-surface-variant text-sm font-medium"
                            >切換帳號</native:text
                        >
                        <native:icon
                            :ios="Ios::ChevronRight"
                            :android="Android::ChevronRight"
                            :size="16"
                            class="text-theme-on-surface-variant"
                        />
                    </native:row>
                </native:pressable>
            </native:row>

            <native:column
                class="bg-theme-surface border-theme-outline-variant w-full rounded-xl border"
            >
                <native:pressable ref="grades" @tap="openGrades">
                    <native:row
                        class="w-full items-center justify-between px-4 py-3"
                    >
                        <native:text
                            class="text-theme-on-surface text-sm font-medium"
                            >我的成績</native:text
                        >
                        <native:icon
                            :ios="Ios::ChevronRight"
                            :android="Android::ChevronRight"
                            :size="16"
                            class="text-theme-on-surface-variant"
                        />
                    </native:row>
                </native:pressable>
                <native:divider />
                <native:pressable ref="exam-info" @tap="openExamInfo">
                    <native:row
                        class="w-full items-center justify-between px-4 py-3"
                    >
                        <native:text
                            class="text-theme-on-surface text-sm font-medium"
                            >考試資訊</native:text
                        >
                        <native:icon
                            :ios="Ios::ChevronRight"
                            :android="Android::ChevronRight"
                            :size="16"
                            class="text-theme-on-surface-variant"
                        />
                    </native:row>
                </native:pressable>
            </native:column>

            @if (! $altUuPlusDisabled)
                <native:row
                    class="bg-theme-surface border-theme-outline-variant w-full items-center gap-3 rounded-xl border p-4"
                >
                    <native:icon
                        :ios="Ios::Sparkles"
                        :android="Android::AutoAwesome"
                        :size="24"
                        class="text-theme-warning"
                    />
                    <native:column class="flex-1 gap-0.5">
                        <native:text
                            class="text-theme-on-surface text-sm font-semibold"
                            >Alt UU+</native:text
                        >
                        <native:text
                            class="text-theme-on-surface-variant text-xs"
                            >{{ $plusSubtitle }}</native:text
                        >
                    </native:column>
                    <native:button
                        ref="subscription"
                        variant="primary"
                        :label="$subscribed ? '檢視方案' : '升級'"
                        @tap="openSubscription"
                    />
                </native:row>
                <native:column
                    class="bg-theme-surface border-theme-outline-variant w-full gap-3 rounded-xl border p-4"
                >
                    <native:row class="w-full items-center gap-2">
                        <native:icon
                            :ios="Ios::ChartBar"
                            :android="Android::BarChart"
                            :size="20"
                            class="text-theme-on-surface-variant"
                        />
                        <native:text
                            class="text-theme-on-surface flex-1 text-sm font-semibold"
                            >學習活動</native:text
                        >
                        @if (! $subscribed)
                            <native:premium-badge key="activity-premium" />
                        @endif
                    </native:row>

                    @if ($subscribed)
                        @if ($activity?->hasMultipleAccounts)
                            @include ('native.courses.segmented', [
                                'options' => [
                                    ['label' => '目前帳號', 'ref' => 'activity-current', 'tap' => 'setActivityScope(false)', 'active' => ! $showAllAccountsActivity],
                                    ['label' => '所有帳號', 'ref' => 'activity-all', 'tap' => 'setActivityScope(true)', 'active' => $showAllAccountsActivity],
                                ],
                            ])
                        @endif
                        @if ($activity !== null)
                            <native:activity-heatmap
                                key="heatmap"
                                :days="$activity->days"
                                :current-streak="$activity->currentStreak"
                                :longest-streak="$activity->longestStreak"
                                :longest-study-day-seconds="$activity->longestStudyDaySeconds"
                                :longest-study-day-date="$activity->longestStudyDayDate"
                            />
                        @elseif ($activityLoading)
                            <native:activity-indicator />
                        @else
                            <native:text
                                class="text-theme-on-surface-variant text-sm"
                                >無法載入學習活動資料。</native:text
                            >
                        @endif
                    @else
                        <native:activity-heatmap
                            key="heatmap-sample"
                            :days="$sample['days']"
                            :current-streak="$sample['currentStreak']"
                            :longest-streak="$sample['longestStreak']"
                            :longest-study-day-seconds="$sample['longestStudyDaySeconds']"
                            :longest-study-day-date="$sample['longestStudyDayDate']"
                        />
                        <native:text
                            class="text-theme-on-surface-variant text-xs font-medium"
                            >範例資料</native:text
                        >
                        <native:column
                            class="bg-theme-warning-container w-full gap-2 rounded-lg p-3"
                        >
                            <native:text
                                class="text-theme-on-warning-container text-sm font-semibold"
                                >學習活動為 Alt UU+ 專屬功能</native:text
                            >
                            <native:text
                                class="text-theme-on-warning-container text-xs"
                                >追蹤你的學習連續天數與每日學習時間，如上方範例所示。訂閱即可解鎖你的真實學習紀錄。</native:text
                            >
                            <native:button
                                ref="upgrade"
                                variant="primary"
                                label="升級"
                                @tap="openSubscription"
                            />
                        </native:column>
                    @endif
                </native:column>
                <native:row
                    class="bg-theme-surface border-theme-outline-variant w-full items-center gap-3 rounded-xl border p-4"
                >
                    <native:icon
                        :ios="Ios::ArrowLeftArrowRight"
                        :android="Android::SwapHoriz"
                        :size="24"
                        class="text-theme-on-surface-variant"
                    />
                    <native:column class="flex-1 gap-0.5">
                        <native:text
                            class="text-theme-on-surface text-sm font-semibold"
                            >匯入/匯出資料</native:text
                        >
                        <native:text
                            class="text-theme-on-surface-variant text-xs"
                            >備份學習紀錄，或轉移到其他裝置</native:text
                        >
                    </native:column>
                    <native:button
                        ref="data-export"
                        variant="secondary"
                        label="進行"
                        @tap="openDataExport"
                    />
                </native:row>
            @endif
        </native:column>
    </native:refreshable>

    <native:session-expired-picker
        key="session-expired"
        :visible="$sessionPickerVisible"
        :failed-account-id="$sessionPickerFailedAccountId"
        return-to="{{ $this->route('native.courses.account') }}"
        @cancel="closeSessionPicker"
        @switched="onSessionPickerSwitched"
    />
</native:column>
