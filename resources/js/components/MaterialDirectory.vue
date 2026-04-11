<script setup lang="ts">
import {
    FolderIcon,
    ClockIcon,
    ChevronDownIcon,
    ChevronRightIcon,
} from '@heroicons/vue/24/outline';
import { ref, computed, nextTick, watch } from 'vue';
import { useRouter } from 'vue-router';
import { setNextNavigationKind } from '@/lib/nativePageTransition';
import type { MaterialNode, CourseItem, CourseLearningTimeItem } from '@/types';

type DirectorySourceNode = {
    identifier: string;
    href: string | null;
    text: string;
    level: number;
    itemDisabled: boolean;
    duration?: string | null;
};

type DirectoryDisplayNode = DirectorySourceNode & {
    internalId: string;
    targetIdentifier: string;
    isDirectory: boolean;
    isSyntheticLink: boolean;
    ancestorDirectoryIds: string[];
    parentInternalId: string | null;
};

const props = defineProps<{
    selectedCid: string;
    materialNodes?: MaterialNode[];
    learningTimeItems?: CourseLearningTimeItem[];
    activeNodeIdentifier?: string | null;
    nodeSelectMode?: 'event' | 'link';
    course?: CourseItem | null;
    isLoading?: boolean;
}>();

const emit = defineEmits<{
    nodeSelect: [identifier: string, href: string | null];
    'large-directory': [isLarge: boolean];
}>();

const vueRouter = useRouter();

const nodeSelectMode = computed(() => props.nodeSelectMode ?? 'event');

const sourceNodes = computed<DirectorySourceNode[]>(() => {
    if (props.learningTimeItems && props.learningTimeItems.length > 0) {
        return props.learningTimeItems.map((item) => ({
            identifier: item.identifier,
            href: item.href,
            text: item.text,
            level: item.level,
            itemDisabled: item.itemDisabled,
            duration: item.duration,
        }));
    }

    return props.materialNodes ?? [];
});

const directoryNodes = computed<DirectoryDisplayNode[]>(() => {
    const normalizedNodes: Array<
        Omit<DirectoryDisplayNode, 'ancestorDirectoryIds' | 'parentInternalId'>
    > = [];

    sourceNodes.value.forEach((node, index) => {
        const nextNode = sourceNodes.value[index + 1];
        const hasChildren = (nextNode?.level ?? -1) > node.level;

        if (hasChildren && node.href) {
            normalizedNodes.push({
                ...node,
                internalId: `${node.identifier}::folder`,
                targetIdentifier: `${node.identifier}::folder`,
                href: null,
                itemDisabled: true,
                duration: null,
                isDirectory: true,
                isSyntheticLink: false,
            });

            normalizedNodes.push({
                ...node,
                internalId: `${node.identifier}::link`,
                targetIdentifier: node.identifier,
                level: node.level + 1,
                itemDisabled: false,
                isDirectory: false,
                isSyntheticLink: true,
            });

            return;
        }

        normalizedNodes.push({
            ...node,
            internalId: node.identifier,
            targetIdentifier: node.identifier,
            isDirectory: hasChildren,
            isSyntheticLink: false,
        });
    });

    const stack: DirectoryDisplayNode[] = [];

    return normalizedNodes.map((node) => {
        while (
            stack.length > 0 &&
            stack[stack.length - 1].level >= node.level
        ) {
            stack.pop();
        }

        const parentNode = stack[stack.length - 1] ?? null;
        const displayNode: DirectoryDisplayNode = {
            ...node,
            ancestorDirectoryIds: parentNode
                ? [...parentNode.ancestorDirectoryIds, parentNode.internalId]
                : [],
            parentInternalId: parentNode?.internalId ?? null,
        };

        if (displayNode.isDirectory) {
            stack.push(displayNode);
        }

        return displayNode;
    });
});

const directoryIds = computed(() =>
    directoryNodes.value
        .filter((node) => node.isDirectory)
        .map((node) => node.internalId),
);

