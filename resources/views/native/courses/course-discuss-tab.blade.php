@if ($error !== '' && ! $loading)
    <native:error-retry
        key="error"
        :message="$error"
        :detail="$errorDetail"
        :retrying="$loading"
        @retry="retry"
    />
@elseif ($loading && $this->isEmpty())
    <native:column class="w-full gap-2" a11y-label="載入中">
        @for ($i = 0; $i < 4; $i++)
            <native:rect
                class="bg-theme-outline-variant h-14 w-full rounded-xl"
                key="board-skeleton-{{ $i }}"
            />
        @endfor
    </native:column>
@else
    <native:column class="w-full gap-5">
        @foreach ($boardSections as $section)
            <native:column
                class="w-full gap-2"
                key="section-{{ $section['courseId'] }}"
            >
                <native:text
                    class="text-theme-on-surface text-sm font-semibold"
                    >{{ $section['title'] }}</native:text
                >
                <native:divider />

                @forelse ($section['boards'] as $board)
                    <native:pressable
                        ref="board-{{ $section['courseId'] }}-{{ $board->boardId }}"
                        key="board-{{ $section['courseId'] }}-{{ $board->boardId }}"
                        class="w-full"
                        a11y-label="{{ $board->boardName !== '' ? $board->boardName : '未命名看板' }}"
                        @tap="openBoard('{{ $section['courseId'] }}', '{{ $board->boardId }}')"
                    >
                        <native:column
                            class="bg-theme-surface border-theme-outline-variant w-full gap-1 rounded-xl border px-3 py-2"
                        >
                            <native:row
                                class="w-full items-center justify-between gap-2"
                            >
                                <native:text
                                    max-lines="1"
                                    class="text-theme-on-surface flex-1 text-base font-medium"
                                    >{{ $board->boardName !== '' ? $board->boardName : '未命名看板' }}</native:text
                                >
                                @if ($board->hasNewPost)
                                    <native:column
                                        class="bg-theme-warning rounded-full px-2 py-0.5"
                                    >
                                        <native:text
                                            class="text-theme-on-warning text-xs font-semibold"
                                            >新文章</native:text
                                        >
                                    </native:column>
                                @endif
                            </native:row>
                            <native:text
                                class="text-theme-on-surface-variant text-sm"
                                >主題數：{{ $board->subjectCount ?? 0 }}</native:text
                            >
                        </native:column>
                    </native:pressable>
                @empty
                    <native:empty-state
                        key="empty-{{ $section['courseId'] }}"
                        message="目前沒有可顯示的討論板。"
                    />
                @endforelse
            </native:column>
        @endforeach
    </native:column>
@endif
