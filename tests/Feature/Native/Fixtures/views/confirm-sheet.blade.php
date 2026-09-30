<native:confirm-sheet
    key="confirm"
    :visible="$state['visible'] ?? false"
    title="移除帳號"
    message="移除後需要重新登入。"
    confirm-label="移除"
    :danger="true"
    :processing="$state['processing'] ?? false"
    @confirm="record('confirm')"
    @cancel="record('cancel')"
/>
