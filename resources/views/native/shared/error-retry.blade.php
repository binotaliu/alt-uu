<native:column
    class="bg-theme-destructive-container border-theme-destructive/40 w-full gap-3 rounded-xl border p-5"
>
    <native:row class="w-full flex-wrap items-center gap-2">
        <native:text
            class="text-theme-on-destructive-container text-sm"
            >{{ $message }}</native:text
        >
        @if ($displayCode)
            <native:column
                class="bg-theme-destructive/15 rounded px-1.5 py-0.5"
            >
                <native:text
                    class="text-theme-on-destructive-container font-mono text-xs"
                    >[{{ $displayCode }}]</native:text
                >
            </native:column>
        @endif
    </native:row>

    <native:row class="w-full items-center gap-3">
        <native:button
            ref="retry"
            variant="destructive"
            :label="$retrying ? '重試中…' : '重試'"
            :loading="$retrying"
            :disabled="$retrying"
            @tap="retry"
        />
        @if ($detail !== [])
            <native:pressable
                ref="toggle-detail"
                a11y-label="{{ $expanded ? '隱藏詳細資料' : '詳細資料' }}"
                @tap="toggleDetail"
            >
                <native:text
                    class="text-theme-on-destructive-container px-2 py-2 text-xs font-medium underline"
                    >{{ $expanded ? '隱藏詳細資料' : '詳細資料' }}</native:text
                >
            </native:pressable>
        @endif
    </native:row>

    @if ($detail !== [] && $expanded)
        <native:column class="w-full gap-1">
            <native:divider class="bg-theme-destructive/30 mb-2" />
            @foreach ($detailRows as $label => $value)
                <native:row class="w-full gap-3" key="detail-{{ $label }}">
                    <native:text
                        class="text-theme-on-destructive-container w-16 text-xs font-medium"
                        >{{ $label }}</native:text
                    >
                    <native:text
                        class="text-theme-on-destructive-container flex-1 font-mono text-xs"
                        >{{ $value }}</native:text
                    >
                </native:row>
            @endforeach

            <native:pressable ref="open-log" @tap="openDiagnosticLog">
                <native:text
                    class="text-theme-on-destructive-container pt-2 text-xs font-medium underline"
                    >開啟診斷記錄</native:text
                >
            </native:pressable>
        </native:column>
    @endif
</native:column>
