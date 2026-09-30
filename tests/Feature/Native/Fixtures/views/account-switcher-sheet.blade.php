<native:account-switcher-sheet
    key="switcher"
    :visible="$state['visible'] ?? false"
    return-to="/courses"
    @cancel="record('cancel')"
    @switched="record('switched')"
/>
