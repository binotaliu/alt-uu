@use ('App\Icons\Android')
@use ('App\Icons\Ios')

<native:scroll-view class="bg-theme-background h-full w-full">
    <native:column class="w-full gap-4 p-4 pb-16">
        <native:row
            class="bg-theme-surface border-theme-outline-variant min-h-32 w-full items-center gap-3 rounded-xl border p-4"
        >
            @if ($overview['level'] === 'loading')
                <native:activity-indicator />
            @elseif ($overview['level'] === 'ok')
                <native:icon
                    :ios="Ios::CheckmarkCircle"
                    :android="Android::CheckCircle"
                    :size="24"
                    class="text-theme-success"
                />
            @elseif ($overview['level'] === 'warning')
                <native:icon
                    :ios="Ios::ExclamationmarkTriangle"
                    :android="Android::Warning"
                    :size="24"
                    class="text-theme-warning"
                />
            @else
                <native:icon
                    :ios="Ios::XmarkCircle"
                    :android="Android::Cancel"
                    :size="24"
                    class="text-theme-destructive"
                />
            @endif

            <native:column class="flex-1 gap-1">
                @if ($overview['level'] === 'loading')
                    <native:text class="text-theme-on-surface-variant text-sm"
                        >正在檢查各項服務連線狀態…</native:text
                    >
                @elseif ($overview['level'] === 'ok')
                    <native:text class="text-theme-on-surface text-sm"
                        >所有服務均可正常連線。</native:text
                    >
                @else
                    @foreach ($overview['messages'] as $message)
                        <native:text
                            key="overview-{{ $loop->index }}"
                            class="text-theme-on-surface text-sm"
                            >{{ $message }}</native:text
                        >
                    @endforeach
                @endif
            </native:column>
        </native:row>

        @if (! $isOffline)
            <native:column class="w-full gap-3">
                <native:text class="text-theme-on-surface-variant text-sm"
                    >檢查 Alt UU
                    所依賴的各項服務目前是否可正常連線，協助您判斷連線問題是否來自您的網路。</native:text
                >
                <native:button
                    ref="recheck"
                    variant="secondary"
                    :label="$checking ? '檢查中…' : '重新檢查'"
                    :loading="$checking"
                    :disabled="$checking"
                    :ios-icon="Ios::ArrowClockwise"
                    :android-icon="Android::Refresh"
                    @tap="runCheck"
                />
            </native:column>
            @if ($error)
                <native:text
                    ref="check-error"
                    class="text-theme-destructive text-sm"
                    >{{ $error }}</native:text
                >
            @endif
            @if ($deviceNetwork)
                <native:row
                    class="bg-theme-surface border-theme-outline-variant w-full items-center gap-3 rounded-xl border p-4"
                >
                    <native:column class="flex-1 gap-1">
                        <native:text
                            class="text-theme-on-surface text-sm font-semibold"
                            >裝置網路狀態</native:text
                        >
                        <native:text
                            class="text-theme-on-surface-variant text-xs"
                            >已連線（{{ $networkTypeLabel }}）{{ $deviceNetwork['isExpensive'] ? '・按流量計費' : '' }}{{ $deviceNetwork['isConstrained'] ? '・低數據模式' : '' }}</native:text
                        >
                    </native:column>
                    <native:icon
                        :ios="Ios::CheckmarkCircle"
                        :android="Android::CheckCircle"
                        :size="24"
                        class="text-theme-success"
                    />
                </native:row>
            @endif
            @foreach ($rows as $row)
                @include ('native.settings.connectivity-row', ['row' => $row])
            @endforeach
            <native:divider />
            <native:column class="w-full gap-3">
                <native:text class="text-theme-on-surface text-sm font-semibold"
                    >網際網路連線（選用）</native:text
                >
                <native:text class="text-theme-on-surface-variant text-xs"
                    >透過檢查 Google、Cloudflare、Apple
                    等外部服務，協助判斷問題是否來自您的網際網路連線，而非 Alt
                    UU 本身。</native:text
                >
                <native:button
                    ref="check-reference"
                    variant="secondary"
                    :label="$checkingReference ? '檢查中…' : '檢查網際網路連線'"
                    :loading="$checkingReference"
                    :disabled="$checkingReference || count($referenceRows) === 0"
                    :ios-icon="Ios::ArrowClockwise"
                    :android-icon="Android::Refresh"
                    @tap="runReferenceCheck"
                />
            </native:column>
            @if ($referenceError)
                <native:text
                    ref="reference-error"
                    class="text-theme-destructive text-sm"
                    >{{ $referenceError }}</native:text
                >
            @endif
            @foreach ($referenceRows as $row)
                @include ('native.settings.connectivity-row', ['row' => $row])
            @endforeach
        @else
            <native:text
                ref="offline-hint"
                class="text-theme-on-surface-variant text-sm"
                >已偵測到裝置離線，恢復連線後會自動重新檢查。</native:text
            >
        @endif
    </native:column>
</native:scroll-view>
