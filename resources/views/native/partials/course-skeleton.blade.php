{{--
    Loading placeholder shaped like the grouped course list.
    Include with: @include('native.partials.course-skeleton')
    Optional: 'skeletonGroups' (default 2), 'skeletonCards' (default 5).
    Variables are namespaced so the include cannot clash with the parent scope.
--}}
@php
    $skeletonGroupCount = $skeletonGroups ?? 2;
    $skeletonCardCount = $skeletonCards ?? 5;
@endphp

<native:column class="w-full gap-6" a11y-label="載入中">
    @for ($skeletonGroupIndex = 0; $skeletonGroupIndex < $skeletonGroupCount; $skeletonGroupIndex++)
        <native:column
            class="w-full gap-3"
            key="skeleton-group-{{ $skeletonGroupIndex }}"
        >
            <native:rect class="bg-theme-outline-variant h-5 w-16 rounded" />
            @for ($skeletonCardIndex = 0; $skeletonCardIndex < $skeletonCardCount; $skeletonCardIndex++)
                <native:column
                    class="bg-theme-surface border-theme-outline-variant w-full gap-2 rounded-xl border px-4 py-3"
                    key="skeleton-card-{{ $skeletonGroupIndex }}-{{ $skeletonCardIndex }}"
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
