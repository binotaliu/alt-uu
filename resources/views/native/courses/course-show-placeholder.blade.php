<native:column class="bg-theme-background h-full w-full gap-4">
    <native:row class="items-center gap-2 px-3 py-3">
        @for ($skeletonTabIndex = 0; $skeletonTabIndex < 4; $skeletonTabIndex++)
            <native:rect
                key="skeleton-tab-{{ $skeletonTabIndex }}"
                class="bg-theme-outline-variant h-9 w-16 rounded-xl"
            />
        @endfor
    </native:row>
    <native:column class="w-full px-3">
        @include ('native.partials.course-skeleton', ['skeletonGroups' => 1, 'skeletonCards' => 4])
    </native:column>
</native:column>
