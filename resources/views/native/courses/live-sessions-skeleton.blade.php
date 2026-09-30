<native:column class="w-full gap-4">
    @foreach ([1, 2] as $section)
        <native:column class="w-full gap-3" key="live-skeleton-{{ $section }}">
            <native:rect class="bg-theme-outline-variant h-5 w-32 rounded" />
            @foreach ([1, 2, 3] as $item)
                <native:column
                    class="bg-theme-surface border-theme-outline-variant w-full gap-2 rounded-2xl border p-4"
                    key="live-skeleton-{{ $section }}-{{ $item }}"
                >
                    <native:rect
                        class="bg-theme-outline-variant h-4 w-3/4 rounded"
                    />
                    <native:rect
                        class="bg-theme-surface-variant h-3 w-1/2 rounded"
                    />
                    <native:rect
                        class="bg-theme-surface-variant h-3 w-1/3 rounded"
                    />
                </native:column>
            @endforeach
        </native:column>
    @endforeach
</native:column>
