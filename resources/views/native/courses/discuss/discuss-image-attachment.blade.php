@if ($state === 'ready')
    <native:pressable
        ref="image"
        a11y-label="{{ $this->altText() }}"
        a11y-hint="放大檢視圖片"
        @tap="open"
    >
        <native:image
            src="{{ $localPath }}"
            alt="{{ $this->altText() }}"
            fit="cover"
            class="border-theme-outline-variant h-24 w-24 rounded-lg border"
        />
    </native:pressable>
@elseif ($state === 'loading')
    <native:stack
        class="bg-theme-surface-variant h-24 w-24 items-center justify-center rounded-lg"
    >
        <native:activity-indicator ref="loading" native:poll="1s" />
    </native:stack>
@else
    <native:attachment-row
        key="fallback"
        ref-prefix="image-fallback-"
        cid="{{ $cid }}"
        :filename="$filename ?? ''"
        :href="$href"
        :confirm="true"
    />
@endif
