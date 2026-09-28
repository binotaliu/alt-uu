import { watch, onActivated, onMounted } from 'vue';
import type { Ref } from 'vue';

const appName = 'Alt UU';

export function useTitle(title: Ref<string> | string): void {
    const update = (val: string) => {
        document.title = val ? `${val} - ${appName}` : appName;
    };

    if (typeof title === 'string') {
        // onActivated also fires on a component's first mount, so this and
        // onMounted would both run then — harmless since both set the same
        // value. Both are needed because a page kept alive by <KeepAlive>
        // skips onMounted on every visit after the first.
        onMounted(() => update(title));
        onActivated(() => update(title));
    } else {
        watch(title, update, { immediate: true });
    }
}