const LARGE_DIRECTORY_NODE_THRESHOLD = 60;

const isLargeDirectory = computed(
    () => directoryNodes.value.length >= LARGE_DIRECTORY_NODE_THRESHOLD,
);

const collapsedDirectoryIds = ref<Set<string>>(new Set());

const activeContentNode = computed(
    () =>
        directoryNodes.value.find(
            (node) =>
                node.targetIdentifier === props.activeNodeIdentifier &&
                !!node.href &&
                !node.itemDisabled,
        ) ?? null,
);

const activeAncestorDirectoryIds = computed(
    () => new Set(activeContentNode.value?.ancestorDirectoryIds ?? []),
);

const visibleNodes = computed(() =>
    directoryNodes.value.filter((node) => {
        return !node.ancestorDirectoryIds.some((ancestorId) =>
            collapsedDirectoryIds.value.has(ancestorId),
        );
    }),
);

watch(
    isLargeDirectory,
    (larger) => {
        emit('large-directory', larger);
    },
    { immediate: true },
);

const hasDirectories = computed(() => directoryIds.value.length > 0);

const allExpanded = computed(() => collapsedDirectoryIds.value.size === 0);

const scrollContainer = ref<HTMLElement | null>(null);
const lastScrollTop = ref(0);

watch(
    [directoryIds, activeAncestorDirectoryIds],
    ([nextDirectoryIds, nextActiveAncestorDirectoryIds]) => {
        const validDirectoryIds = new Set(nextDirectoryIds);
        const nextCollapsedDirectoryIds = new Set(
            [...collapsedDirectoryIds.value].filter((directoryId) =>
                validDirectoryIds.has(directoryId),
            ),
        );

        nextActiveAncestorDirectoryIds.forEach((directoryId) => {
            nextCollapsedDirectoryIds.delete(directoryId);
        });

        collapsedDirectoryIds.value = nextCollapsedDirectoryIds;
    },
    { immediate: true },
);

function updateScrollTop() {
    if (!scrollContainer.value) {
        return;
    }

    lastScrollTop.value = scrollContainer.value.scrollTop;
}

function isNodeActive(node: DirectoryDisplayNode): boolean {
    return node.targetIdentifier === props.activeNodeIdentifier && !!node.href;
}

function isNodeInActivePath(node: DirectoryDisplayNode): boolean {
    return activeAncestorDirectoryIds.value.has(node.internalId);
}

function toggleDirectory(node: DirectoryDisplayNode): void {
    const nextCollapsedDirectoryIds = new Set(collapsedDirectoryIds.value);

    if (nextCollapsedDirectoryIds.has(node.internalId)) {
        nextCollapsedDirectoryIds.delete(node.internalId);
    } else {
        nextCollapsedDirectoryIds.add(node.internalId);
    }

    collapsedDirectoryIds.value = nextCollapsedDirectoryIds;
}

function expandAllDirectories(): void {
    collapsedDirectoryIds.value = new Set();
}

function collapseAllDirectories(): void {
    collapsedDirectoryIds.value = new Set(directoryIds.value);
}

function isDirectoryCollapsed(node: DirectoryDisplayNode): boolean {
    return collapsedDirectoryIds.value.has(node.internalId);
}

watch(
    () => props.isLoading,
    (isLoading) => {
        if (isLoading) {
            // Keep current scroll position while loading (so it can be restored later)
            updateScrollTop();

            return;
        }

        // After loading completes, restore scroll position inside the list.
        nextTick(() => {
            if (!scrollContainer.value) {
                return;
            }

            scrollContainer.value.scrollTop = lastScrollTop.value;
        });
    },
);

watch(
    () => scrollContainer.value,
    (el, prev) => {
        if (prev) {
            prev.removeEventListener('scroll', updateScrollTop);
        }

        if (el) {
            el.addEventListener('scroll', updateScrollTop, { passive: true });
        }
    },
);

