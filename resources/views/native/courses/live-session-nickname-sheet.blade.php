@use ('App\Icons\Android')
@use ('App\Icons\Ios')

<native:bottom-sheet
    ref="nickname-sheet"
    :visible="$visible"
    detents="medium"
    @dismiss="close"
>
    <native:column class="w-full gap-4 p-5">
        <native:column class="w-full gap-2">
            <native:text class="text-theme-on-surface text-lg font-semibold"
                >設定顯示暱稱</native:text
            >
            <native:text class="text-theme-on-surface-variant text-sm"
                >進入教室前，請將您的顯示暱稱設定為以下內容，方便老師與同學辨識身分。</native:text
            >
        </native:column>

        @foreach ($fields as $field)
            <native:outlined-text-input
                key="field-{{ $field['key'] }}"
                ref="field-{{ $field['key'] }}"
                :label="$field['label']"
                :value="$field['value']"
                :read-only="true"
            />
        @endforeach

        <native:text class="text-theme-on-surface-variant text-xs"
            >點選欄位後可全選並複製文字。</native:text
        >

        <native:pressable
            ref="toggle-more"
            a11y-label="{{ $showMoreInfo ? '隱藏更多資訊' : '顯示更多資訊' }}"
            @tap="toggleMoreInfo"
        >
            <native:text
                class="text-theme-accent py-1 text-sm font-medium"
                >{{ $showMoreInfo ? '隱藏更多資訊' : '顯示更多資訊' }}</native:text
            >
        </native:pressable>

        <native:row class="w-full justify-end gap-3">
            <native:button
                ref="nickname-cancel"
                variant="secondary"
                label="取消"
                @tap="close"
            />
            <native:button
                ref="nickname-enter"
                variant="primary"
                label="進入教室"
                :icon="'videocam'"
                @tap="enter"
            />
        </native:row>
    </native:column>
</native:bottom-sheet>
