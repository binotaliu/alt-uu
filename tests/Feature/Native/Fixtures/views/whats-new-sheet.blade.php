<native:whats-new-sheet
    key="whats-new"
    :visible="$state['visible'] ?? false"
    @close="record('close')"
/>
