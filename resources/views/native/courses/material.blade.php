@use ('App\Icons\Android')
@use ('App\Icons\Ios')

<native:column class="bg-theme-background h-full w-full">
    <native:top-bar
        back="true"
        title="{{ $this->courseTitle() }}"
        subtitle="{{ $this->subtitle() }}"
        display-mode="inline"
    />

    <native:stack class="w-full flex-1">
        <native:row class="h-full w-full">
            <native:column
                class="border-theme-outline-variant hidden h-full w-80 md:flex"
            >
                @include ('native.courses.material.sidebar', ['m' => $this])
            </native:column>

            <native:scroll-view class="h-full flex-1">
                <native:column class="w-full gap-4 px-3 pt-2 pb-10">
                    @if ($this->isTracking())
                        <native:row class="w-full justify-end">
                            <native:row
                                class="bg-theme-surface-variant items-center gap-2 rounded-full px-3 py-1"
                                a11y-label="學習計時 {{ $this->clock() }}"
                            >
                                <native:icon
                                    :ios="Ios::Clock"
                                    :android="Android::Schedule"
                                    :size="16"
                                    class="text-theme-on-surface-variant"
                                />
                                <native:text
                                    class="text-theme-on-surface-variant text-xs font-medium"
                                    >{{ $this->clock() }}</native:text
                                >
                            </native:row>
                        </native:row>
                    @endif

                    @if ($loading)
                        <native:column class="w-full gap-3" a11y-label="載入中">
                            <native:rect
                                class="bg-theme-outline-variant aspect-video w-full rounded-2xl"
                            />
                            <native:rect
                                class="bg-theme-outline-variant h-4 w-3/4 rounded"
                            />
                            <native:rect
                                class="bg-theme-outline-variant h-4 w-1/2 rounded"
                            />
                        </native:column>
                    @elseif ($error !== '')
                        <native:error-retry
                            key="error"
                            :message="$error"
                            :detail="$errorDetail"
                            :retrying="$loading"
                            @retry="retry"
                        />
                    @else
                        @include ('native.courses.material.viewer', ['m' => $this])
                    @endif

                    @if (! $loading)
                        @include ('native.courses.material.navigation', ['m' => $this])
                    @endif
                </native:column>
            </native:scroll-view>
        </native:row>

        @if ($saving)
            <native:column
                class="absolute top-0 left-0 h-full w-full items-center justify-start p-4"
            >
                <native:row
                    class="bg-theme-surface border-theme-outline-variant w-full items-center gap-3 rounded-2xl border px-4 py-3"
                    a11y-label="正在保存學習進度"
                >
                    <native:activity-indicator />
                    <native:column class="flex-1 gap-1">
                        <native:text
                            class="text-theme-on-surface text-sm font-semibold"
                            >正在保存學習進度</native:text
                        >
                        <native:text
                            class="text-theme-on-surface-variant text-xs"
                            >已儲存最新位置，請稍候…</native:text
                        >
                    </native:column>
                </native:row>
            </native:column>
        @endif
    </native:stack>

    <native:bottom-sheet
        ref="resume-sheet"
        :visible="$resumePrompt !== null"
        detents="small"
        @dismiss="declineResume"
    >
        <native:column class="w-full gap-4 p-5">
            <native:column class="w-full gap-2">
                <native:text class="text-theme-on-surface text-lg font-semibold"
                    >接續上次播放？</native:text
                >
                <native:text class="text-theme-on-surface-variant text-sm"
                    >上次播放到 {{ $resumePrompt['label'] ?? '' }}，是否從此處繼續？</native:text
                >
            </native:column>
            <native:row class="w-full justify-end gap-3">
                <native:button
                    ref="resume-decline"
                    variant="secondary"
                    label="從頭開始"
                    @tap="declineResume"
                />
                <native:button
                    ref="resume-confirm"
                    variant="primary"
                    label="接續播放"
                    @tap="confirmResume"
                />
            </native:row>
        </native:column>
    </native:bottom-sheet>

    <native:bottom-sheet
        ref="cellular-sheet"
        :visible="$cellularPromptVisible"
        detents="small"
        @dismiss="declineCellular"
    >
        <native:column class="w-full gap-4 p-5">
            <native:column class="w-full gap-2">
                <native:text class="text-theme-on-surface text-lg font-semibold"
                    >使用行動網路播放？</native:text
                >
                <native:text class="text-theme-on-surface-variant text-sm"
                    >您目前透過行動網路（非
                    Wi-Fi）連線，播放教材影音可能會消耗較多行動數據，是否繼續播放？</native:text
                >
            </native:column>
            <native:checkbox
                ref="cellular-dont-ask"
                native:model="cellularDontAsk"
                label="不再詢問（可於設定頁面重新開啟）"
            />
            <native:row class="w-full justify-end gap-3">
                <native:button
                    ref="cellular-decline"
                    variant="secondary"
                    label="返回課程"
                    @tap="declineCellular"
                />
                <native:button
                    ref="cellular-continue"
                    variant="primary"
                    label="繼續播放"
                    @tap="continueOnCellular"
                />
            </native:row>
        </native:column>
    </native:bottom-sheet>

    <native:session-expired-picker
        key="session-expired"
        :visible="$sessionPickerVisible"
        :failed-account-id="$sessionPickerFailedAccountId"
        return-to="{{ $this->route('native.courses.index') }}"
        @cancel="closeSessionPicker"
        @switched="onSessionPickerSwitched"
    />
</native:column>
