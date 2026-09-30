@if ($loading)
    <native:column
        class="bg-theme-surface border-theme-outline-variant w-full gap-3 rounded-xl border p-4"
        a11y-label="載入中"
    >
        @for ($i = 0; $i < 4; $i++)
            <native:column class="w-full gap-2" key="skeleton-{{ $i }}">
                <native:rect
                    class="bg-theme-outline-variant h-5 w-3/5 rounded"
                />
                <native:rect
                    class="bg-theme-outline-variant/50 h-4 w-2/5 rounded"
                />
            </native:column>
        @endfor
    </native:column>
@elseif ($error !== '')
    <native:error-retry
        key="error"
        :message="$error"
        :detail="$errorDetail"
        :retrying="$loading"
        @retry="retry"
    />
@elseif (! $this->hasAnyItems())
    <native:empty-state key="empty" message="目前沒有可顯示的作業。" />
@else
    <native:column class="w-full gap-6">
        @if (count($schoolPortalNotices) > 0)
            <native:column class="w-full gap-3">
                <native:text
                    class="text-theme-on-surface-variant text-sm font-semibold"
                    >教務系統作業附件</native:text
                >

                @foreach ($schoolPortalNotices as $notice)
                    <native:column
                        key="notice-{{ md5($notice->title.'|'.$notice->downloadUrl) }}"
                        class="bg-theme-surface border-theme-outline-variant w-full gap-2 rounded-xl border p-4"
                    >
                        <native:text
                            class="text-theme-on-surface text-base font-semibold"
                            >{{ $notice->title }}</native:text
                        >
                        @if ($notice->dueDate)
                            <native:text
                                class="text-theme-on-surface-variant text-sm"
                                >{{ $notice->dueDate }}</native:text
                            >
                        @endif

                        @if ($notice->submissionMethod)
                            <native:text
                                class="text-theme-on-surface-variant text-xs"
                                >繳交方式：{{ $notice->submissionMethod }}</native:text
                            >
                        @endif

                        @if ($notice->downloadUrl)
                            <native:attachment-row
                                key="attachment-{{ md5((string) $notice->downloadUrl) }}"
                                cid="{{ $cid }}"
                                filename="{{ $this->noticeFilename($notice->downloadUrl, $notice->title) }}"
                                href="{{ $notice->downloadUrl }}"
                                source="school_portal"
                                download-filename="{{ $this->noticeFilename($notice->downloadUrl, '') }}"
                            />
                        @else
                            <native:text
                                class="text-theme-on-surface-variant text-xs"
                                >目前沒有可下載的附件。</native:text
                            >
                        @endif
                    </native:column>
                @endforeach
            </native:column>
        @endif

        @if (count($items) > 0)
            <native:column class="w-full gap-3">
                @if (count($schoolPortalNotices) > 0)
                    <native:text
                        class="text-theme-on-surface-variant text-sm font-semibold"
                        >數位學習平台作業</native:text
                    >
                @endif

                @foreach (array_values($items) as $index => $item)
                    <native:column
                        key="homework-{{ md5($item->type.'|'.$item->title.'|'.$item->actionUrl) }}"
                        class="bg-theme-surface border-theme-outline-variant w-full gap-2 rounded-xl border p-4"
                    >
                        <native:row class="w-full items-center gap-2">
                            <native:text
                                class="text-theme-on-surface flex-1 text-base font-semibold"
                                >{{ $item->title }}</native:text
                            >
                            @if ($item->percent)
                                <native:column
                                    class="bg-theme-primary-container rounded-full px-2 py-0.5"
                                >
                                    <native:text
                                        class="text-theme-on-primary-container text-xs"
                                        >{{ $item->percent }}</native:text
                                    >
                                </native:column>
                            @endif
                        </native:row>

                        @if ($item->status)
                            <native:text
                                class="text-theme-on-surface-variant text-sm"
                                >{{ $item->status }}</native:text
                            >
                        @endif

                        @if ($item->window)
                            <native:text
                                class="text-theme-on-surface-variant text-xs"
                                >{{ $item->window }}</native:text
                            >
                        @endif

                        <native:row class="w-full gap-2 pt-1">
                            <native:button
                                ref="action-{{ $index }}"
                                variant="primary"
                                label="進行作業"
                                :disabled="! $item->actionUrl"
                                @tap="openItem('action', {{ $index }})"
                            />
                            <native:button
                                ref="result-{{ $index }}"
                                variant="secondary"
                                label="檢視結果"
                                :disabled="! $item->resultUrl"
                                @tap="openItem('result', {{ $index }})"
                            />
                        </native:row>
                    </native:column>
                @endforeach
            </native:column>
        @endif
    </native:column>
@endif
