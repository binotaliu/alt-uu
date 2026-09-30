@use ('App\Icons\Android')
@use ('App\Icons\Ios')

@if ($account !== null)
    <native:pressable
        ref="account-{{ $account->id }}"
        class="w-full {{ $disabled ? 'opacity-60' : '' }}"
        a11y-label="{{ $account->nickname ?: $account->username }}"
        @tap="select"
    >
        <native:row class="w-full items-center gap-3 px-5 py-3">
            @if ($account->picture !== '')
                <native:image
                    src="{{ $account->picture }}"
                    alt=""
                    class="h-10 w-10 rounded-full"
                />
            @else
                <native:icon
                    :ios="Ios::PersonCircle"
                    :android="Android::AccountCircle"
                    :size="40"
                    class="text-theme-on-surface-variant"
                />
            @endif

            <native:column class="flex-1 gap-0.5">
                <native:text
                    max-lines="1"
                    class="text-theme-on-surface text-sm font-medium"
                    >{{ $account->nickname ?: $account->username }}</native:text
                >
                <native:text
                    max-lines="1"
                    class="text-theme-on-surface-variant text-xs"
                    >{{ $account->displayName }}</native:text
                >
            </native:column>

            @if ($trailingLabel !== '')
                <native:text
                    class="text-theme-on-surface-variant text-xs"
                    >{{ $trailingLabel }}</native:text
                >
            @endif
        </native:row>
    </native:pressable>
@endif
