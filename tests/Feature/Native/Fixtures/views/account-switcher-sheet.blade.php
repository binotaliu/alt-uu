<native:account-switcher-sheet
    key="switcher"
    :visible="$state['visible'] ?? false"
    return-to="/native/courses"
    @cancel="record('cancel')"
    @switched="record('switched')"
/>
