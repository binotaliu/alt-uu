@use ('App\Icons\Android')
@use ('App\Icons\Ios')

<native:column>
    <native:pressable
        ref="open-account"
        a11y-label="{{ $label }}"
        a11y-hint="長按可切換帳號"
        @tap="open"
        @longTap="openMenu"
    >
        <native:row
            class="bg-theme-surface border-theme-outline-variant items-center gap-2 rounded-full border py-1 pr-3 pl-1"
        >
            @if ($profile === null)
                <native:rect
                    class="bg-theme-outline-variant h-7 w-7 rounded-full"
                />
                <native:rect
                    class="bg-theme-outline-variant h-4 w-16 rounded"
                />
            @else
                @if ($profile->picture)
                    <native:image
                        src="{{ $profile->picture }}"
                        alt=""
                        class="h-7 w-7 rounded-full"
                    />
                @else
                    <native:icon
                        :ios="Ios::PersonCircle"
                        :android="Android::AccountCircle"
                        :size="28"
                        class="text-theme-on-surface-variant"
                    />
                @endif
                <native:text
                    max-lines="1"
                    class="text-theme-on-surface text-sm font-medium"
                    >{{ $label }}</native:text
                >
            @endif
        </native:row>
    </native:pressable>

    <native:account-switcher-sheet
        key="switcher"
        :visible="$menuOpen"
        :return-to="$returnTo"
        @cancel="closeMenu"
        @switched="onSwitched"
    />
</native:column>
