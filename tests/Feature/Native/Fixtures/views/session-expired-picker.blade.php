<native:session-expired-picker
    key="expired"
    :visible="$state['visible'] ?? false"
    :failed-account-id="$state['failed'] ?? null"
    return-to="/native/courses"
    @cancel="record('cancel')"
    @switched="record('switched')"
/>
