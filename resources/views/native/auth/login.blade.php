@use ('App\Icons\Android')
@use ('App\Icons\Ios')

<native:scroll-view class="bg-theme-background h-full w-full">
    <native:column class="safe-area w-full items-center gap-5 p-4">
        <native:row class="items-center justify-center gap-3 pt-6">
            <native:icon
                :ios="Ios::Graduationcap"
                :android="Android::School"
                :size="56"
                class="text-theme-accent"
            />
            <native:text class="text-theme-accent text-2xl font-extrabold"
                >Alt UU</native:text
            >
        </native:row>

        <native:column
            class="bg-theme-surface border-theme-outline-variant w-full gap-4 rounded-3xl border p-5"
        >
            <native:column class="w-full gap-1">
                <native:text class="text-theme-on-surface text-xl font-semibold"
                    >登入 NOU UU 平台</native:text
                >
                <native:text class="text-theme-on-surface-variant text-sm"
                    >請輸入 NOU UU
                    平台之登入資訊。所有資訊都將在您的裝置上直接與 NOU UU
                    平台建立安全通訊，不會傳送至其他伺服器。</native:text
                >
            </native:column>

            <native:outlined-text-input
                ref="username"
                native:model="username"
                label="帳號"
                placeholder="請輸入學號或帳號"
                leading-icon="person"
                autocapitalize="none"
                :disabled="$processing"
                :is-error="$error !== ''"
                a11y-label="帳號"
            />

            <native:outlined-text-input
                ref="password"
                native:model="password"
                label="密碼"
                placeholder="請輸入密碼"
                leading-icon="lock"
                secure
                revealable
                :disabled="$processing"
                :is-error="$error !== ''"
                a11y-label="密碼"
                @submit="submit"
            />

            @if ($error !== '')
                <native:text
                    ref="error"
                    class="text-theme-destructive text-sm"
                    >{{ $error }}</native:text
                >
            @endif

            <native:button
                ref="submit"
                :label="$processing ? '登入中...' : '登入'"
                :loading="$processing"
                :disabled="$processing"
                class="w-full"
                @tap="submit"
            />

            @if ($rawResponse !== null)
                <native:column class="w-full gap-2">
                    <native:pressable
                        ref="toggle-raw"
                        a11y-label="伺服器回應內容"
                        @tap="toggleRawResponse"
                    >
                        <native:text
                            class="text-theme-on-surface-variant text-xs"
                            >若登入持續失敗，可展開檢視伺服器回應內容</native:text
                        >
                    </native:pressable>
                    @if ($showRawResponse)
                        <native:column
                            class="bg-theme-surface-variant border-theme-outline-variant w-full rounded-xl border p-2"
                        >
                            <native:text
                                ref="raw-response"
                                class="text-theme-on-surface-variant text-xs select-text"
                                >{{ $rawResponse }}</native:text
                            >
                        </native:column>
                    @endif
                </native:column>
            @endif

            <native:row class="w-full flex-wrap items-center">
                <native:text class="text-theme-on-surface-variant text-xs"
                    >登入即表示您已閱讀並同意本 App 之</native:text
                >
                <native:pressable
                    ref="usage-policy"
                    a11y-label="使用條款"
                    @tap="openUsagePolicy"
                >
                    <native:text class="text-theme-accent text-xs underline"
                        >《使用條款》</native:text
                    >
                </native:pressable>
                <native:text class="text-theme-on-surface-variant text-xs"
                    >與</native:text
                >
                <native:pressable
                    ref="privacy-policy"
                    a11y-label="隱私權政策"
                    @tap="openPrivacyPolicy"
                >
                    <native:text class="text-theme-accent text-xs underline"
                        >《隱私權政策》</native:text
                    >
                </native:pressable>
            </native:row>
        </native:column>

        <native:pressable
            ref="settings"
            a11y-label="設定"
            class="p-2"
            @tap="openSettings"
        >
            <native:row class="items-center gap-1">
                <native:icon
                    :ios="Ios::Gearshape"
                    :android="Android::Settings"
                    :size="16"
                    class="text-theme-on-surface-variant"
                />
                <native:text
                    class="text-theme-on-surface-variant text-sm font-medium underline"
                    >設定</native:text
                >
            </native:row>
        </native:pressable>
    </native:column>
</native:scroll-view>
