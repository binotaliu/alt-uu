<native:row
    class="w-full items-center justify-between gap-3 py-2.5 {{ $saving ? 'opacity-60' : '' }}"
>
    <native:column class="flex-1 gap-0.5">
        <native:text
            class="text-theme-on-surface text-sm font-medium"
            >{{ $label }}</native:text
        >
        @if ($description !== '')
            <native:text
                class="text-theme-on-surface-variant text-xs"
                >{{ $description }}</native:text
            >
        @endif
    </native:column>

    @if ($saving)
        <native:activity-indicator ref="saving" />
    @else
        <native:toggle
            ref="toggle"
            :value="$value"
            :disabled="$disabled"
            a11y-label="{{ $label }}"
            @change="toggle"
        />
    @endif
</native:row>
