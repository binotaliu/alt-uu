import { watch, onMounted } from 'vue';
import type { Ref } from 'vue';

const appName = 'Alt UU';

export function useTitle(title: Ref<string> | string): void {
    const update = (val: string) => {
        document.title = val ? `${val} - ${appName}` : appName;
    };

    if (typeof title === 'string') {
        onMounted(() => update(title));
    } else {
        watch(title, update, { immediate: true });
    }
}
