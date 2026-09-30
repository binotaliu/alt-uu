@use ('App\NativeComponents\Account\ExamInfo')

<native:column class="bg-theme-background h-full w-full">
    <native:scroll-view class="w-full flex-1">
        <native:column class="w-full gap-4 p-4">
            @if ($loading)
                <native:column
                    class="bg-theme-surface border-theme-outline-variant w-full items-center rounded-xl border p-4"
                >
                    <native:text
                        class="text-theme-on-surface-variant text-center text-sm"
                        >載入考試資訊中…</native:text
                    >
                </native:column>
            @elseif ($error !== '')
                <native:error-retry
                    key="exam-error"
                    :message="$error"
                    :retrying="false"
                    @retry="loadAgenda"
                />
            @elseif ($groups === [])
                <native:empty-state key="exam-empty" message="查無考試資訊。" />
            @endif

            @foreach ($groups as $group)
                <native:column
                    key="group-{{ $loop->index }}"
                    class="w-full gap-3"
                >
                    <native:text
                        class="text-theme-on-surface-variant px-1 text-sm font-semibold"
                        >{{ $group['label'] }}</native:text
                    >

                    @foreach ($group['dateGroups'] as $dateGroup)
                        <native:column
                            key="date-{{ $loop->parent->index }}-{{ $loop->index }}"
                            class="w-full gap-2"
                        >
                            @if ($dateGroup['date'] !== '')
                                <native:text
                                    class="text-theme-on-surface-variant px-1 text-xs font-medium"
                                    >{{ $dateGroup['date'] }}</native:text
                                >
                            @endif

                            @foreach ($dateGroup['items'] as $item)
                                <native:column
                                    key="exam-{{ $loop->parent->parent->index }}-{{ $loop->parent->index }}-{{ $loop->index }}"
                                    class="bg-theme-surface border-theme-outline-variant w-full gap-2 rounded-xl border p-4"
                                >
                                    <native:text
                                        class="text-theme-on-surface text-base font-medium"
                                        >{{ $item->courseName }}</native:text
                                    >
                                    <native:row class="w-full flex-wrap gap-2">
                                        <native:row class="items-center gap-1">
                                            <native:text
                                                class="text-theme-on-surface-variant text-xs"
                                                >時間</native:text
                                            >
                                            <native:text
                                                class="text-theme-on-surface text-xs font-medium"
                                                >{{ ExamInfo::formatTimeRange($item->time) }}</native:text
                                            >
                                        </native:row>
                                        @if ($item->room)
                                            <native:row
                                                class="items-center gap-1"
                                            >
                                                <native:text
                                                    class="text-theme-on-surface-variant text-xs"
                                                    >教室</native:text
                                                >
                                                <native:text
                                                    class="text-theme-on-surface text-xs font-medium"
                                                    >{{ $item->room }}</native:text
                                                >
                                            </native:row>
                                        @endif
                                    </native:row>
                                </native:column>
                            @endforeach
                        </native:column>
                    @endforeach
                </native:column>
            @endforeach
        </native:column>
    </native:scroll-view>

    <native:session-expired-picker
        key="session-expired"
        :visible="$sessionPickerVisible"
        :failed-account-id="$sessionPickerFailedAccountId"
        return-to="{{ $returnTo }}"
        @cancel="closeSessionPicker"
        @switched="onSessionPickerSwitched"
    />
</native:column>
