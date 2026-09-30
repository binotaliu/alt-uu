@use ('App\Icons\Android')
@use ('App\Icons\Ios')

@if ($course !== null)
    <native:pressable
        ref="course-{{ $course->courseId }}"
        class="w-full"
        a11y-label="{{ $course->name }}"
        @tap="open"
    >
        <native:column
            class="bg-theme-surface border-theme-outline-variant w-full gap-2 rounded-xl border px-4 py-3"
        >
            <native:row class="w-full items-center justify-between gap-2">
                <native:row class="flex-1 items-center">
                    @if ($course->courseType)
                        <native:column
                            class="bg-theme-primary-container rounded-full px-2 py-0.5"
                        >
                            <native:text
                                class="text-theme-on-primary-container text-xs font-medium"
                                >{{ $course->courseType }}</native:text
                            >
                        </native:column>
                    @endif

                    @if ($course->className)
                        <native:column
                            class="bg-theme-surface-variant rounded-full px-2 py-0.5"
                        >
                            <native:text
                                max-lines="1"
                                class="text-theme-on-surface-variant text-xs font-medium"
                                >{{ $course->className }}</native:text
                            >
                        </native:column>
                    @endif
                </native:row>

                <native:row class="items-center gap-2">
                    @if ($tasksError && ! $tasksLoading)
                        <native:text
                            class="text-theme-on-surface-variant text-xs"
                            >取得待辦失敗</native:text
                        >
                    @elseif ($tasksLoading)
                        <native:rect
                            class="bg-theme-outline-variant h-5 w-14 rounded"
                        />
                    @else
                        @if ($pendingHomeworks > 0)
                            <native:row
                                class="border-theme-destructive items-center gap-1 rounded-full border px-2 py-0.5"
                            >
                                <native:icon
                                    :ios="Ios::Checklist"
                                    :android="Android::Assignment"
                                    :size="12"
                                    class="text-theme-destructive"
                                />
                                <native:text
                                    class="text-theme-destructive text-xs font-medium"
                                    >未繳作業 {{ $pendingHomeworks }}</native:text
                                >
                            </native:row>
                        @endif
                        @if ($unreadArticles > 0)
                            <native:row
                                class="border-theme-warning items-center gap-1 rounded-full border px-2 py-0.5"
                            >
                                <native:icon
                                    :ios="Ios::BubbleLeftAndBubbleRight"
                                    :android="Android::Forum"
                                    :size="12"
                                    class="text-theme-warning"
                                />
                                <native:text
                                    class="text-theme-warning text-xs font-medium"
                                    >未讀文章 {{ $unreadLabel }}</native:text
                                >
                            </native:row>
                        @endif
                        @if ($pendingHomeworks === 0 && $unreadArticles === 0)
                            <native:text
                                class="text-theme-on-surface-variant text-xs"
                                >無待辦</native:text
                            >
                        @endif
                    @endif
                </native:row>
            </native:row>

            <native:text
                max-lines="2"
                class="text-theme-on-surface text-base font-semibold"
                >{{ $course->name !== '' ? $course->name : '課程 '.$course->courseId }}</native:text
            >
        </native:column>
    </native:pressable>
@else
    <native:column />
@endif
