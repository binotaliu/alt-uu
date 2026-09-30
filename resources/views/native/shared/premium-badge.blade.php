@use ('App\Icons\Android')
@use ('App\Icons\Ios')

<native:row
    class="bg-theme-warning-container items-center gap-1 rounded-full px-2 py-0.5"
    a11y-label="Alt UU+"
>
    <native:icon
        :ios="Ios::Lock"
        :android="Android::Lock"
        :size="12"
        class="text-theme-on-warning-container"
    />
    <native:text
        class="text-theme-on-warning-container text-[10px] font-semibold"
        >Alt UU+</native:text
    >
</native:row>
