@use ('App\Icons\Android')
@use ('App\Icons\Ios')

@php
    $previous = $m->previousNode();
    $next = $m->nextNode();
@endphp

@if ($previous !== null || $next !== null)
    <native:row class="w-full gap-3">
        @if ($previous !== null)
            <native:pressable
                ref="previous-node"
                class="flex-1"
                a11y-label="上一個教材：{{ $previous->text }}"
                @tap="goToPrevious"
            >
                <native:row
                    class="bg-theme-surface border-theme-outline-variant w-full items-start gap-2 rounded-2xl border p-3"
                >
                    <native:icon
                        :ios="Ios::ChevronLeft"
                        :android="Android::ChevronLeft"
                        :size="16"
                        class="text-theme-on-surface-variant"
                    />
                    <native:column class="flex-1 gap-1">
                        <native:text
                            class="text-theme-on-surface-variant text-xs font-medium"
                            >上一個教材</native:text
                        >
                        <native:text
                            max-lines="2"
                            class="text-theme-on-surface text-sm font-semibold"
                            >{{ $previous->text }}</native:text
                        >
                    </native:column>
                </native:row>
            </native:pressable>
        @else
            <native:row
                class="bg-theme-surface border-theme-outline-variant flex-1 items-start gap-2 rounded-2xl border p-3 opacity-40"
            >
                <native:icon
                    :ios="Ios::ChevronLeft"
                    :android="Android::ChevronLeft"
                    :size="16"
                    class="text-theme-on-surface-variant"
                />
                <native:column class="flex-1 gap-1">
                    <native:text
                        class="text-theme-on-surface-variant text-xs font-medium"
                        >上一個教材</native:text
                    >
                    <native:text
                        class="text-theme-on-surface text-sm font-semibold"
                        >無</native:text
                    >
                </native:column>
            </native:row>
        @endif

        @if ($next !== null)
            <native:pressable
                ref="next-node"
                class="flex-1"
                a11y-label="下一個教材：{{ $next->text }}"
                @tap="goToNext"
            >
                <native:row
                    class="bg-theme-surface border-theme-outline-variant w-full items-start justify-end gap-2 rounded-2xl border p-3"
                >
                    <native:column class="flex-1 gap-1">
                        <native:text
                            class="text-theme-on-surface-variant text-right text-xs font-medium"
                            >下一個教材</native:text
                        >
                        <native:text
                            max-lines="2"
                            class="text-theme-on-surface text-right text-sm font-semibold"
                            >{{ $next->text }}</native:text
                        >
                    </native:column>
                    <native:icon
                        :ios="Ios::ChevronRight"
                        :android="Android::ChevronRight"
                        :size="16"
                        class="text-theme-on-surface-variant"
                    />
                </native:row>
            </native:pressable>
        @else
            <native:row
                class="bg-theme-surface border-theme-outline-variant flex-1 items-start justify-end gap-2 rounded-2xl border p-3 opacity-40"
            >
                <native:column class="flex-1 gap-1">
                    <native:text
                        class="text-theme-on-surface-variant text-right text-xs font-medium"
                        >下一個教材</native:text
                    >
                    <native:text
                        class="text-theme-on-surface text-right text-sm font-semibold"
                        >無</native:text
                    >
                </native:column>
                <native:icon
                    :ios="Ios::ChevronRight"
                    :android="Android::ChevronRight"
                    :size="16"
                    class="text-theme-on-surface-variant"
                />
            </native:row>
        @endif
    </native:row>
@endif
