<native:column class="bg-theme-background h-full w-full">
    <native:refreshable @refresh="refresh">
        <native:column class="w-full gap-4 px-4 pt-3 pb-6">
            @if (! $nouToolsEnabled)
                <native:empty-state
                    key="calendar-gate"
                    title="開啟 NOU 小幫手整合"
                    message="此功能需要開啟 NOU 小幫手整合才可使用。"
                />
                <native:button
                    ref="open-gate"
                    variant="primary"
                    label="開啟 NOU 小幫手整合"
                    @tap="openGate"
                />
            @elseif ($loading)
                @include ('native.courses.school-calendar-skeleton')
            @elseif ($error !== '')
                <native:error-retry
                    key="calendar-error"
                    :message="$error"
                    :detail="$errorDetail"
                    :retrying="$loading"
                    @retry="retry"
                />
            @elseif ($presented['total'] === 0)
                <native:empty-state
                    key="calendar-empty"
                    message="目前沒有可顯示的學校行事曆。"
                />
            @else
                @if ($presented['countdown'] !== null)
                    <native:row
                        ref="countdown"
                        class="bg-theme-primary-container border-theme-outline-variant w-full items-center justify-between gap-3 rounded-2xl border p-4"
                    >
                        <native:column class="flex-1 gap-1">
                            <native:text
                                class="text-theme-on-primary-container text-base font-semibold"
                                >{{ $presented['countdown']['name'] }}</native:text
                            >
                            <native:text
                                class="text-theme-on-primary-container text-sm"
                                >{{ $presented['countdown']['rangeLabel'] }}</native:text
                            >
                        </native:column>

                        @if ($presented['countdown']['status'] === 'ongoing')
                            <native:column
                                class="bg-theme-success-container rounded-full px-2.5 py-1"
                            >
                                <native:text
                                    class="text-theme-on-success-container text-xs font-semibold"
                                    >進行中</native:text
                                >
                            </native:column>
                        @else
                            <native:column class="items-end">
                                <native:text
                                    class="text-theme-on-primary-container text-3xl font-extrabold"
                                    >{{ max($presented['countdown']['daysUntil'], 0) }}</native:text
                                >
                                <native:text
                                    class="text-theme-on-primary-container text-xs"
                                    >天後</native:text
                                >
                            </native:column>
                        @endif
                    </native:row>
                @endif
                @foreach ([['key' => 'upcoming', 'label' => '即將開始 / 進行中', 'empty' => '目前沒有即將開始或進行中的活動。', 'count' => $presented['upcomingCount']], ['key' => 'ended', 'label' => '已結束', 'empty' => '目前沒有已結束的活動。', 'count' => $presented['endedCount']]] as $group)
                    <native:column
                        class="w-full gap-3"
                        key="calendar-group-{{ $group['key'] }}"
                    >
                        <native:column
                            class="bg-theme-surface-variant border-theme-outline-variant w-full rounded-2xl border px-4 py-3"
                        >
                            <native:text
                                class="text-theme-on-surface text-sm font-semibold"
                                >{{ $group['label'] }}</native:text
                            >
                        </native:column>

                        @forelse ($presented[$group['key']] as $month)
                            <native:column
                                class="w-full gap-2"
                                key="calendar-month-{{ $group['key'] }}-{{ $month['monthKey'] }}"
                            >
                                <native:text
                                    class="text-theme-on-surface-variant px-1 text-xs font-bold"
                                    >{{ $month['monthLabel'] }}</native:text
                                >

                                @foreach ($month['events'] as $event)
                                    <native:row
                                        class="bg-theme-surface border-theme-outline-variant w-full items-start justify-between gap-3 rounded-2xl border p-4"
                                        key="calendar-event-{{ $event['startDate'] }}-{{ $event['endDate'] }}-{{ $event['name'] }}"
                                    >
                                        <native:column class="flex-1 gap-1">
                                            <native:text
                                                class="text-theme-on-surface text-sm font-semibold"
                                                >{{ $event['name'] }}</native:text
                                            >
                                            <native:text
                                                class="text-theme-on-surface-variant text-xs"
                                                >{{ $event['rangeLabel'] }}</native:text
                                            >
                                        </native:column>

                                        @if ($event['status'] === 'ongoing')
                                            <native:column
                                                class="bg-theme-success-container rounded-full px-2.5 py-1"
                                            >
                                                <native:text
                                                    class="text-theme-on-success-container text-xs font-semibold"
                                                    >進行中</native:text
                                                >
                                            </native:column>
                                        @elseif ($event['status'] === 'ended')
                                            <native:column
                                                class="bg-theme-surface-variant rounded-full px-2.5 py-1"
                                            >
                                                <native:text
                                                    class="text-theme-on-surface-variant text-xs font-semibold"
                                                    >已結束</native:text
                                                >
                                            </native:column>
                                        @endif
                                    </native:row>
                                @endforeach
                            </native:column>
                        @empty
                            <native:empty-state
                                key="calendar-empty-{{ $group['key'] }}"
                                :message="$group['empty']"
                            />
                        @endforelse
                    </native:column>
                @endforeach
            @endif
        </native:column>
    </native:refreshable>

    <native:confirm-sheet
        key="nou-tools-gate"
        :visible="$gateVisible"
        title="開啟 NOU 小幫手整合"
        message="此功能需要開啟 NOU 小幫手整合才可使用。"
        confirm-label="開啟"
        @confirm="enableNouTools"
        @cancel="closeGate"
    />

    <native:session-expired-picker
        key="session-expired"
        :visible="$sessionPickerVisible"
        :failed-account-id="$sessionPickerFailedAccountId"
        return-to="{{ $this->route('native.courses.school-calendar') }}"
        @cancel="closeSessionPicker"
        @switched="onSessionPickerSwitched"
    />
</native:column>
