{{--
    Card row with an optional title, used for grouped settings/info blocks.
    Include with: @include('native.partials.section-card', ['title' => '外觀', 'lines' => [['label' => '主題', 'value' => '暖橘']]])
    Bodies with arbitrary children cannot be passed through @include; for
    those, reuse the class string on your own <native:column>:
    "bg-theme-surface border-theme-outline-variant w-full gap-2 rounded-xl border p-4"
--}}
<native:column
    class="bg-theme-surface border-theme-outline-variant w-full gap-2 rounded-xl border p-4"
>
    @if (! empty($title))
        <native:text
            class="text-theme-on-surface text-base font-semibold"
            >{{ $title }}</native:text
        >
    @endif

    @foreach ($lines ?? [] as $line)
        <native:row
            class="w-full items-center justify-between gap-3"
            key="line-{{ $line['label'] }}"
        >
            <native:text
                class="text-theme-on-surface-variant text-sm"
                >{{ $line['label'] }}</native:text
            >
            <native:text
                class="text-theme-on-surface text-sm font-medium"
                >{{ $line['value'] }}</native:text
            >
        </native:row>
    @endforeach
</native:column>
