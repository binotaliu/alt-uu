<native:column class="w-full gap-4">
    <native:row class="w-full gap-2">
        <native:row
            class="bg-theme-surface border-theme-outline-variant flex-1 items-center gap-2 rounded-xl border px-3 py-2"
        >
            <native:text class="text-theme-on-surface-variant text-xs"
                >目前連續</native:text
            >
            <native:spacer />
            <native:column class="items-end">
                <native:text class="text-theme-on-surface text-lg font-bold"
                    >{{ $currentStreak }} 天</native:text
                >
                <native:text
                    class="text-theme-on-surface-variant text-xs"
                    >{{ $currentStartLabel }}</native:text
                >
            </native:column>
        </native:row>
        <native:row
            class="bg-theme-surface border-theme-outline-variant flex-1 items-center gap-2 rounded-xl border px-3 py-2"
        >
            <native:text class="text-theme-on-surface-variant text-xs"
                >最長連續</native:text
            >
            <native:spacer />
            <native:column class="items-end">
                <native:text class="text-theme-on-surface text-lg font-bold"
                    >{{ $longestStreak }} 天</native:text
                >
                <native:text
                    class="text-theme-on-surface-variant text-xs"
                    >{{ $longestRangeLabel }}</native:text
                >
            </native:column>
        </native:row>
    </native:row>

    <native:row
        class="bg-theme-surface border-theme-outline-variant w-full items-center gap-2 rounded-xl border px-3 py-2"
    >
        <native:text class="text-theme-on-surface-variant text-xs"
            >最長單日學習時間</native:text
        >
        <native:spacer />
        <native:column class="items-end">
            <native:text
                class="text-theme-on-surface text-base font-bold"
                >{{ $longestDayLabel }}</native:text
            >
            @if ($longestDayDateLabel !== '')
                <native:text
                    class="text-theme-on-surface-variant text-xs"
                    >{{ $longestDayDateLabel }}</native:text
                >
            @endif
        </native:column>
    </native:row>

    @if ($weeks !== [])
        <native:scroll-view
            horizontal
            class="w-full"
            a11y-label="學習活動熱度圖"
        >
            <native:row class="gap-[3px]">
                <native:column class="gap-[3px]">
                    <native:rect class="h-[12px] w-[12px]" />
                    @foreach ($weekdayLabels as $dayIndex => $label)
                        <native:text
                            class="text-theme-on-surface-variant h-[13px] w-[13px] text-[9px]"
                            key="weekday-{{ $dayIndex }}"
                            >{{ $label }}</native:text
                        >
                    @endforeach
                </native:column>

                @foreach ($weeks as $weekIndex => $week)
                    <native:column
                        class="gap-[3px]"
                        key="week-{{ $weekIndex }}"
                    >
                        <native:text
                            max-lines="1"
                            class="text-theme-on-surface-variant h-[12px] text-[9px]"
                            >{{ $monthLabels[$weekIndex] }}</native:text
                        >
                        @foreach ($week as $dayIndex => $cell)
                            @if ($cell === null)
                                <native:rect
                                    class="h-[13px] w-[13px]"
                                    key="cell-{{ $weekIndex }}-{{ $dayIndex }}"
                                />
                            @else
                                <native:pressable
                                    ref="cell-{{ $cell['date'] }}"
                                    key="cell-{{ $cell['date'] }}"
                                    a11y-label="{{ $cell['date'] }}"
                                    @tap="select('{{ $cell['date'] }}')"
                                >
                                    <native:rect
                                        class="{{ $levelClasses[$levelFor($cell['seconds'])] }} h-[13px] w-[13px] rounded-[3px]"
                                    />
                                </native:pressable>
                            @endif
                        @endforeach
                    </native:column>
                @endforeach
            </native:row>
        </native:scroll-view>
        <native:text
            class="text-theme-on-surface-variant min-h-[16px] text-xs"
            >{{ $selectedCaption ?? '點選方格以檢視當日學習時間' }}</native:text
        >
    @endif
</native:column>