function handleNodeClick(node: DirectoryDisplayNode): void {
    if (nodeSelectMode.value === 'link') {
        setNextNavigationKind('forward');

        vueRouter.push(
            `/courses/${encodeURIComponent(props.selectedCid)}/${encodeURIComponent(node.targetIdentifier)}`,
        );
    } else {
        emit('nodeSelect', node.targetIdentifier, node.href);
    }
}
</script>

<template>
    <div class="flex h-full flex-col">
        <div
            class="sticky top-0 z-10 border-b border-warm-200/80 bg-white/92 px-3 pt-2 pb-3 backdrop-blur dark:border-zinc-700/80 dark:bg-zinc-900/92"
        >
            <div class="flex items-center justify-between gap-3 px-1">
                <div
                    class="flex items-center gap-2 text-sm font-semibold text-warm-800 dark:text-zinc-200"
                >
                    <FolderIcon class="h-4.5 w-4.5" />
                    教材目錄
                </div>

                <div
                    v-if="hasDirectories"
                    class="inline-flex items-center gap-1"
                >
                    <button
                        type="button"
                        class="rounded-full border border-warm-200 bg-white px-2.5 py-1 text-xs font-medium text-warm-700 transition hover:border-warm-400 hover:bg-warm-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:border-zinc-500 dark:hover:bg-zinc-800"
                        :disabled="allExpanded"
                        :class="
                            allExpanded ? 'cursor-not-allowed opacity-50' : ''
                        "
                        @click="expandAllDirectories"
                    >
                        全部展開
                    </button>
                    <button
                        type="button"
                        class="rounded-full border border-warm-200 bg-white px-2.5 py-1 text-xs font-medium text-warm-700 transition hover:border-warm-400 hover:bg-warm-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:border-zinc-500 dark:hover:bg-zinc-800"
                        :disabled="
                            directoryIds.length === collapsedDirectoryIds.size
                        "
                        :class="
                            directoryIds.length === collapsedDirectoryIds.size
                                ? 'cursor-not-allowed opacity-50'
                                : ''
                        "
                        @click="collapseAllDirectories"
                    >
                        全部收合
                    </button>
                </div>
            </div>
        </div>

        <div
            ref="scrollContainer"
            class="h-full min-h-0 flex-1 overflow-auto px-3 pt-2 pr-2 pb-3"
        >
            <template v-if="isLoading">
                <div class="space-y-2">
                    <div
                        class="h-10 animate-pulse rounded-xl bg-warm-200 dark:bg-zinc-700"
                    />
                    <div
                        class="h-10 animate-pulse rounded-xl bg-warm-200 dark:bg-zinc-700"
                    />
                    <div
                        class="h-10 animate-pulse rounded-xl bg-warm-200 dark:bg-zinc-700"
                    />
                    <div
                        class="h-10 animate-pulse rounded-xl bg-warm-200 dark:bg-zinc-700"
                    />
                </div>
            </template>

            <template v-else-if="directoryNodes.length === 0">
                <p
                    class="rounded-xl border border-dashed border-warm-300 bg-warm-50 p-4 text-sm text-warm-700 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"
                >
                    此課程目前沒有教材目錄可顯示。
                </p>
            </template>

            <transition-group
                name="material-directory"
                tag="div"
                class="space-y-2"
            >
                <template v-for="node in visibleNodes" :key="node.internalId">
                    <div
                        v-if="node.isDirectory"
                        class="sticky -top-3 z-10 -mt-2 block w-full bg-white pt-2 dark:bg-zinc-900"
                    >
                        <button
                            type="button"
                            class="block w-full rounded-xl border px-3 text-left transition"
                            :class="{
                                'border-warm-400 bg-warm-50 text-warm-900 dark:border-zinc-500 dark:bg-zinc-800 dark:text-zinc-100':
                                    isNodeInActivePath(node),
                                'border-warm-100 bg-warm-50 text-warm-900 hover:border-warm-400 hover:bg-warm-100 dark:border-zinc-700/70 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:border-zinc-600 dark:hover:bg-zinc-800':
                                    !isNodeInActivePath(node),
                            }"
                            :aria-expanded="!isDirectoryCollapsed(node)"
                            :style="{
                                marginLeft: `${node.level * 14}px`,
                                width: `calc(100% - ${node.level * 14}px)`,
                            }"
                            @click="toggleDirectory(node)"
                        >
                            <div
                                class="flex min-h-10 items-center justify-between gap-2"
                            >
                                <div
                                    class="flex min-w-0 grow items-center justify-between gap-2"
                                >
                                    <span
                                        class="line-clamp-2 grow text-sm font-semibold"
                                    >
                                        {{
                                            node.text ||
                                            node.identifier ||
                                            '未命名節點'
                                        }}
                                    </span>
                                    <ChevronDownIcon
                                        v-if="!isDirectoryCollapsed(node)"
                                        class="h-4 w-4 shrink-0 text-warm-600 dark:text-zinc-400"
                                    />
                                    <ChevronRightIcon
                                        v-else
                                        class="h-4 w-4 shrink-0 text-warm-600 dark:text-zinc-400"
                                    />
                                </div>
                            </div>
                        </button>
                    </div>

                    <button
                        v-else-if="node.href && !node.itemDisabled"
                        type="button"
                        class="block rounded-xl border px-3 py-1 text-left text-sm transition"
                        :class="
                            isNodeActive(node)
                                ? 'border-warm-500 bg-warm-100 text-warm-900 dark:border-zinc-500 dark:bg-zinc-700 dark:text-zinc-100'
                                : 'border-warm-200/70 bg-white text-warm-700 hover:border-warm-400 hover:bg-warm-50 dark:border-zinc-700/70 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:border-zinc-600 dark:hover:bg-zinc-800'
                        "
                        :style="{
                            marginLeft: `${node.level * 14}px`,
                            width: `calc(100% - ${node.level * 14}px)`,
                        }"
                        @click="handleNodeClick(node)"
                    >
                        <div
                            class="flex h-10 items-center justify-between gap-2"
                        >
                            <div class="min-w-0 flex-1">
                                <span
                                    class="line-clamp-2"
                                    :class="
                                        node.isSyntheticLink
                                            ? 'font-medium'
                                            : ''
                                    "
                                >
                                    {{
                                        node.text ||
                                        node.identifier ||
                                        '未命名節點'
                                    }}
                                </span>
                            </div>
                            <span
                                class="inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] tabular-nums"
                                :class="
                                    node.duration
                                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300'
                                        : 'bg-slate-100 text-slate-600 dark:bg-zinc-700 dark:text-zinc-300'
                                "
                            >
                                <ClockIcon class="h-3.5 w-3.5" />
                                {{ node.duration ?? '未觀看' }}
                            </span>
                        </div>
                    </button>

                    <div
                        v-else
                        class="block rounded-xl py-2.5 text-left text-base font-semibold text-warm-900 dark:text-zinc-100"
                        :style="{
                            marginLeft: `${12 + node.level * 14}px`,
                            width: `calc(100% - ${12 + node.level * 14}px)`,
                        }"
                    >
                        <div class="flex items-center justify-between gap-2">
                            <span class="truncate">{{
                                node.text || node.identifier || '未命名節點'
                            }}</span>
                        </div>
                    </div>
                </template>
            </transition-group>
        </div>
    </div>
</template>

<style scoped>
.material-directory-enter-from,
.material-directory-leave-to {
    opacity: 0;
    max-height: 0;
    transform: scaleY(0.96);
    overflow: hidden;
}

.material-directory-enter-active,
.material-directory-leave-active {
    transition:
        opacity 200ms ease,
        max-height 200ms ease,
        transform 200ms ease;
}

.material-directory-enter-to,
.material-directory-leave-from {
    opacity: 1;
    max-height: 1000px;
    transform: scaleY(1);
}

.material-directory-move {
    transition: transform 200ms ease;
}
</style>
