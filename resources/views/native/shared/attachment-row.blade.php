@use ('App\Icons\Android')
@use ('App\Icons\Ios')

<native:column class="w-full gap-1">
    <native:pressable
        ref="{{ $refPrefix }}attachment"
        class="w-full"
        a11y-label="{{ $displayName }}"
        a11y-hint="下載並開啟附件"
        @tap="tapRow"
    >
        <native:row
            class="bg-theme-surface-variant w-full items-center gap-2 rounded-xl px-3 py-2.5 {{ $working ? 'opacity-70' : '' }}"
        >
            @if ($working)
                <native:activity-indicator
                    ref="{{ $refPrefix }}working"
                    native:poll="1s"
                />
            @else
                <native:icon
                    :ios="Ios::Paperclip"
                    :android="Android::AttachFile"
                    :size="16"
                    class="text-theme-on-surface-variant"
                />
            @endif
            <native:text
                max-lines="1"
                class="text-theme-on-surface flex-1 text-sm"
                >{{ $working ? '正在下載附件，請稍候…' : $displayName }}</native:text
            >
        </native:row>
    </native:pressable>

    @if ($errorMessage !== '')
        <native:pressable
            ref="{{ $refPrefix }}dismiss-error"
            @tap="dismissError"
        >
            <native:text
                class="text-theme-destructive px-1 text-xs"
                >{{ $errorMessage }}</native:text
            >
        </native:pressable>
    @endif

    @if ($confirm)
        <native:confirm-sheet
            key="confirm"
            ref-prefix="{{ $refPrefix }}download-"
            :visible="$confirming"
            title="下載附件"
            message="確定要下載並開啟「{{ $displayName }}」嗎？"
            confirm-label="確認下載"
            @confirm="confirmDownload"
            @cancel="cancelConfirm"
        />
    @endif
</native:column>
