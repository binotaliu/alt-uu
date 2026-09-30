<native:bottom-sheet
    ref="text-input-sheet"
    :visible="$visible"
    detents="medium"
    @dismiss="cancel"
>
    <native:column class="w-full gap-4 p-5">
        <native:column class="w-full gap-2">
            <native:text
                class="text-theme-on-surface text-lg font-semibold"
                >{{ $title }}</native:text
            >
            @if ($description !== '')
                <native:text
                    class="text-theme-on-surface-variant text-sm"
                    >{{ $description }}</native:text
                >
            @endif
        </native:column>

        <native:outlined-text-input
            ref="input"
            native:model="value"
            :placeholder="$placeholder"
            :max-length="$maxLength"
            :error="$error !== ''"
            :supporting="$error"
            :disabled="$processing"
            @submit="confirm"
        />

        <native:row class="w-full justify-end gap-3">
            <native:button
                ref="cancel"
                variant="secondary"
                :label="$cancelLabel"
                :disabled="$processing"
                @tap="cancel"
            />
            <native:button
                ref="confirm"
                variant="primary"
                :label="$processing ? '儲存中…' : $confirmLabel"
                :loading="$processing"
                @tap="confirm"
            />
        </native:row>
    </native:column>
</native:bottom-sheet>
