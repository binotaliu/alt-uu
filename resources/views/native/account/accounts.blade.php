@use ('App\Icons\Android')
@use ('App\Icons\Ios')

<native:column class="bg-theme-background h-full w-full">
    <native:scroll-view class="w-full flex-1">
        <native:column class="w-full gap-4 p-4">
            <native:column
                class="bg-theme-surface border-theme-outline-variant w-full gap-3 rounded-xl border p-4"
            >
                <native:text class="text-theme-on-surface text-sm font-semibold"
                    >帳號</native:text
                >

                @foreach ($accounts as $account)
                    <native:column
                        key="account-{{ $account->id }}"
                        class="{{ $account->isActive ? 'bg-theme-primary/10' : '' }} border-theme-outline-variant w-full rounded-lg border"
                    >
                        <native:pressable
                            ref="account-{{ $account->id }}"
                            class="w-full"
                            a11y-label="{{ $account->nickname ?: $account->username }}"
                            @tap="toggleExpanded({{ $account->id }})"
                        >
                            <native:row class="w-full items-center gap-3 p-3">
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
                                        class="text-theme-on-surface text-sm font-semibold"
                                        >{{ $account->nickname ?: $account->username }}</native:text
                                    >
                                    <native:text
                                        max-lines="1"
                                        class="text-theme-on-surface-variant text-xs"
                                        >{{ $account->nickname ? $account->username.' · '.$account->displayName : $account->displayName }}</native:text
                                    >
                                </native:column>

                                @if ($account->isActive)
                                    <native:column
                                        class="bg-theme-primary rounded-full px-2 py-0.5"
                                    >
                                        <native:text
                                            class="text-theme-on-primary text-xs font-semibold"
                                            >目前帳號</native:text
                                        >
                                    </native:column>
                                @endif

                                <native:icon
                                    :ios="$expandedAccountId === $account->id ? Ios::ChevronUp : Ios::ChevronDown"
                                    :android="Android::ExpandMore"
                                    :size="16"
                                    class="text-theme-on-surface-variant"
                                />
                            </native:row>
                        </native:pressable>

                        @if ($expandedAccountId === $account->id)
                            <native:divider class="bg-theme-outline-variant" />
                            <native:column class="w-full gap-2 p-3">
                                @if (! $account->isActive)
                                    <native:button
                                        ref="switch-{{ $account->id }}"
                                        variant="secondary"
                                        :label="$switchingAccountId === $account->id ? '切換中…' : '切換帳號'"
                                        :disabled="$switchingAccountId !== null"
                                        @tap="switchAccount({{ $account->id }})"
                                    />
                                @endif

                                <native:button
                                    ref="rename-{{ $account->id }}"
                                    variant="secondary"
                                    label="修改名稱"
                                    @tap="openRename({{ $account->id }})"
                                />

                                <native:button
                                    ref="remove-{{ $account->id }}"
                                    variant="destructive"
                                    label="登出此帳號"
                                    :disabled="$removing"
                                    @tap="askRemove({{ $account->id }})"
                                />
                            </native:column>
                        @endif
                    </native:column>
                @endforeach

                @if (! $addFormVisible)
                    @if ($limitReached)
                        <native:text
                            ref="limit-note"
                            class="text-theme-on-surface-variant w-full text-center text-xs"
                            >最多只能新增 5 個帳號。</native:text
                        >
                    @else
                        <native:button
                            ref="add-account"
                            variant="secondary"
                            label="新增帳號"
                            :ios-icon="Ios::Plus"
                            :android-icon="Android::Add"
                            @tap="toggleAddForm"
                        />
                    @endif
                @else
                    <native:column
                        class="border-theme-outline-variant w-full gap-2 rounded-lg border p-3"
                    >
                        <native:outlined-text-input
                            ref="add-username"
                            native:model="addUsername"
                            placeholder="請輸入學號或帳號"
                            :disabled="$addProcessing"
                        />
                        <native:outlined-text-input
                            ref="add-password"
                            native:model="addPassword"
                            placeholder="請輸入密碼"
                            :secure="true"
                            :revealable="true"
                            :disabled="$addProcessing"
                            @submit="submitAddAccount"
                        />

                        @if ($addError !== '')
                            <native:text
                                ref="add-error"
                                class="text-theme-destructive text-xs"
                                >{{ $addError }}</native:text
                            >
                        @endif

                        <native:row class="w-full gap-2">
                            <native:button
                                ref="add-submit"
                                variant="primary"
                                :label="$addProcessing ? '新增中…' : '確認新增'"
                                :loading="$addProcessing"
                                :disabled="$addProcessing"
                                @tap="submitAddAccount"
                            />
                            <native:button
                                ref="add-cancel"
                                variant="secondary"
                                label="取消"
                                :disabled="$addProcessing"
                                @tap="toggleAddForm"
                            />
                        </native:row>
                    </native:column>
                @endif
            </native:column>
        </native:column>
    </native:scroll-view>

    <native:confirm-sheet
        key="remove-account"
        ref-prefix="remove-"
        :visible="$pendingRemovalId !== null"
        title="移除帳號"
        message="確定要移除這個帳號嗎？移除後將登出該帳號的所有裝置端資料。"
        confirm-label="移除"
        :danger="true"
        :processing="$removing"
        @confirm="confirmRemove"
        @cancel="cancelRemove"
    />

    <native:text-input-sheet
        key="rename-account"
        ref-prefix="rename-"
        :visible="$renamingAccountId !== null"
        title="修改名稱"
        description="設定這個帳號的自訂名稱，僅顯示在這個裝置上。"
        :initial-value="$renameInitialValue"
        placeholder="請輸入自訂名稱"
        :max-length="30"
        :processing="$renameProcessing"
        :error="$renameError"
        @confirm="saveRename"
        @cancel="cancelRename"
    />
</native:column>
