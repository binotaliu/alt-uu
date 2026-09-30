<native:column class="w-full gap-4">
    <native:column
        class="bg-theme-surface border-theme-outline-variant w-full gap-3 rounded-2xl border p-4"
    >
        <native:rect class="bg-theme-outline-variant h-5 w-40 rounded" />
        <native:rect class="bg-theme-surface-variant h-4 w-32 rounded" />
    </native:column>
    @foreach ([1, 2, 3, 4, 5, 6, 7, 8] as $item)
        <native:column
            class="bg-theme-surface border-theme-outline-variant w-full gap-2 rounded-2xl border p-4"
            key="calendar-skeleton-{{ $item }}"
        >
            <native:rect class="bg-theme-outline-variant h-4 w-2/3 rounded" />
            <native:rect class="bg-theme-surface-variant h-3 w-1/2 rounded" />
        </native:column>
    @endforeach
</native:column>
