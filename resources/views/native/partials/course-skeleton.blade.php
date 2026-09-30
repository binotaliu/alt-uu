{{--
    Loading placeholder shaped like the grouped course list.
    Include with: @include('native.partials.course-skeleton')
    Optional: 'groups' (default 2), 'cards' (default 5).
--}}
@php
    $skeletonGroups = $groups ?? 2;
    $skeletonCards = $cards ?? 5;
@endphp

<native:column class="w-full gap-6" a11y-label="載入中">
    @for ($group = 0; $group < $skeletonGroups; $group++)
        <native:column class="w-full gap-3" key="skeleton-group-{{ $group }}">
            <native:rect class="bg-theme-outline-variant h-5 w-16 rounded" />
            @for ($card = 0; $card < $skeletonCards; $card++)
                <native:column
                    class="bg-theme-surface border-theme-outline-variant w-full gap-2 rounded-xl border px-4 py-3"
                    key="skeleton-card-{{ $group }}-{{ $card }}"
                >
                    <native:row class="gap-2">
                        <native:rect
                            class="bg-theme-outline-variant h-4 w-12 rounded-full"
                        />
                        <native:rect
                            class="bg-theme-outline-variant h-4 w-16 rounded-full"
                        />
                    </native:row>
                    <native:rect
                        class="bg-theme-outline-variant h-10 w-3/4 rounded"
                    />
                </native:column>
            @endfor
        </native:column>
    @endfor
</native:column>
