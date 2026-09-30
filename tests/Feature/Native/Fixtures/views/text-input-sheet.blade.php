<native:text-input-sheet
    key="rename"
    :visible="$state['visible'] ?? false"
    title="修改名稱"
    description="設定這個帳號的自訂名稱"
    :initial-value="$state['initial'] ?? ''"
    placeholder="請輸入自訂名稱"
    :max-length="30"
    :processing="$state['processing'] ?? false"
    :error="$state['error'] ?? ''"
    @confirm="record('confirm')"
    @cancel="record('cancel')"
/>
