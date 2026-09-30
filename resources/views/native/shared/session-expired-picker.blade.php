<native:bottom-sheet
    ref="session-expired-picker"
    :visible="$visible"
    detents="medium,large"
    @dismiss="cancel"
>
    <native:scroll-view class="w-full">
        <native:column class="w-full">
            <native:column class="w-full gap-1 px-5 pt-4 pb-3">
                <native:text class="text-theme-on-surface text-lg font-semibold"
                    >登入已失效</native:text
                >
                <native:text class="text-theme-on-surface-variant text-sm"
                    >「{{ $failedName }}」需要重新登入，您可以切換到其他帳號繼續使用。</native:text
                >
            </native:column>

            @foreach ($otherAccounts as $account)
                <native:divider class="bg-theme-outline-variant" />
                <native:account-list-item
                    key="account-{{ $account->id }}"
                    :account="$account"
                    :trailing-label="$switchingAccountId === $account->id ? '切換中…' : ''"
                    :disabled="$switchingAccountId === $account->id"
                    @selected="select"
                />
            @endforeach

            @if ($failedAccountId !== null)
                <native:divider class="bg-theme-outline-variant" />
                <native:pressable
                    ref="reauth"
                    class="w-full"
                    @tap="reauthenticate"
                >
                    <native:text
                        class="text-theme-accent w-full px-5 py-4 text-center text-sm font-medium"
                        >重新登入「{{ $failedName }}」</native:text
                    >
                </native:pressable>
            @endif
        </native:column>
    </native:scroll-view>
</native:bottom-sheet>
