{{--
    Two or more mutually exclusive choices (the web tab's pill toggle).
    Include with: @include('native.courses.segmented', ['options' => [['label' => '目前帳號', 'ref' => 'scope-current', 'tap' => 'setAllAccounts(false)', 'active' => true]]])
--}}
<native:row
    class="bg-theme-surface-variant border-theme-outline-variant w-full gap-1 rounded-xl border p-1"
>
    @foreach ($options as $option)
        <native:pressable
            class="flex-1"
            ref="{{ $option['ref'] }}"
            a11y-label="{{ $option['label'] }}"
            @tap="{{ $option['tap'] }}"
        >
            <native:column
                class="w-full items-center rounded-lg px-3 py-2 {{ $option['active'] ? 'bg-theme-surface' : '' }}"
            >
                <native:text
                    class="{{ $option['active'] ? 'text-theme-on-surface' : 'text-theme-on-surface-variant' }} text-sm font-medium"
                    >{{ $option['label'] }}</native:text
                >
            </native:column>
        </native:pressable>
    @endforeach
</native:row>
