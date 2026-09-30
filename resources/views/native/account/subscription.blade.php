@use ('App\Icons\Android')
@use ('App\Icons\Ios')

<native:scroll-view class="bg-theme-background h-full w-full">
    <native:column class="w-full p-4">
        <native:column
            class="bg-theme-surface border-theme-outline-variant w-full rounded-2xl border"
        >
            <native:column
                class="bg-theme-warning w-full gap-2 rounded-t-2xl px-5 py-6"
            >
                <native:row class="items-center gap-2">
                    <native:row
                        class="bg-theme-on-warning/20 items-center gap-1 rounded-full px-3 py-1"
                    >
                        <native:icon
                            :ios="Ios::Sparkles"
                            :android="Android::AutoAwesome"
                            :size="14"
                            class="text-theme-on-warning"
                        />
                        <native:text
                            class="text-theme-on-warning text-xs font-semibold"
                            >ALT UU+</native:text
                        >
                    </native:row>
                    @if ($active)
                        <native:column
                            class="bg-theme-on-warning rounded-full px-2.5 py-1"
                        >
                            <native:text
                                class="text-theme-warning text-xs font-semibold"
                                >已訂閱</native:text
                            >
                        </native:column>
                    @endif
                </native:row>

                <native:text
                    class="text-theme-on-warning mt-2 text-xl font-bold"
                    >{{ $active ? '感謝你的支持！' : '升級 Alt UU+' }}</native:text
                >
                <native:text
                    class="text-theme-on-warning text-sm"
                    >{{ $active ? '你已解鎖 Alt UU+ 的所有功能' : '解鎖更多專屬功能' }}</native:text
                >
            </native:column>

            <native:column class="w-full gap-3 p-5">
                @if (! $loaded)
                    <native:text
                        class="text-theme-on-surface-variant w-full text-center text-sm"
                        >載入訂閱狀態中…</native:text
                    >
                @elseif ($active)
                    @if ($currentProductName !== null)
                        <native:row
                            class="w-full items-center justify-between gap-3"
                        >
                            <native:text
                                class="text-theme-on-surface-variant text-sm"
                                >目前方案</native:text
                            >
                            <native:text
                                ref="current-product"
                                class="text-theme-on-surface text-sm font-medium"
                                >{{ $currentProductName }}</native:text
                            >
                        </native:row>
                    @endif
                    @if ($expiryLabel !== '')
                        <native:row
                            class="w-full items-center justify-between gap-3"
                        >
                            <native:text
                                class="text-theme-on-surface-variant text-sm"
                                >下次續訂日</native:text
                            >
                            <native:text
                                class="text-theme-on-surface text-sm font-medium"
                                >{{ $expiryLabel }}</native:text
                            >
                        </native:row>
                    @endif
                    <native:button
                        ref="manage"
                        variant="secondary"
                        label="管理訂閱"
                        @tap="manageSubscription"
                    />
                @else
                    @foreach ($perks as $perk)
                        <native:row
                            key="perk-{{ $loop->iteration }}"
                            class="w-full items-start gap-2"
                        >
                            <native:icon
                                :ios="Ios::CheckmarkCircle"
                                :android="Android::CheckCircle"
                                :size="16"
                                class="text-theme-warning"
                            />
                            <native:text
                                class="text-theme-on-surface-variant flex-1 text-sm"
                                >{{ $perk }}</native:text
                            >
                        </native:row>
                    @endforeach
                    @if ($loadingProducts)
                        <native:text
                            class="text-theme-on-surface-variant w-full pt-1 text-center text-sm"
                            >載入方案中…</native:text
                        >
                    @elseif ($productsFailed)
                        <native:column class="w-full items-center gap-2 pt-1">
                            <native:text
                                class="text-theme-destructive text-center text-sm"
                                >無法載入訂閱方案，請稍後再試。</native:text
                            >
                            <native:button
                                ref="retry-products"
                                variant="secondary"
                                label="重試"
                                @tap="loadProducts"
                            />
                        </native:column>
                    @else
                        <native:column class="w-full gap-2 pt-1">
                            @foreach ($products as $product)
                                <native:pressable
                                    key="product-{{ $product->id }}"
                                    ref="product-{{ $product->id }}"
                                    class="w-full {{ $purchasing ? 'opacity-50' : '' }}"
                                    a11y-label="{{ $product->displayName }} {{ $product->displayPrice }}"
                                    @tap="purchase('{{ $product->id }}')"
                                >
                                    <native:row
                                        class="border-theme-outline-variant w-full items-center justify-between gap-3 rounded-xl border p-3"
                                    >
                                        <native:column class="flex-1 gap-0.5">
                                            <native:text
                                                class="text-theme-on-surface font-medium"
                                                >{{ $product->displayName }}</native:text
                                            >
                                            <native:text
                                                class="text-theme-on-surface-variant text-xs"
                                                >{{ $product->description }}</native:text
                                            >
                                        </native:column>
                                        <native:text
                                            class="text-theme-on-surface font-semibold"
                                            >{{ $product->displayPrice }}</native:text
                                        >
                                        <native:column
                                            class="bg-theme-primary rounded-lg px-3 py-1.5"
                                        >
                                            <native:text
                                                class="text-theme-on-primary text-xs font-semibold"
                                                >{{ $purchasing ? '處理中…' : '訂閱' }}</native:text
                                            >
                                        </native:column>
                                    </native:row>
                                </native:pressable>
                            @endforeach
                        </native:column>
                    @endif
                    <native:pressable
                        ref="restore"
                        class="w-full"
                        @tap="restore"
                    >
                        <native:text
                            class="text-theme-on-surface-variant w-full py-2 text-center text-sm font-medium underline"
                            >{{ $restoring ? '還原中…' : '已購買過？還原購買' }}</native:text
                        >
                    </native:pressable>
                @endif

                <native:divider class="bg-theme-outline-variant" />

                <native:text
                    class="text-theme-on-surface-variant text-xs leading-relaxed"
                    >Alt UU+ 是由 Alt UU
                    開發人員推出的訂閱服務，而非由學校提供。</native:text
                >
                <native:text
                    ref="billing-note"
                    class="text-theme-on-surface-variant text-xs leading-relaxed"
                    >訂閱費用將通過 {{ $platformName }} 進行收取，並自動續訂，除非你在本次計費週期結束前至少
                    24 小時取消。若要管理你的訂閱項目，請前往 {{ $platformName }} 的帳號設定。</native:text
                >
            </native:column>
        </native:column>
    </native:column>
</native:scroll-view>
