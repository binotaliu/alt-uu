@use ('App\Icons\Android')
@use ('App\Icons\Ios')

<native:stack class="h-full w-full">
    <native:scroll-view class="bg-theme-background h-full w-full">
        <native:column class="w-full gap-4 p-4 pb-16">
            @if ($recordingAvailable)
                <native:column
                    class="{{ $recordingNow ? 'bg-theme-success-container border-theme-success' : 'bg-theme-surface border-theme-outline-variant' }} w-full rounded-xl border px-4 py-2"
                >
                    <native:toggle-row
                        key="recording"
                        :label="$recordingNow ? '記錄中' : '診斷記錄未開啟'"
                        :description="$recordingNow
                            ? '約 '.$minutesRemaining.' 分鐘後自動關閉。請重現一次問題，再回到這裡分享記錄。'
                            : '為了節省效能與空間，平常不會記錄。開啟後會記錄 '.$recordingWindowMinutes.' 分鐘，接著自動關閉。'"
                        :value="$recordingNow"
                        :saving="$savingRecording"
                        @toggled="setRecording"
                    />
                    @if ($recordingNow)
                        <native:text
                            ref="recording-tick"
                            native:poll="30s"
                            class="text-theme-on-surface-variant text-xs"
                            >狀態每 30 秒更新一次。</native:text
                        >
                    @endif
                    @if ($recordingError)
                        <native:text
                            ref="recording-error"
                            class="text-theme-destructive text-xs"
                            >{{ $recordingError }}</native:text
                        >
                    @endif
                </native:column>
            @endif

            <native:column
                class="bg-theme-surface border-theme-outline-variant w-full gap-3 rounded-xl border p-4"
            >
                <native:text class="text-theme-on-surface-variant text-xs"
                    >這裡記錄了 App
                    最近的請求與錯誤。回報問題時，請一併附上這份記錄，可以大幅加快找出問題的速度。</native:text
                >
                <native:text class="text-theme-on-surface-variant text-xs"
                    >記錄中的帳號資訊已以代號取代，密碼、Cookie
                    與登入憑證則完全不會被記錄。</native:text
                >

                <native:row class="w-full gap-2">
                    <native:button
                        ref="share"
                        class="flex-1"
                        variant="secondary"
                        :label="$sharing ? '匯出中…' : '分享'"
                        :loading="$sharing"
                        :disabled="$sharing"
                        :ios-icon="Ios::SquareAndArrowUp"
                        :android-icon="Android::Share"
                        @tap="share"
                    />
                    <native:button
                        ref="clear"
                        class="flex-1"
                        variant="secondary"
                        label="清除"
                        :ios-icon="Ios::Trash"
                        :android-icon="Android::Delete"
                        @tap="askClear"
                    />
                </native:row>

                @if ($actionError)
                    <native:text
                        ref="action-error"
                        class="text-theme-destructive text-xs"
                        >{{ $actionError }}</native:text
                    >
                @endif
            </native:column>

            <native:column
                class="bg-theme-surface border-theme-outline-variant w-full gap-2 rounded-xl border p-4"
            >
                <native:row class="w-full items-center gap-2">
                    <native:pressable
                        ref="filter-all"
                        @tap="showProblemsOnly(false)"
                    >
                        <native:column
                            class="{{ ! $problemsOnly ? 'bg-theme-primary/15' : '' }} rounded-lg px-3 py-1.5"
                        >
                            <native:text
                                class="{{ ! $problemsOnly ? 'text-theme-on-surface' : 'text-theme-on-surface-variant' }} text-xs font-medium"
                                >全部</native:text
                            >
                        </native:column>
                    </native:pressable>
                    <native:pressable
                        ref="filter-problems"
                        @tap="showProblemsOnly(true)"
                    >
                        <native:column
                            class="{{ $problemsOnly ? 'bg-theme-primary/15' : '' }} rounded-lg px-3 py-1.5"
                        >
                            <native:text
                                class="{{ $problemsOnly ? 'text-theme-on-surface' : 'text-theme-on-surface-variant' }} text-xs font-medium"
                                >僅錯誤</native:text
                            >
                        </native:column>
                    </native:pressable>
                    <native:spacer />
                    <native:pressable
                        ref="refresh"
                        a11y-label="重新整理"
                        @tap="load"
                    >
                        <native:row class="items-center gap-1">
                            @if ($loading)
                                <native:activity-indicator />
                            @else
                                <native:icon
                                    :ios="Ios::ArrowClockwise"
                                    :android="Android::Refresh"
                                    :size="16"
                                    class="text-theme-on-surface-variant"
                                />
                            @endif
                            <native:text
                                class="text-theme-on-surface-variant text-xs"
                                >重新整理</native:text
                            >
                        </native:row>
                    </native:pressable>
                </native:row>

                @if ($loadError)
                    <native:text
                        ref="load-error"
                        class="text-theme-destructive text-xs"
                        >{{ $loadError }}</native:text
                    >
                @elseif (! $loading && count($events) === 0)
                    <native:text
                        ref="empty"
                        class="text-theme-on-surface-variant text-xs"
                        >{{ $recordingNow ? '目前沒有任何記錄，請重現一次問題。' : '目前沒有任何記錄。請先於上方開啟診斷記錄，再重現一次問題。' }}</native:text
                    >
                @else
                    @foreach ($events as $event)
                        <native:column
                            class="w-full gap-1 py-2"
                            key="event-{{ $event['id'] }}"
                        >
                            <native:divider />
                            <native:pressable
                                ref="event-{{ $event['id'] }}"
                                @tap="toggleEvent({{ $event['id'] }})"
                            >
                                <native:row class="w-full items-start gap-2">
                                    <native:text
                                        class="{{ $event['level'] === 'error' ? 'text-theme-destructive' : ($event['level'] === 'warning' ? 'text-theme-warning' : 'text-theme-on-surface-variant') }} w-4 text-xs font-mono"
                                        >{{ $event['marker'] }}</native:text
                                    >
                                    <native:text
                                        class="text-theme-on-surface-variant w-16 font-mono text-xs"
                                        >{{ $event['time'] }}</native:text
                                    >
                                    <native:column class="flex-1 gap-0.5">
                                        <native:text
                                            class="text-theme-on-surface text-xs"
                                            >{{ $event['summary'] }}</native:text
                                        >
                                        <native:text
                                            class="text-theme-on-surface-variant text-xs"
                                            >{{ $event['typeLabel'] }}{{ $event['status'] !== null ? ' → '.$event['status'] : '' }}{{ $event['durationMs'] !== null ? ' '.$event['durationMs'].'ms' : '' }}{{ $event['op'] ? ' '.$event['op'] : '' }}{{ $event['requestId'] ? ' #'.$event['requestId'] : '' }}</native:text
                                        >
                                    </native:column>
                                </native:row>
                            </native:pressable>
                            @if ($event['context'] !== null && in_array($event['id'], $expandedIds, true))
                                <native:column
                                    class="bg-theme-surface-variant w-full rounded-lg p-2"
                                >
                                    <native:text
                                        class="text-theme-on-surface-variant font-mono text-xs select-text"
                                        >{{ $event['context'] }}</native:text
                                    >
                                </native:column>
                            @endif
                        </native:column>
                    @endforeach
                    <native:text
                        class="text-theme-on-surface-variant pt-2 text-xs"
                        >顯示 {{ count($events) }} 筆，共 {{ $total }} 筆。</native:text
                    >
                @endif
            </native:column>
        </native:column>
    </native:scroll-view>

    <native:confirm-sheet
        key="confirm-clear"
        :visible="$confirmClearVisible"
        title="清除診斷記錄"
        message="清除後將無法復原，且先前的錯誤記錄將不再能用於回報問題。"
        confirm-label="清除"
        :danger="true"
        @confirm="confirmClear"
        @cancel="cancelClear"
    />
</native:stack>
