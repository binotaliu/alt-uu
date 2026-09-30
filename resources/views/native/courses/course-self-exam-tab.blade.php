@if ($loading)
    <native:column
        class="bg-theme-surface border-theme-outline-variant w-full gap-3 rounded-xl border p-4"
        a11y-label="載入中"
    >
        @for ($i = 0; $i < 4; $i++)
            <native:rect
                class="bg-theme-outline-variant h-5 w-3/5 rounded"
                key="skeleton-{{ $i }}"
            />
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
@elseif (count($items) === 0)
    <native:empty-state key="empty" message="目前沒有可顯示的自我練習。" />
@else
    <native:column class="w-full gap-3">
        @foreach (array_values($items) as $index => $item)
            <native:column
                key="exam-{{ md5($item->type.'|'.$item->title.'|'.$item->actionUrl) }}"
                class="bg-theme-surface border-theme-outline-variant w-full gap-2 rounded-xl border p-4"
            >
                <native:row class="w-full items-start justify-between gap-2">
                    <native:text
                        class="text-theme-on-surface flex-1 text-base font-semibold"
                        >{{ $item->title }}</native:text
                    >
                    @if ($item->isSubmitted)
                        <native:column
                            class="bg-theme-success-container rounded-full px-2 py-0.5"
                        >
                            <native:text
                                class="text-theme-on-success-container text-xs font-medium"
                                >繳交完成</native:text
                            >
                        </native:column>
                    @endif
                </native:row>

                <native:row class="w-full gap-2 pt-1">
                    <native:button
                        ref="action-{{ $index }}"
                        variant="primary"
                        label="進行練習"
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

                @if (! $item->resultUrl && $item->resultUnavailableReason)
                    <native:text class="text-theme-on-surface-variant text-xs"
                        >無法檢視結果：{{ $item->resultUnavailableReason }}</native:text
                    >
                @endif
            </native:column>
        @endforeach
    </native:column>
@endif
