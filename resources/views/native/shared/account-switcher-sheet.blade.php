<native:bottom-sheet
    ref="account-switcher"
    :visible="$visible"
    detents="medium,large"
    @dismiss="cancel"
>
    <native:scroll-view class="w-full">
        <native:column class="w-full">
            <native:text
                class="text-theme-on-surface px-5 pt-4 pb-2 text-lg font-semibold"
                >切換帳號</native:text
            >

            @foreach ($accounts as $account)
                <native:account-list-item
                    key="account-{{ $account->id }}"
                    :account="$account"
                    :trailing-label="$account->isActive ? '目前帳號' : ($switchingAccountId === $account->id ? '切換中…' : '')"
                    :disabled="$switchingAccountId === $account->id"
                    @selected="select"
                />
                <native:divider class="bg-theme-outline-variant" />
            @endforeach

            <native:pressable ref="manage" class="w-full" @tap="manage">
                <native:text
                    class="text-theme-accent w-full px-5 py-4 text-center text-sm font-medium"
                    >管理帳號</native:text
                >
            </native:pressable>
        </native:column>
    </native:scroll-view>
</native:bottom-sheet>
