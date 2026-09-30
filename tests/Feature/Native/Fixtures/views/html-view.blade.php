<native:column class="h-full w-full">
    <native:html-view
        key="view"
        :html="$state['html'] ?? '<p>內容</p>'"
        :src="$state['src'] ?? null"
        :javascript="$state['javascript'] ?? null"
        :auto-height="$state['autoHeight'] ?? null"
        :estimated-height="$state['estimatedHeight'] ?? null"
        :color-scheme="$state['colorScheme'] ?? null"
        :font-scale="$state['fontScale'] ?? null"
        :user-script="$state['userScript'] ?? null"
        on-link-tap="record('link-tap')"
        on-height-change="record('height')"
        on-message="record('message')"
    />
</native:column>
