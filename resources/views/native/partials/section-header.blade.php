{{--
    Section title above a group of cards.
    Include with: @include('native.partials.section-header', ['title' => '114-1'])
    Optional: 'description' (muted line under the title).
--}}
<native:column class="w-full gap-0.5 pb-1">
    <native:text
        class="text-theme-on-surface-variant text-sm font-semibold"
        >{{ $title }}</native:text
    >
    @if (! empty($description))
        <native:text
            class="text-theme-on-surface-variant text-xs"
            >{{ $description }}</native:text
        >
    @endif
</native:column>
