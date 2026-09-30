<native:bottom-sheet
    ref="confirm-sheet"
    :visible="$visible"
    detents="small"
    @dismiss="cancel"
>
    <native:column class="w-full gap-4 p-5">
        <native:column class="w-full gap-2">
            <native:text
                class="text-theme-on-surface text-lg font-semibold"
                >{{ $title }}</native:text
            >
            <native:text
                class="text-theme-on-surface-variant text-sm"
                >{{ $message }}</native:text
            >
        </native:column>

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
                :variant="$danger ? 'destructive' : 'primary'"
                :label="$confirmLabel"
                :loading="$processing"
                @tap="confirm"
            />
        </native:row>
    </native:column>
</native:bottom-sheet>
