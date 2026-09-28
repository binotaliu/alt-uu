import { defineStore } from 'pinia';
import { ref } from 'vue';

export const useSessionExpiryStore = defineStore('sessionExpiry', () => {
    const pickerOpen = ref(false);
    const failedAccountId = ref<number | null>(null);
    const returnTo = ref<string | null>(null);

    function openPicker(accountId: number | null): void {
        failedAccountId.value = accountId;
        pickerOpen.value = true;
    }

    function closePicker(): void {
        pickerOpen.value = false;
    }

    return {
        pickerOpen,
        failedAccountId,
        returnTo,
        openPicker,
        closePicker,
    };
});
