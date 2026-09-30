@use ('App\Icons\Android')
@use ('App\Icons\Ios')

<native:column class="bg-theme-background h-full w-full">
    <native:refreshable @refresh="refresh">
        <native:column class="w-full gap-4 px-4 pt-3 pb-6">
            @if (! $nouToolsEnabled)
                <native:empty-state
                    key="live-gate"
                    title="開啟 NOU 小幫手整合"
                    message="此功能需要開啟 NOU 小幫手整合才可使用。"
                />
                <native:button
                    ref="open-gate"
                    variant="primary"
                    label="開啟 NOU 小幫手整合"
                    @tap="openGate"
                />
            @else
                @if ($hasMultipleAccounts)
                    @include ('native.courses.segmented', [
                        'options' => [
                            ['label' => '目前帳號', 'ref' => 'scope-current', 'tap' => 'setAllAccounts(false)', 'active' => ! $showAllAccounts],
                            ['label' => '所有帳號', 'ref' => 'scope-all', 'tap' => 'setAllAccounts(true)', 'active' => $showAllAccounts],
                        ],
                    ])
                @endif
                @if ($showTimezoneSelector)
                    <native:column
                        class="bg-theme-surface border-theme-outline-variant w-full gap-2 rounded-2xl border p-4"
                    >
                        <native:text
                            class="text-theme-on-surface text-sm font-semibold"
                            >選擇顯示的時區</native:text
                        >
                        <native:text
                            class="text-theme-on-surface-variant text-xs"
                            >系統偵測到你的時區是 {{ $detectedTimezoneLabel }}，你可以選擇本頁顯示的時區。</native:text
                        >
                        @include ('native.courses.segmented', [
                            'options' => [
                                ['label' => '台灣時區', 'ref' => 'timezone-taiwan', 'tap' => "setDisplayTimezone('taiwan')", 'active' => $displayTimezone === 'taiwan'],
                                ['label' => '我的時區', 'ref' => 'timezone-local', 'tap' => "setDisplayTimezone('local')", 'active' => $displayTimezone === 'local'],
                            ],
                        ])
                    </native:column>
                @endif
                @if ($loading)
                    @include ('native.courses.live-sessions-skeleton')
                @elseif ($error !== '')
                    <native:error-retry
                        key="live-error"
                        :message="$error"
                        :detail="$errorDetail"
                        :retrying="$loading"
                        @retry="retry"
                    />
                @elseif ($presented['total'] === 0)
                    <native:empty-state
                        key="live-empty"
                        message="目前沒有可顯示的視訊面授班級資訊。"
                    />
                @else
                    @foreach ([['key' => 'upcoming', 'label' => '即將開始 / 進行中', 'empty' => '目前沒有即將開始或進行中的視訊面授。'], ['key' => 'ended', 'label' => '已結束', 'empty' => '目前沒有已結束的視訊面授。']] as $group)
                        <native:column
                            class="w-full gap-3"
                            key="live-group-{{ $group['key'] }}"
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
                                    key="live-month-{{ $group['key'] }}-{{ $month['monthKey'] }}"
                                >
                                    <native:text
                                        class="text-theme-on-surface-variant px-1 text-xs font-bold"
                                        >{{ $month['monthLabel'] }}</native:text
                                    >

                                    @foreach ($month['sessions'] as $session)
                                        <native:column
                                            class="bg-theme-surface border-theme-outline-variant w-full rounded-2xl border p-4"
                                            key="live-session-{{ $session['tapKey'] }}"
                                        >
                                            <native:row
                                                class="w-full items-start gap-3"
                                            >
                                                <native:column
                                                    class="w-20 items-center gap-1"
                                                >
                                                    @if ($showAccountLabel && $session['accountLabel'] !== '')
                                                        <native:column
                                                            class="bg-theme-primary-container rounded-full px-2 py-0.5"
                                                        >
                                                            <native:text
                                                                max-lines="1"
                                                                class="text-theme-on-primary-container text-xs font-medium"
                                                                >{{ $session['accountLabel'] }}</native:text
                                                            >
                                                        </native:column>
                                                    @endif

                                                    <native:column
                                                        class="bg-theme-primary-container w-full items-center rounded-lg px-2 py-2"
                                                    >
                                                        <native:text
                                                            class="text-theme-on-primary-container text-lg font-bold"
                                                            >{{ $session['monthDay'] }}</native:text
                                                        >
                                                        <native:text
                                                            class="text-theme-on-primary-container text-sm"
                                                            >{{ $session['weekday'] }}</native:text
                                                        >
                                                    </native:column>
                                                </native:column>

                                                <native:column
                                                    class="flex-1 gap-1"
                                                >
                                                    <native:row
                                                        class="w-full items-start justify-between gap-2"
                                                    >
                                                        <native:text
                                                            max-lines="2"
                                                            class="text-theme-on-surface flex-1 text-sm font-semibold"
                                                            >{{ $session['courseName'] }}</native:text
                                                        >
                                                        @if ($session['status'] === 'ongoing')
                                                            <native:column
                                                                class="bg-theme-success-container rounded-full px-2.5 py-1"
                                                            >
                                                                <native:text
                                                                    class="text-theme-on-success-container text-xs font-semibold"
                                                                    >進行中</native:text
                                                                >
                                                            </native:column>
                                                        @elseif ($session['status'] === 'ended')
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

                                                    <native:text
                                                        class="text-theme-on-surface-variant text-xs"
                                                        >{{ $session['className'] }}・{{ $session['typeLabel'] }}</native:text
                                                    >
                                                    <native:text
                                                        class="text-theme-on-surface-variant text-xs"
                                                        >{{ $session['teacher'] }}</native:text
                                                    >
                                                    <native:text
                                                        class="text-theme-on-surface pt-1 text-sm font-medium"
                                                        >{{ $session['startClock'] }} - {{ $session['endClock'] }}</native:text
                                                    >
                                                </native:column>
                                            </native:row>

                                            @if ($session['link'] || $session['backupClassroomUrl'])
                                                <native:row
                                                    class="w-full items-center justify-end gap-3 pt-3"
                                                >
                                                    @if ($session['backupClassroomUrl'])
                                                        <native:button
                                                            ref="backup-{{ $session['tapKey'] }}"
                                                            variant="secondary"
                                                            label="備用教室"
                                                            a11y-hint="主教室人數已滿時可改用此備用連結"
                                                            @tap="enterClassroom('{{ $session['tapKey'] }}', 'backup')"
                                                        />
                                                    @endif
                                                    @if ($session['link'])
                                                        <native:button
                                                            ref="enter-{{ $session['tapKey'] }}"
                                                            variant="primary"
                                                            label="進入教室"
                                                            :icon="'videocam'"
                                                            @tap="enterClassroom('{{ $session['tapKey'] }}', 'link')"
                                                        />
                                                    @endif
                                                </native:row>
                                            @endif
                                        </native:column>
                                    @endforeach
                                </native:column>
                            @empty
                                <native:empty-state
                                    key="live-empty-{{ $group['key'] }}"
                                    :message="$group['empty']"
                                />
                            @endforelse
                        </native:column>
                    @endforeach
                @endif
            @endif
        </native:column>
    </native:refreshable>

    <native:confirm-sheet
        key="nou-tools-gate"
        ref-prefix="gate-"
        :visible="$gateVisible"
        title="開啟 NOU 小幫手整合"
        message="此功能需要開啟 NOU 小幫手整合才可使用。"
        confirm-label="開啟"
        @confirm="enableNouTools"
        @cancel="closeGate"
    />

    <native:live-session-nickname-sheet
        key="nickname-sheet"
        :visible="$nicknameSheetVisible"
        :nickname="$pendingNickname"
        :url="$pendingUrl"
        :email="$pendingEmail"
        @close="closeNicknameSheet"
        @entered="confirmNickname"
    />

    <native:session-expired-picker
        key="session-expired"
        :visible="$sessionPickerVisible"
        :failed-account-id="$sessionPickerFailedAccountId"
        return-to="{{ $this->route('native.courses.live-sessions') }}"
        @cancel="closeSessionPicker"
        @switched="onSessionPickerSwitched"
    />
</native:column>
