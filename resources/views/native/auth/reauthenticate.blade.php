@use ('App\Icons\Android')
@use ('App\Icons\Ios')

<native:scroll-view class="bg-theme-background h-full w-full">
    <native:column class="safe-area w-full items-center gap-5 p-4">
        <native:column class="items-center gap-3 pt-6">
            @if ($picture !== '')
                <native:image
                    ref="picture"
                    :src="$picture"
                    alt=""
                    fit="cover"
                    class="h-16 w-16 rounded-full"
                />
            @else
                <native:icon
                    :ios="Ios::PersonCircle"
                    :android="Android::AccountCircle"
                    :size="64"
                    class="text-theme-on-surface-variant"
                />
            @endif
            <native:text
                ref="account-name"
                class="text-theme-on-background text-lg font-semibold"
                >{{ $displayName }}</native:text
            >
        </native:column>

        <native:column
            class="bg-theme-surface border-theme-outline-variant w-full gap-4 rounded-3xl border p-5"
        >
            <native:column class="w-full gap-1">
                <native:text class="text-theme-on-surface text-xl font-semibold"
                    >重新登入</native:text
                >
                <native:text class="text-theme-on-surface-variant text-sm"
                    >此帳號的登入已失效，請重新輸入密碼以繼續使用。</native:text
                >
            </native:column>

            <native:outlined-text-input
                ref="password"
                native:model="password"
                label="密碼"
                placeholder="請輸入密碼"
                leading-icon="lock"
                secure
                revealable
                autofocus
                :disabled="$processing"
                :is-error="$error !== ''"
                a11y-label="密碼"
                @submit="submit"
            />

            @if ($error !== '')
                <native:text
                    ref="error"
                    class="text-theme-destructive text-sm"
                    >{{ $error }}</native:text
                >
            @endif

            <native:button
                ref="submit"
                :label="$processing ? '登入中...' : '登入'"
                :loading="$processing"
                :disabled="$processing"
                class="w-full"
                @tap="submit"
            />
        </native:column>
    </native:column>
</native:scroll-view>
