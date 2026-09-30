<native:column class="bg-theme-background h-full w-full">
    <native:refreshable @refresh="refresh">
        <native:column class="w-full gap-4 px-4 pt-3 pb-6">
            <native:app-status-banners key="app-status" />

            @if ($loading)
                @include ('native.partials.course-skeleton', ['groups' => 2, 'cards' => 5])
            @elseif ($error !== '')
                <native:error-retry
                    key="courses-error"
                    :message="$error"
                    :detail="$errorDetail"
                    :retrying="$loading"
                    @retry="retry"
                />
            @elseif ($courses === [])
                <native:empty-state
                    key="courses-empty"
                    message="您的帳號目前未有課程，期待下學期與您在課堂上見面"
                />
            @else
                <native:column class="w-full gap-6">
                    @foreach ($semesterGroups as $semester => $semesterCards)
                        <native:column
                            class="w-full gap-3"
                            key="semester-{{ $semester }}"
                        >
                            <native:text
                                class="text-theme-on-surface-variant text-sm font-semibold"
                                >{{ $semester }}</native:text
                            >
                            @foreach ($semesterCards as $card)
                                <native:course-card
                                    key="course-{{ $card['course']->courseId }}"
                                    :course="$card['course']"
                                    :pending-homeworks="$card['pendingHomeworks']"
                                    :unread-articles="$card['unreadArticles']"
                                    :tasks-loading="$tasksLoading"
                                    :tasks-error="$tasksError"
                                />
                            @endforeach
                        </native:column>
                    @endforeach
                </native:column>
            @endif
        </native:column>
    </native:refreshable>

    <native:whats-new-sheet
        key="whats-new"
        :visible="$whatsNewVisible"
        @close="closeWhatsNew"
    />

    <native:session-expired-picker
        key="session-expired"
        :visible="$sessionPickerVisible"
        :failed-account-id="$sessionPickerFailedAccountId"
        return-to="{{ $this->route('native.courses.index') }}"
        @cancel="closeSessionPicker"
        @switched="onSessionPickerSwitched"
    />
</native:column>
