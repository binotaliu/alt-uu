@use ('App\NativeComponents\Account\Grades')

<native:column class="bg-theme-background h-full w-full">
    <native:scroll-view class="w-full flex-1">
        <native:column class="w-full gap-4 p-4">
            @if ($loading)
                <native:column
                    class="bg-theme-surface border-theme-outline-variant w-full items-center rounded-xl border p-4"
                >
                    <native:text
                        class="text-theme-on-surface-variant text-center text-sm"
                        >載入成績中…</native:text
                    >
                </native:column>
            @elseif ($error !== '')
                <native:error-retry
                    key="grades-error"
                    :message="$error"
                    :retrying="false"
                    @retry="loadGrades"
                />
            @elseif ($groups === [])
                <native:empty-state
                    key="grades-empty"
                    message="查無成績資料。"
                />
            @endif

            @foreach ($groups as $group)
                <native:column
                    key="semester-{{ $loop->index }}"
                    class="w-full gap-2"
                >
                    <native:text
                        class="text-theme-on-surface-variant px-1 text-sm font-semibold"
                        >{{ $group['semesterLabel'] }}</native:text
                    >

                    @foreach ($group['grades'] as $grade)
                        @php
                            $semesterGrade = $grade->semesterGrade;
                            $hasGrade = $semesterGrade !== null && $semesterGrade !== '';
                            $passing = Grades::isScorePassing($semesterGrade);
                            $numeric = $hasGrade && is_numeric($semesterGrade);
                        @endphp
                        <native:row
                            key="grade-{{ $loop->parent->index }}-{{ $loop->index }}"
                            class="bg-theme-surface border-theme-outline-variant w-full items-center gap-3 rounded-xl border p-4"
                        >
                            <native:column class="flex-1 gap-2">
                                <native:text
                                    class="text-theme-on-surface text-base font-medium"
                                    >{{ $grade->courseName }}</native:text
                                >
                                <native:row class="w-full flex-wrap gap-2">
                                    @foreach (Grades::detailItems($grade) as $item)
                                        <native:row
                                            key="item-{{ $loop->index }}"
                                            class="items-center gap-1"
                                        >
                                            <native:text
                                                class="text-theme-on-surface-variant text-xs"
                                                >{{ $item['label'] }}</native:text
                                            >
                                            <native:text
                                                class="text-theme-on-surface text-xs font-medium"
                                                >{{ $item['value'] }}</native:text
                                            >
                                        </native:row>
                                    @endforeach
                                </native:row>
                            </native:column>

                            @if (! $numeric)
                                <native:column
                                    class="bg-theme-surface-variant rounded px-2.5 py-1"
                                >
                                    <native:text
                                        class="text-theme-on-surface-variant text-lg font-semibold"
                                        >{{ $hasGrade ? $semesterGrade : '—' }}</native:text
                                    >
                                </native:column>
                            @elseif ($passing)
                                <native:column
                                    class="bg-theme-success-container rounded px-2.5 py-1"
                                >
                                    <native:text
                                        class="text-theme-on-success-container text-lg font-semibold"
                                        >{{ $semesterGrade }}</native:text
                                    >
                                </native:column>
                            @else
                                <native:column
                                    class="bg-theme-destructive-container rounded px-2.5 py-1"
                                >
                                    <native:text
                                        class="text-theme-on-destructive-container text-lg font-semibold"
                                        >{{ $semesterGrade }}</native:text
                                    >
                                </native:column>
                            @endif
                        </native:row>
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
