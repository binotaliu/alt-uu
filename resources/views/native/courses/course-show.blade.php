@use ('App\NativeComponents\Courses\CourseShow')
@use ('App\Icons\Android')
@use ('App\Icons\Ios')

<native:column class="bg-theme-background h-full w-full">
    <native:top-bar
        back="true"
        title="{{ $this->courseTitle() }}"
        subtitle="{{ $this->courseSubtitle() }}"
        display-mode="inline"
    >
        <native:top-bar-action
            id="refresh"
            label="重新整理"
            @tap="refresh"
            :ios-icon="Ios::ArrowClockwise"
            :android-icon="Android::Refresh"
        />
    </native:top-bar>

    <native:scroll-view horizontal class="w-full" :shows-indicators="false">
        <native:row class="items-center gap-2 px-3 py-3">
            @foreach (CourseShow::TABS as $tabId => $tabLabel)
                <native:pressable
                    ref="tab-{{ $tabId }}"
                    key="tab-{{ $tabId }}"
                    a11y-label="{{ $tabLabel }}"
                    @tap="selectTab('{{ $tabId }}')"
                >
                    <native:row
                        class="items-center gap-2 rounded-xl px-4 py-2 {{ $activeTab === $tabId ? 'bg-theme-primary' : 'bg-theme-surface' }}"
                    >
                        <native:text
                            class="text-sm font-medium {{ $activeTab === $tabId ? 'text-theme-on-primary' : 'text-theme-on-surface-variant' }}"
                            >{{ $tabLabel }}</native:text
                        >
                        @if ($this->badgeFor($tabId) !== '')
                            <native:column
                                class="rounded-full px-2 py-0.5 {{ $activeTab === $tabId ? 'bg-theme-on-primary' : 'bg-theme-primary' }}"
                            >
                                <native:text
                                    class="text-xs font-semibold {{ $activeTab === $tabId ? 'text-theme-primary' : 'text-theme-on-primary' }}"
                                    >{{ $this->badgeFor($tabId) }}</native:text
                                >
                            </native:column>
                        @endif
                    </native:row>
                </native:pressable>
            @endforeach
        </native:row>
    </native:scroll-view>

    <native:refreshable class="w-full flex-1" @refresh="refresh">
        <native:column class="w-full gap-4 px-3 pb-8">
            @if ($activeTab === 'materials')
                <native:course-materials-tab
                    key="panel-materials"
                    cid="{{ $cid }}"
                    :learning-time-items="$learningTimeItems"
                    :loading="$tabLoading['materials'] ?? false"
                    error="{{ $tabErrors['materials'] ?? '' }}"
                    :error-detail="$tabErrorDetails['materials'] ?? []"
                    :last-seen-identifier="$lastSeenIdentifier"
                    :last-seen-position-seconds="$lastSeenPositionSeconds"
                    :last-seen-duration-seconds="$lastSeenDurationSeconds"
                    @retry="retryTab('materials')"
                />
            @elseif ($activeTab === 'discuss')
                <native:course-discuss-tab
                    key="panel-discuss"
                    course-id="{{ $cid }}"
                    :board-sections="$boardSections"
                    :loading="$tabLoading['discuss'] ?? false"
                    error="{{ $tabErrors['discuss'] ?? '' }}"
                    :error-detail="$tabErrorDetails['discuss'] ?? []"
                    @retry="retryTab('discuss')"
                />
            @elseif ($activeTab === 'homework')
                <native:course-homework-tab
                    key="panel-homework"
                    cid="{{ $cid }}"
                    :items="$homeworkItems"
                    :school-portal-notices="$schoolPortalNotices"
                    :loading="$tabLoading['homework'] ?? false"
                    error="{{ $tabErrors['homework'] ?? '' }}"
                    :error-detail="$tabErrorDetails['homework'] ?? []"
                    @browser-opened="markBrowserOpened('homework')"
                    @retry="retryTab('homework')"
                />
            @elseif ($activeTab === 'self-exam')
                <native:course-self-exam-tab
                    key="panel-self-exam"
                    :items="$selfExamItems"
                    :loading="$tabLoading['self-exam'] ?? false"
                    error="{{ $tabErrors['self-exam'] ?? '' }}"
                    :error-detail="$tabErrorDetails['self-exam'] ?? []"
                    @browser-opened="markBrowserOpened('self-exam')"
                    @retry="retryTab('self-exam')"
                />
            @elseif ($activeTab === 'grades')
                <native:course-grade-tab
                    key="panel-grades"
                    :grade="$grade"
                    :loading="$tabLoading['grades'] ?? false"
                    error="{{ $tabErrors['grades'] ?? '' }}"
                    :error-detail="$tabErrorDetails['grades'] ?? []"
                    @retry="retryTab('grades')"
                />
            @else
                <native:course-info-tab
                    key="panel-course-info"
                    :course="$nouToolsCourse"
                    :nou-tools-enabled="$nouToolsEnabled"
                    :class-session-info="$classSessionInfo"
                    :exam-info="$examInfo"
                    :loading="$tabLoading['course-info'] ?? false"
                    error="{{ $tabErrors['course-info'] ?? '' }}"
                    :error-detail="$tabErrorDetails['course-info'] ?? []"
                    @retry="retryTab('course-info')"
                />
            @endif
        </native:column>
    </native:refreshable>

    <native:session-expired-picker
        key="session-expired"
        :visible="$sessionPickerVisible"
        :failed-account-id="$sessionPickerFailedAccountId"
        return-to="{{ $this->route('native.courses.show', ['cid' => $cid]) }}"
        @cancel="closeSessionPicker"
        @switched="onSessionPickerSwitched"
    />
</native:column>
