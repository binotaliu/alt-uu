@use ('App\Icons\Android')
@use ('App\Icons\Ios')

@if ($loading)
    <native:column
        class="bg-theme-surface border-theme-outline-variant w-full gap-3 rounded-xl border p-4"
        a11y-label="載入中"
    >
        @for ($i = 0; $i < 5; $i++)
            <native:rect
                class="bg-theme-outline-variant h-5 w-2/5 rounded"
                key="skeleton-{{ $i }}"
            />
        @endfor
    </native:column>
@elseif ($error !== '')
    <native:error-retry
        key="error"
        :message="$error"
        :detail="$errorDetail"
        :retrying="$loading"
        @retry="retry"
    />
@elseif ($grade === null)
    <native:empty-state
        key="empty"
        message="本學期查無此課程的教務系統成績資料。"
    />
@else
    <native:column class="w-full gap-4">
        <native:row
            class="bg-theme-surface border-theme-outline-variant w-full items-center justify-between rounded-xl border p-4"
        >
            <native:text
                class="text-theme-on-surface-variant text-sm font-semibold"
                >{{ $grade->semesterLabel }}</native:text
            >
            @if ($grade->credits)
                <native:column
                    class="bg-theme-primary-container rounded-full px-2.5 py-1"
                >
                    <native:text
                        class="text-theme-on-primary-container text-sm font-medium"
                        >{{ $grade->credits }} 學分</native:text
                    >
                </native:column>
            @endif
        </native:row>

        <native:column
            class="bg-theme-surface border-theme-outline-variant w-full gap-3 rounded-xl border p-4"
        >
            <native:text
                class="text-theme-on-surface-variant text-xs font-semibold"
                >平時成績</native:text
            >

            <native:row class="w-full items-center justify-center gap-2">
                @foreach ($this->regularScoreItems() as $index => $item)
                    @if ($index > 0)
                        <native:text class="text-theme-on-surface-variant"
                            >+</native:text
                        >
                    @endif
                    <native:column
                        key="regular-{{ $item['label'] }}"
                        class="border-theme-outline-variant items-center rounded-xl border px-3 py-2"
                    >
                        <native:text
                            class="text-theme-on-surface-variant text-center text-xs"
                            >{{ $item['label'] }}</native:text
                        >
                        <native:text
                            class="text-theme-on-surface text-sm font-semibold"
                            >{{ $item['value'] ?? '無資料' }}</native:text
                        >
                    </native:column>
                @endforeach
            </native:row>

            <native:column class="w-full items-center">
                <native:icon
                    :ios="Ios::ArrowDown"
                    :android="Android::ArrowDownward"
                    :size="18"
                    class="text-theme-on-surface-variant"
                />
            </native:column>

            <native:column
                class="bg-theme-primary-container w-full items-center rounded-xl px-3 py-2"
            >
                <native:text class="text-theme-on-primary-container text-xs"
                    >平時成績</native:text
                >
                <native:text
                    class="text-theme-on-primary-container text-base font-semibold"
                    >{{ $grade->regularAverage ?? '無資料' }}</native:text
                >
            </native:column>
        </native:column>

        <native:column
            class="bg-theme-surface border-theme-outline-variant w-full gap-3 rounded-xl border p-4"
        >
            <native:text
                class="text-theme-on-surface-variant text-xs font-semibold"
                >學期成績</native:text
            >

            <native:row class="w-full items-center justify-center gap-2">
                @foreach ($this->semesterScoreItems() as $index => $item)
                    @if ($index > 0)
                        <native:text class="text-theme-on-surface-variant"
                            >+</native:text
                        >
                    @endif
                    <native:column
                        key="semester-{{ $item['label'] }}"
                        class="border-theme-outline-variant items-center rounded-xl border px-3 py-2"
                    >
                        <native:text
                            class="text-theme-on-surface-variant text-center text-xs"
                            >{{ $item['label'] }}</native:text
                        >
                        <native:text
                            class="text-theme-on-surface text-sm font-semibold"
                            >{{ $item['value'] ?? '無資料' }}</native:text
                        >
                    </native:column>
                @endforeach
            </native:row>

            <native:column class="w-full items-center">
                <native:icon
                    :ios="Ios::ArrowDown"
                    :android="Android::ArrowDownward"
                    :size="18"
                    class="text-theme-on-surface-variant"
                />
            </native:column>

            <native:column
                class="bg-theme-success-container w-full items-center rounded-xl px-3 py-2.5"
            >
                <native:text class="text-theme-on-success-container text-xs"
                    >學期成績</native:text
                >
                <native:text
                    class="text-theme-on-success-container text-xl font-bold"
                    >{{ $grade->semesterGrade ?? '無資料' }}</native:text
                >
            </native:column>
        </native:column>
    </native:column>
@endif
