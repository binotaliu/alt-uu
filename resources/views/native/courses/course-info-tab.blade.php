@if ($loading)
    <native:column
        class="bg-theme-surface border-theme-outline-variant w-full rounded-xl border p-4"
        a11y-label="載入中"
    >
        <native:text class="text-theme-on-surface-variant text-sm"
            >載入課程資訊中...</native:text
        >
    </native:column>
@elseif ($nouToolsEnabled && $error !== '')
    <native:error-retry
        key="error"
        :message="$error"
        :detail="$errorDetail"
        :retrying="$loading"
        @retry="retry"
    />
@else
    <native:column class="w-full gap-4">
        @if (! $nouToolsEnabled)
            <native:column
                class="bg-theme-surface-variant border-theme-outline w-full rounded-xl border p-4"
            >
                <native:text class="text-theme-on-surface-variant text-sm"
                    >開啟「NOU
                    小幫手整合」可以檢視更完整的課程資訊，請至「設定」頁面開啟。</native:text
                >
            </native:column>
        @endif

        @if ($course !== null)
            @include ('native.partials.section-card', ['title' => '基本資訊', 'lines' => $this->basicInfoLines()])

            @if (! empty($course['textbook']))
                <native:column
                    class="bg-theme-surface border-theme-outline-variant w-full gap-2 rounded-xl border p-4"
                >
                    <native:text
                        class="text-theme-on-surface text-base font-semibold"
                        >教材資訊</native:text
                    >
                    <native:text
                        class="text-theme-on-surface text-sm font-medium"
                        >{{ $course['textbook']['bookTitle'] ?? '' }}</native:text
                    >
                    @if (! empty($course['textbook']['edition']))
                        <native:text class="text-theme-on-surface text-sm"
                            >版本：{{ $course['textbook']['edition'] }}</native:text
                        >
                    @endif

                    @if (! empty($course['textbook']['priceInfo']))
                        <native:text class="text-theme-on-surface text-sm"
                            >價格：{{ $course['textbook']['priceInfo'] }}</native:text
                        >
                    @endif

                    @if (! empty($course['textbook']['referenceUrl']))
                        <native:row class="w-full pt-1">
                            <native:button
                                ref="textbook-link"
                                variant="secondary"
                                label="參考連結"
                                @tap="openTextbookLink"
                            />
                        </native:row>
                    @endif
                </native:column>
            @endif
            <native:column
                class="bg-theme-surface border-theme-outline-variant w-full gap-3 rounded-xl border p-4"
            >
                <native:text
                    class="text-theme-on-surface text-base font-semibold"
                    >考古題</native:text
                >

                @forelse (array_values($course['previousExams'] ?? []) as $examIndex => $exam)
                    <native:column
                        key="past-exam-{{ $exam['term'] ?? $examIndex }}"
                        class="border-theme-outline-variant w-full gap-2 rounded-xl border p-3"
                    >
                        <native:text
                            class="text-theme-on-surface text-sm font-semibold"
                            >{{ $exam['term'] ?? '' }}</native:text
                        >
                        <native:row class="w-full flex-wrap gap-2">
                            @foreach ($this->examLinks($exam) as $link)
                                <native:button
                                    ref="exam-{{ $examIndex }}-{{ $link['key'] }}"
                                    key="exam-{{ $exam['term'] ?? $examIndex }}-{{ $link['key'] }}"
                                    variant="secondary"
                                    size="small"
                                    label="{{ $link['label'] }}"
                                    @tap="openExamLink({{ $examIndex }}, '{{ $link['key'] }}')"
                                />
                            @endforeach
                        </native:row>
                    </native:column>
                @empty
                    <native:text class="text-theme-on-surface-variant text-sm"
                        >尚無可用考古題。</native:text
                    >
                @endforelse
            </native:column>
        @endif

        @if ($classSessionInfo !== null)
            @include ('native.partials.section-card', ['title' => '上課資訊', 'lines' => $this->classSessionLines()])
        @endif

        @if ($examInfo !== null && count($examInfo->schedules) > 0)
            <native:column
                class="bg-theme-surface border-theme-outline-variant w-full gap-3 rounded-xl border p-4"
            >
                <native:text
                    class="text-theme-on-surface text-base font-semibold"
                    >考試時間</native:text
                >
                @foreach ($examInfo->schedules as $schedule)
                    <native:column
                        key="schedule-{{ $schedule->category }}"
                        class="border-theme-outline-variant w-full gap-1 rounded-xl border p-3"
                    >
                        <native:text
                            class="text-theme-on-surface text-sm font-semibold"
                            >{{ $schedule->category }}</native:text
                        >
                        @if ($schedule->date)
                            <native:text
                                class="text-theme-on-surface-variant text-sm"
                                >日期：{{ $schedule->date }}</native:text
                            >
                        @endif

                        @if ($schedule->time)
                            <native:text
                                class="text-theme-on-surface-variant text-sm"
                                >時間：{{ \App\NativeComponents\Courses\CourseInfoTab::formatTimeRange($schedule->time) }}</native:text
                            >
                        @endif

                        @if ($schedule->room)
                            <native:text
                                class="text-theme-on-surface-variant text-sm"
                                >教室代號：{{ $schedule->room }}</native:text
                            >
                        @endif

                        @if ($schedule->note)
                            <native:text
                                class="text-theme-on-surface-variant text-sm"
                                >{{ $schedule->note }}</native:text
                            >
                        @endif
                    </native:column>
                @endforeach
            </native:column>
        @endif

        @if ($examInfo !== null && count($examInfo->scopes) > 0)
            <native:column
                class="bg-theme-surface border-theme-outline-variant w-full gap-3 rounded-xl border p-4"
            >
                <native:text
                    class="text-theme-on-surface text-base font-semibold"
                    >考試命題範圍</native:text
                >
                @foreach ($examInfo->scopes as $scope)
                    <native:column
                        key="scope-{{ $scope->category }}"
                        class="border-theme-outline-variant w-full gap-1 rounded-xl border p-3"
                    >
                        <native:text
                            class="text-theme-on-surface text-sm font-semibold"
                            >{{ $scope->category }}</native:text
                        >
                        <native:text
                            class="text-theme-on-surface-variant text-sm"
                            >{{ $scope->scope }}</native:text
                        >
                    </native:column>
                @endforeach
            </native:column>
        @endif

        @if ($course === null && ! $this->hasSchoolPortalInfo())
            <native:empty-state
                key="empty"
                message="NOU 小幫手與教務系統目前都沒有這門課的可用資訊。"
            />
        @endif
    </native:column>
@endif
