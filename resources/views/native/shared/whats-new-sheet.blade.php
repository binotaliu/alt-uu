<native:bottom-sheet
    ref="whats-new"
    :visible="$visible"
    detents="large"
    @dismiss="close"
>
    @if ($release !== null)
        <native:column class="w-full gap-4 pb-6">
            <native:scroll-view class="w-full flex-1">
                <native:column class="w-full gap-6 px-6 pt-8 pb-2">
                    <native:column class="w-full items-center gap-1">
                        <native:text
                            class="text-theme-accent text-sm font-semibold"
                            >v{{ $release['version'] }}</native:text
                        >
                        <native:text
                            class="text-theme-on-surface text-center text-2xl font-extrabold"
                            >Alt UU 有新功能了</native:text
                        >
                    </native:column>

                    @foreach ($release['highlights'] as $highlight)
                        <native:row
                            class="w-full items-start gap-4"
                            key="highlight-{{ $highlight['title'] }}"
                        >
                            <native:column
                                class="bg-theme-primary/15 h-10 w-10 items-center justify-center rounded-xl"
                            >
                                <native:icon
                                    :ios="$highlight['ios']"
                                    :android="$highlight['android']"
                                    :size="22"
                                    class="text-theme-accent"
                                />
                            </native:column>
                            <native:column class="flex-1 gap-1">
                                <native:row class="items-center gap-2">
                                    <native:text
                                        class="text-theme-on-surface text-base font-semibold"
                                        >{{ $highlight['title'] }}</native:text
                                    >
                                    @if ($highlight['plus'])
                                        <native:premium-badge
                                            key="plus-{{ $highlight['title'] }}"
                                        />
                                    @endif
                                </native:row>
                                <native:text
                                    class="text-theme-on-surface-variant text-sm"
                                    >{{ $highlight['description'] }}</native:text
                                >
                            </native:column>
                        </native:row>
                    @endforeach
                </native:column>
            </native:scroll-view>

            <native:column class="w-full gap-2 px-6">
                <native:button
                    ref="close"
                    variant="primary"
                    label="好"
                    @tap="close"
                />
                <native:button
                    ref="changelog"
                    variant="secondary"
                    label="完整版本更新說明"
                    @tap="openChangelog"
                />
            </native:column>
        </native:column>
    @endif
</native:bottom-sheet>
