@use ('App\Icons\Android')
@use ('App\Icons\Ios')

<native:scroll-view class="bg-theme-background h-full w-full">
    <native:column
        class="safe-area w-full items-center justify-center gap-4 p-4"
    >
        <native:column
            class="bg-theme-surface border-theme-outline-variant w-full gap-4 rounded-3xl border p-4"
        >
            <native:row class="w-full items-center justify-between px-2">
                <native:column class="gap-1">
                    <native:text class="text-theme-accent text-xs font-medium"
                        >Welcome</native:text
                    >
                    <native:text
                        class="text-theme-on-surface text-xl font-semibold"
                        >歡迎使用 Alt UU</native:text
                    >
                </native:column>
                <native:text
                    ref="counter"
                    class="text-theme-on-surface-variant text-sm"
                    >{{ $currentSlide + 1 }} / {{ count($slides) }}</native:text
                >
            </native:row>

            <native:gesture-area ref="slides" class="w-full" @swipe="onSwipe">
                <native:column
                    key="slide-{{ $slide['id'] }}"
                    class="bg-theme-surface-variant border-theme-outline-variant w-full gap-4 rounded-3xl border p-4"
                >
                    @if ($slide['id'] === 'about')
                        <native:row
                            class="bg-theme-warning/15 h-12 w-12 items-center justify-center rounded-2xl"
                        >
                            <native:icon
                                :ios="Ios::Graduationcap"
                                :android="Android::School"
                                :size="24"
                                class="text-theme-warning"
                            />
                        </native:row>
                    @elseif ($slide['id'] === 'study-time')
                        <native:row
                            class="bg-theme-primary/15 h-12 w-12 items-center justify-center rounded-2xl"
                        >
                            <native:icon
                                :ios="Ios::Clock"
                                :android="Android::Timer"
                                :size="24"
                                class="text-theme-primary"
                            />
                        </native:row>
                    @else
                        <native:row
                            class="bg-theme-success/15 h-12 w-12 items-center justify-center rounded-2xl"
                        >
                            <native:icon
                                :ios="Ios::Puzzlepiece"
                                :android="Android::Extension"
                                :size="24"
                                class="text-theme-success"
                            />
                        </native:row>
                    @endif

                    <native:column class="w-full gap-3">
                        <native:text
                            ref="slide-title"
                            class="text-theme-on-surface text-2xl font-semibold"
                            >{{ $slide['title'] }}</native:text
                        >
                        <native:text
                            class="text-theme-on-surface-variant text-sm leading-relaxed"
                            >{{ $slide['description'] }}</native:text
                        >
                        @if ($slide['note'] !== null)
                            <native:text
                                class="text-theme-on-surface-variant text-xs leading-relaxed"
                                >{{ $slide['note'] }}</native:text
                            >
                        @endif
                    </native:column>

                    @if ($slide['id'] === 'study-time')
                        <native:column
                            class="bg-theme-surface border-theme-outline-variant w-full rounded-2xl border"
                        >
                            <native:row
                                class="w-full items-center justify-between gap-3 p-3"
                            >
                                <native:column class="flex-1 gap-1">
                                    <native:rect
                                        class="bg-theme-outline-variant h-4 w-20 rounded"
                                    />
                                    <native:rect
                                        class="bg-theme-surface-variant h-3 w-32 rounded"
                                    />
                                </native:column>
                                <native:row
                                    class="bg-theme-primary/15 items-center gap-2 rounded-full px-3 py-1"
                                >
                                    <native:icon
                                        :ios="Ios::Clock"
                                        :android="Android::Timer"
                                        :size="14"
                                        class="text-theme-on-surface"
                                    />
                                    <native:text
                                        class="text-theme-on-surface text-xs font-medium"
                                        >12:34</native:text
                                    >
                                </native:row>
                            </native:row>
                            <native:divider />
                            <native:text
                                class="text-theme-on-surface-variant p-3 text-sm"
                                >觀看完成記得按返回按鈕，系統將會自動記錄你觀看課程內容的時間</native:text
                            >
                        </native:column>
                    @elseif ($slide['id'] === 'nou-tools')
                        <native:column
                            class="bg-theme-surface border-theme-outline-variant w-full rounded-2xl border px-4 py-2"
                        >
                            <native:toggle-row
                                key="onboarding-nou-tools"
                                label="開啟 NOU 小幫手整合"
                                description="開啟後即可在課程內看到學校行事曆、視訊面授與考古題等資訊。"
                                :value="$nouToolsIntegrationEnabled"
                                :saving="$savingNouToolsIntegration"
                                @toggled="setNouToolsIntegration"
                            />
                        </native:column>
                    @endif
                </native:column>
            </native:gesture-area>

            <native:row class="w-full items-center justify-center gap-2">
                @foreach ($slides as $index => $dot)
                    <native:pressable
                        key="dot-{{ $dot['id'] }}"
                        ref="dot-{{ $index }}"
                        a11y-label="切換至 {{ $dot['title'] }}"
                        @tap="goToSlide({{ $index }})"
                    >
                        <native:rect
                            class="h-2.5 rounded-full {{ $index === $currentSlide ? 'w-7 bg-theme-primary' : 'w-2.5 bg-theme-outline' }}"
                        />
                    </native:pressable>
                @endforeach
            </native:row>

            @if ($errorMessage !== null)
                <native:column
                    class="bg-theme-destructive-container w-full rounded-2xl p-3"
                >
                    <native:text
                        ref="error"
                        class="text-theme-on-destructive-container text-sm"
                        >{{ $errorMessage }}</native:text
                    >
                </native:column>
            @endif

            <native:row class="w-full items-center gap-3 px-2">
                <native:button
                    ref="back"
                    variant="secondary"
                    label="上一頁"
                    :disabled="$currentSlide === 0 || $savingOnboarding"
                    @tap="previous"
                />
                <native:button
                    ref="continue"
                    class="flex-1"
                    :label="$savingOnboarding ? '處理中...' : ($isLastSlide ? '開始使用' : '繼續')"
                    :loading="$savingOnboarding"
                    :disabled="$savingOnboarding"
                    @tap="next"
                />
            </native:row>
        </native:column>
    </native:column>
</native:scroll-view>
