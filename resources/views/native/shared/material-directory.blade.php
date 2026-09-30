@use ('App\Icons\Android')
@use ('App\Icons\Ios')

<native:column class="w-full gap-3">
    <native:row class="w-full items-center justify-between gap-3 px-1">
        <native:row class="items-center gap-2">
            <native:icon
                :ios="Ios::Folder"
                :android="Android::Folder"
                :size="18"
                class="text-theme-on-surface-variant"
            />
            <native:text class="text-theme-on-surface text-sm font-semibold"
                >教材目錄</native:text
            >
        </native:row>

        @if ($hasDirectories)
            <native:row class="items-center gap-4">
                <native:pressable
                    ref="expand-all"
                    a11y-label="全部展開"
                    @tap="expandAll"
                >
                    <native:text
                        class="text-theme-accent text-xs font-medium {{ $allExpanded ? 'opacity-50' : '' }}"
                        >全部展開</native:text
                    >
                </native:pressable>
                <native:pressable
                    ref="collapse-all"
                    a11y-label="全部收合"
                    @tap="collapseAll"
                >
                    <native:text
                        class="text-theme-accent text-xs font-medium {{ $allCollapsed ? 'opacity-50' : '' }}"
                        >全部收合</native:text
                    >
                </native:pressable>
            </native:row>
        @endif
    </native:row>

    @if ($loading)
        <native:column class="w-full gap-2" a11y-label="載入中">
            @for ($i = 0; $i < 4; $i++)
                <native:rect
                    class="bg-theme-outline-variant h-12 w-full rounded-xl"
                    key="directory-skeleton-{{ $i }}"
                />
            @endfor
        </native:column>
    @elseif (! $hasNodes)
        <native:text
            class="text-theme-on-surface-variant w-full px-1 py-6 text-center text-sm"
            >此課程目前沒有教材目錄可顯示。</native:text
        >
    @else
        <native:column class="w-full gap-2">
            @foreach ($nodes as $node)
                @php
                    $title = $node['text'] !== '' ? $node['text'] : ($node['identifier'] !== '' ? $node['identifier'] : '未命名節點');
                    $isActive = $node['targetIdentifier'] === $activeNodeIdentifier && ! empty($node['href']);
                    $indent = $node['level'] * 14;
                    $isCollapsed = in_array($node['internalId'], $collapsed, true);
                @endphp
                @if ($node['isDirectory'])
                    <native:pressable
                        key="node-{{ $node['internalId'] }}"
                        ref="dir-{{ $node['internalId'] }}"
                        class="ml-[{{ $indent }}px] w-full"
                        a11y-label="{{ $title }}"
                        a11y-hint="{{ $isCollapsed ? '展開' : '收合' }}"
                        @tap="toggleDirectory('{{ $node['internalId'] }}')"
                    >
                        <native:row
                            class="bg-theme-surface w-full items-center justify-between gap-2 rounded-xl border px-3 py-3 {{ in_array($node['internalId'], $activeAncestors, true) ? 'border-theme-primary' : 'border-theme-outline-variant' }}"
                        >
                            <native:text
                                class="text-theme-on-surface flex-1 text-sm font-semibold"
                                >{{ $title }}</native:text
                            >
                            @if ($isCollapsed)
                                <native:icon
                                    :ios="Ios::ChevronRight"
                                    :android="Android::ChevronRight"
                                    :size="16"
                                    class="text-theme-on-surface-variant"
                                />
                            @else
                                <native:icon
                                    :ios="Ios::ChevronDown"
                                    :android="Android::ExpandMore"
                                    :size="16"
                                    class="text-theme-on-surface-variant"
                                />
                            @endif
                        </native:row>
                    </native:pressable>
                @elseif (! empty($node['href']) && ! $node['itemDisabled'])
                    <native:column
                        key="node-{{ $node['internalId'] }}"
                        class="ml-[{{ $indent }}px] w-full gap-1"
                    >
                        <native:pressable
                            ref="node-{{ $node['internalId'] }}"
                            class="w-full"
                            a11y-label="{{ $title }}"
                            @tap="select('{{ $node['internalId'] }}')"
                        >
                            <native:row
                                class="w-full items-center justify-between gap-3 rounded-xl border px-3 py-3 {{ $isActive ? 'bg-theme-primary-container border-theme-primary' : 'bg-theme-surface border-theme-outline-variant' }}"
                            >
                                <native:text
                                    class="text-theme-on-surface flex-1 text-sm {{ $node['isSyntheticLink'] ? 'font-medium' : '' }}"
                                    >{{ $title }}</native:text
                                >
                                <native:row
                                    class="items-center gap-1 rounded-full px-2 py-0.5 {{ $node['duration'] ? 'bg-theme-success-container' : 'bg-theme-surface-variant' }}"
                                >
                                    <native:icon
                                        :ios="Ios::Clock"
                                        :android="Android::Schedule"
                                        :size="12"
                                        class="{{ $node['duration'] ? 'text-theme-on-success-container' : 'text-theme-on-surface-variant' }}"
                                    />
                                    <native:text
                                        class="text-xs font-medium {{ $node['duration'] ? 'text-theme-on-success-container' : 'text-theme-on-surface-variant' }}"
                                        >{{ $node['duration'] ?? '未觀看' }}</native:text
                                    >
                                </native:row>
                            </native:row>
                        </native:pressable>

                        @if ($lastSeenIdentifier && $node['targetIdentifier'] === $lastSeenIdentifier && ! $isActive)
                            <native:text
                                class="text-theme-accent px-3 text-xs font-medium"
                                >{{ $lastSeenLabel }}</native:text
                            >
                        @endif
                    </native:column>
                @else
                    <native:row
                        key="node-{{ $node['internalId'] }}"
                        class="bg-theme-surface-variant ml-[{{ 12 + $indent }}px] w-full items-center rounded-xl px-3 py-2"
                    >
                        <native:text
                            class="text-theme-on-surface-variant flex-1 text-sm"
                            >{{ $title }}</native:text
                        >
                    </native:row>
                @endif
            @endforeach
        </native:column>
    @endif
</native:column>
