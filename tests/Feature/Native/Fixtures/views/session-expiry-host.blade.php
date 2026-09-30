<native:column>
    <native:button ref="expire" label="expire" @tap="expire" />
    <native:session-expired-picker
        key="expired"
        :visible="$sessionPickerVisible"
        :failed-account-id="$sessionPickerFailedAccountId"
        @cancel="closeSessionPicker"
        @switched="onSessionPickerSwitched"
    />
</native:column>
