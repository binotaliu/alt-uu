<native:column
    class="bg-theme-surface-variant border-theme-outline w-full items-center gap-2 rounded-xl border px-5 py-12"
>
    @if ($title !== '')
        <native:text
            class="text-theme-on-surface text-center text-base font-semibold"
            >{{ $title }}</native:text
        >
    @endif

    <native:text
        class="text-theme-on-surface-variant text-center text-sm"
        >{{ $message }}</native:text
    >
</native:column>
