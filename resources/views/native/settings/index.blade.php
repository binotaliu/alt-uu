@use ('App\Icons\Android')
@use ('App\Icons\Ios')

<native:stack class="h-full w-full">
    <native:scroll-view class="bg-theme-background h-full w-full">
        <native:column class="w-full gap-4 p-4 pb-16">
            <native:column class="w-full items-center gap-2 py-4">
                <native:icon
                    :ios="Ios::GraduationcapFill"
                    :android="Android::School"
                    :size="56"
                    class="text-theme-accent"
                />
                <native:text class="text-theme-accent text-2xl font-extrabold"
                    >Alt UU</native:text
                >
                <native:pressable
                    ref="app-version"
                    a11y-label="應用程式版本"
                    @tap="registerVersionTap"
                >
                    <native:text
                        class="text-theme-accent text-base font-semibold select-none"
                        >{{ $appDisplayVersion }}{{ $buildNumberRevealed ? ' ('.$appVersionCode.')' : '' }}</native:text
                    >
                </native:pressable>
            </native:column>

            {{-- 外觀與主題色 --}}
            <native:column
                class="bg-theme-surface border-theme-outline-variant w-full gap-3 rounded-xl border p-4"
            >
                <native:column class="gap-1">
                    <native:text
                        class="text-theme-on-surface text-sm font-semibold"
                        >外觀</native:text
                    >
                    <native:text class="text-theme-on-surface-variant text-xs"
                        >選擇深色或淺色模式，或依照系統設定自動切換。</native:text
                    >
                </native:column>

                <native:row
                    class="bg-theme-surface-variant border-theme-outline-variant w-full gap-1 rounded-xl border p-1"
                >
                    @foreach ([['system', '自動'], ['light', '淺色'], ['dark', '深色']] as [$value, $label])
                        <native:pressable
                            class="flex-1"
                            ref="appearance-{{ $value }}"
                            key="appearance-{{ $value }}"
                            a11y-label="{{ $label }}"
                            @tap="selectAppearance('{{ $value }}')"
                        >
                            <native:column
                                class="{{ $appearance === $value ? 'bg-theme-surface' : '' }} w-full items-center rounded-lg px-3 py-2"
                            >
                                <native:text
                                    class="{{ $appearance === $value ? 'text-theme-on-surface' : 'text-theme-on-surface-variant' }} text-sm font-medium"
                                    >{{ $label }}</native:text
                                >
                            </native:column>
                        </native:pressable>
                    @endforeach
                </native:row>

                @if (! $altUuPlusDisabled)
                    <native:row class="items-center gap-2 pt-2">
                        <native:text
                            class="text-theme-on-surface-variant text-xs font-medium"
                            >主題色</native:text
                        >
                        @if (! $subscriptionActive)
                            <native:premium-badge key="accent-premium" />
                        @endif
                    </native:row>
                    <native:row
                        class="w-full items-center justify-between gap-2"
                    >
                        @foreach ($accents as $option)
                            <native:pressable
                                ref="accent-{{ $option['id'] }}"
                                key="accent-{{ $option['id'] }}"
                                a11y-label="{{ $option['label'] }}"
                                @tap="selectAccent('{{ $option['id'] }}')"
                            >
                                <native:column
                                    class="bg-[{{ $option['swatch'] }}] {{ $accentColor === $option['id'] ? 'border-theme-on-surface' : 'border-theme-outline-variant' }} h-9 w-9 items-center justify-center rounded-xl border-2"
                                >
                                    @if ($accentColor === $option['id'])
                                        <native:icon
                                            :ios="Ios::Checkmark"
                                            :android="Android::Check"
                                            :size="18"
                                            class="text-white"
                                        />
                                    @elseif (! $subscriptionActive && $option['id'] !== 'warm')
                                        <native:icon
                                            :ios="Ios::LockFill"
                                            :android="Android::Lock"
                                            :size="14"
                                            class="text-white"
                                        />
                                    @endif
                                </native:column>
                            </native:pressable>
                        @endforeach
                    </native:row>
                @endif
            </native:column>

            {{-- 偏好設定開關 --}}
            @foreach ([
                ['nouToolsIntegrationEnabled', '開啟 NOU 小幫手整合', '開啟此選項以讓 Alt UU 從 NOU 小幫手取得課程資訊與視訊面授資訊。部分詮釋資料可能會傳送給 NOU 小幫手以提供此功能。', $nouToolsIntegrationEnabled],
                ['screenReaderEnhancedSupportEnabled', '加強螢幕閱讀器支援', '若您使用螢幕閱讀器，如 VoiceOver、TalkBack、NVDA 或 JAWS，開啟此選項可讓 Alt UU 在教材頁中使用對螢幕閱讀器較友善的播放器。', $screenReaderEnhancedSupportEnabled],
                ['liveSessionNicknameModalEnabled', '視訊面授前顯示暱稱設定提示', '開啟此選項後，點擊「進入教室」或「備用教室」時會先顯示提示視窗，告訴您應設定的顯示暱稱並提供複製功能，再進入教室。', $liveSessionNicknameModalEnabled],
                ['cellularPlaybackWarningEnabled', '行動網路播放提醒', '開啟此選項後，透過行動網路（非 Wi-Fi）觀看教材影音前，會先詢問是否繼續播放，避免消耗過多行動數據。', $cellularPlaybackWarningEnabled],
                ['altUuPlusDisabled', '關閉 Alt UU+ 功能', '在界面上隱藏 Alt UU+ 專屬功能，包括主題色、學習統計與資料匯出入。請注意：若你已有 Alt UU+ 訂閱，開啟此選項並不會取消訂閱。', $altUuPlusDisabled],
            ] as [$prefKey, $prefLabel, $prefDescription, $prefValue])
                <native:column
                    class="bg-theme-surface border-theme-outline-variant w-full rounded-xl border px-4 py-1"
                >
                    <native:toggle-row
                        key="pref-{{ $prefKey }}"
                        label="{{ $prefLabel }}"
                        description="{{ $prefDescription }}"
                        :value="$prefValue"
                        :saving="$savingKey === $prefKey"
                        @toggled="savePreference('{{ $prefKey }}')"
                    />
                </native:column>
            @endforeach

            {{-- 附件下載 --}}
            <native:column
                class="bg-theme-surface border-theme-outline-variant w-full gap-3 rounded-xl border p-4"
            >
                <native:column class="gap-1">
                    <native:text
                        class="text-theme-on-surface text-sm font-semibold"
                        >附件下載</native:text
                    >
                    <native:text class="text-theme-on-surface-variant text-xs"
                        >清除先前下載到本機的附件檔案，釋放裝置儲存空間。</native:text
                    >
                </native:column>
                <native:button
                    ref="clear-attachments"
                    variant="secondary"
                    :label="$clearingAttachments ? '清除中...' : '清除已下載附件'"
                    :loading="$clearingAttachments"
                    :ios-icon="Ios::Trash"
                    :android-icon="Android::Delete"
                    @tap="confirmClearAttachments"
                />
                @if ($attachmentCleanupSummary)
                    <native:text
                        ref="cleanup-summary"
                        class="text-theme-success text-xs"
                        >{{ $attachmentCleanupSummary }}</native:text
                    >
                @endif
                @if ($attachmentCleanupError)
                    <native:text
                        ref="cleanup-error"
                        class="text-theme-destructive text-xs"
                        >{{ $attachmentCleanupError }}</native:text
                    >
                @endif
            </native:column>

            {{-- 疑難排解 --}}
            <native:column
                class="bg-theme-surface border-theme-outline-variant w-full gap-3 rounded-xl border p-4"
            >
                <native:column class="gap-1">
                    <native:text
                        class="text-theme-on-surface text-sm font-semibold"
                        >疑難排解</native:text
                    >
                    <native:text class="text-theme-on-surface-variant text-xs"
                        >若您遇到連線問題，可以檢查各項服務目前是否可正常連線。</native:text
                    >
                </native:column>
                <native:button
                    ref="open-diagnostics"
                    variant="secondary"
                    label="連線診斷"
                    :ios-icon="Ios::Wifi"
                    :android-icon="Android::Wifi"
                    @tap="openDiagnostics"
                />

                @if ($materialSourceViewerEnabled)
                    <native:divider />
                    <native:column class="gap-1">
                        <native:text
                            class="text-theme-on-surface text-sm font-semibold"
                            >教材來源檢視</native:text
                        >
                        <native:text
                            class="text-theme-on-surface-variant text-xs"
                            >教材目錄或內容顯示不出來時，可以檢視學校實際送來的目錄網址與頁面原始碼。</native:text
                        >
                    </native:column>
                    <native:button
                        ref="open-material-source"
                        variant="secondary"
                        label="檢視來源"
                        :ios-icon="Ios::DocTextMagnifyingglass"
                        :android-icon="Android::Search"
                        @tap="openMaterialSource"
                    />
                @endif

                @if ($recordingAvailable)
                    <native:divider />
                    <native:toggle-row
                        key="recording"
                        label="紀錄診斷紀錄以協助瞭解問題"
                        description="開啟後會記錄 App 的請求與錯誤，方便回報問題時附上。為了節省效能與空間，會在 {{ $recordingWindowMinutes }} 分鐘後自動關閉，記錄也會在 {{ $recordingRetentionDays }} 天後自動清除。"
                        :value="$recordingNow"
                        :saving="$savingRecording"
                        @toggled="setRecording"
                    />
                    @if ($recordingNow)
                        <native:text
                            ref="recording-remaining"
                            native:poll="30s"
                            class="text-theme-success text-xs font-medium"
                            >記錄中，約 {{ $minutesRemaining }} 分鐘後自動關閉。</native:text
                        >
                    @endif
                    @if ($recordingError)
                        <native:text
                            ref="recording-error"
                            class="text-theme-destructive text-xs"
                            >{{ $recordingError }}</native:text
                        >
                    @endif
                    <native:button
                        ref="open-diagnostic-log"
                        variant="secondary"
                        label="檢視診斷記錄"
                        :ios-icon="Ios::DocText"
                        :android-icon="Android::Description"
                        @tap="openDiagnosticLog"
                    />
                @endif
            </native:column>

            {{-- 聯絡資訊與政策 --}}
            <native:column
                class="bg-theme-surface border-theme-outline-variant w-full gap-2 rounded-xl border p-4"
            >
                <native:text class="text-theme-on-surface text-sm font-semibold"
                    >聯絡資訊與政策</native:text
                >
                <native:button
                    ref="contact"
                    variant="secondary"
                    label="聯絡本 App 作者"
                    :ios-icon="Ios::Envelope"
                    :android-icon="Android::Email"
                    @tap="contactAuthor"
                />
                <native:button
                    ref="terms"
                    variant="secondary"
                    label="使用條款"
                    :ios-icon="Ios::DocText"
                    :android-icon="Android::Description"
                    @tap="openTerms"
                />
                <native:button
                    ref="privacy"
                    variant="secondary"
                    label="隱私權政策"
                    :ios-icon="Ios::CheckmarkShield"
                    :android-icon="Android::Shield"
                    @tap="openPrivacyPolicy"
                />
                <native:button
                    ref="whats-new"
                    variant="secondary"
                    label="檢視新功能"
                    :ios-icon="Ios::Sparkles"
                    :android-icon="Android::AutoAwesome"
                    @tap="openWhatsNew"
                />
                <native:button
                    ref="source-code"
                    variant="secondary"
                    label="App 原始碼"
                    :ios-icon="Ios::ChevronLeftForwardslashChevronRight"
                    :android-icon="Android::Code"
                    @tap="openSourceCode"
                />
                <native:text class="text-theme-on-surface-variant pt-1 text-sm"
                    >本程式為 AGPL-3.0-or-later
                    開放原始碼授權軟體。任何人均可自由取得原始碼、修改、編譯、再發佈，惟須維持相同授權方式。</native:text
                >
            </native:column>

            {{-- 鳴謝 --}}
            <native:column
                class="bg-theme-surface border-theme-outline-variant w-full gap-2 rounded-xl border p-4"
            >
                <native:text class="text-theme-on-surface text-sm font-semibold"
                    >鳴謝</native:text
                >
                <native:text class="text-theme-on-surface-variant text-sm"
                    >Alt UU 的誕生離不開許多人的幫助，特別是 Laravel 社群與 Vue
                    社群豐富的生態，以及所有參與 Alt UU
                    公開測試的同學。以下是一些 Alt UU
                    使用到的開放原始碼專案與其授權。您應該可以在本專案的 GitHub
                    Repository 內找到更多資訊。</native:text
                >
                @foreach (['Laravel (MIT License)', 'Vue (MIT License)', 'Vue Router (MIT License)', 'Tailwind CSS (MIT License)', 'Heroicons (MIT License)', 'NativePHP (MIT License)'] as $credit)
                    <native:text
                        key="credit-{{ $credit }}"
                        class="text-theme-on-surface-variant text-sm"
                        >{{ '・'.$credit }}</native:text
                    >
                @endforeach
            </native:column>
        </native:column>
    </native:scroll-view>

    <native:whats-new-sheet
        key="whats-new"
        :visible="$whatsNewVisible"
        @close="closeWhatsNew"
    />
</native:stack>
