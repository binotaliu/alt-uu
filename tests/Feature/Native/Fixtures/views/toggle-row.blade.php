<native:toggle-row
    key="row"
    label="自動播放"
    description="播放完自動下一則"
    :value="$state['value'] ?? false"
    :saving="$state['saving'] ?? false"
    :disabled="$state['disabled'] ?? false"
    @toggled="record('toggled')"
/>
