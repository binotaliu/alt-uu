<script setup lang="ts">
import { XMarkIcon } from '@heroicons/vue/24/outline';
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';

const props = defineProps<{
    isOpen: boolean;
    src: string | null;
    alt?: string | null;
}>();

const emit = defineEmits<{
    close: [];
}>();

const MIN_SCALE = 1;
const MAX_SCALE = 4;
const DOUBLE_TAP_SCALE = 2.5;

const scale = ref(MIN_SCALE);
const translateX = ref(0);
const translateY = ref(0);

let pointers = new Map<number, { x: number; y: number }>();
let pinchStartDistance = 0;
let pinchStartScale = MIN_SCALE;
let panStart = { x: 0, y: 0, translateX: 0, translateY: 0 };
let isPanning = false;
let lastTapTime = 0;

function resetTransform(): void {
    scale.value = MIN_SCALE;
    translateX.value = 0;
    translateY.value = 0;
}

function clampScale(value: number): number {
    return Math.min(MAX_SCALE, Math.max(MIN_SCALE, value));
}

function distanceBetween(
    a: { x: number; y: number },
    b: { x: number; y: number },
): number {
    return Math.hypot(a.x - b.x, a.y - b.y);
}

function onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
        emit('close');
    }
}

function onPointerDown(event: PointerEvent): void {
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });

    if (pointers.size === 2) {
        const [a, b] = [...pointers.values()];
        pinchStartDistance = distanceBetween(a, b);
        pinchStartScale = scale.value;
    } else if (pointers.size === 1 && scale.value > MIN_SCALE) {
        isPanning = true;
        panStart = {
            x: event.clientX,
            y: event.clientY,
            translateX: translateX.value,
            translateY: translateY.value,
        };
    }
}

function onPointerMove(event: PointerEvent): void {
    if (!pointers.has(event.pointerId)) {
        return;
    }

    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });

    if (pointers.size === 2) {
        const [a, b] = [...pointers.values()];
        const distance = distanceBetween(a, b);

        if (pinchStartDistance > 0) {
            scale.value = clampScale(
                pinchStartScale * (distance / pinchStartDistance),
            );
        }
    } else if (isPanning && pointers.size === 1) {
        translateX.value = panStart.translateX + (event.clientX - panStart.x);
        translateY.value = panStart.translateY + (event.clientY - panStart.y);
    }
}

function endPointer(event: PointerEvent): void {
    pointers.delete(event.pointerId);

    if (pointers.size < 2) {
        pinchStartDistance = 0;
    }

    if (pointers.size === 0) {
        isPanning = false;

        if (scale.value <= MIN_SCALE) {
            resetTransform();
        }
    }
}

function onImageClick(event: MouseEvent): void {
    const now = Date.now();
    const isDoubleTap = now - lastTapTime < 300;
    lastTapTime = now;

    if (!isDoubleTap) {
        return;
    }

    event.stopPropagation();

    if (scale.value > MIN_SCALE) {
        resetTransform();
    } else {
        scale.value = DOUBLE_TAP_SCALE;
    }
}

function onWheel(event: WheelEvent): void {
    event.preventDefault();
    scale.value = clampScale(scale.value - event.deltaY * 0.01);

    if (scale.value <= MIN_SCALE) {
        resetTransform();
    }
}

onMounted(() => {
    window.addEventListener('keydown', onKeydown);
});

onBeforeUnmount(() => {
    window.removeEventListener('keydown', onKeydown);
});

watch(
    () => props.isOpen,
    (isOpen) => {
        document.body.style.overflow = isOpen ? 'hidden' : '';

        if (!isOpen) {
            pointers.clear();
            isPanning = false;
            resetTransform();
        }
    },
);
</script>

<template>
    <Teleport to="body">
        <div
            v-if="isOpen && src"
            class="fixed inset-0 z-[80] flex items-center justify-center overflow-hidden bg-black/80"
            role="dialog"
            aria-modal="true"
            @click.self="emit('close')"
        >
            <button
                type="button"
                class="absolute top-[max(var(--inset-top,0px),1rem)] right-[max(var(--inset-right,0px),1rem)] z-10 rounded-full bg-black/40 p-2 text-white transition hover:bg-black/60"
                aria-label="關閉"
                @click="emit('close')"
            >
                <XMarkIcon class="h-6 w-6" />
            </button>
            <img
                :src="src"
                :alt="alt ?? '附件圖片'"
                class="max-h-full max-w-full touch-none rounded-lg object-contain shadow-2xl select-none"
                :class="scale > MIN_SCALE ? 'cursor-move' : 'cursor-zoom-in'"
                :style="{
                    transform: `translate(${translateX}px, ${translateY}px) scale(${scale})`,
                    transition: isPanning ? 'none' : 'transform 0.15s ease-out',
                }"
                draggable="false"
                @pointerdown="onPointerDown"
                @pointermove="onPointerMove"
                @pointerup="endPointer"
                @pointercancel="endPointer"
                @click="onImageClick"
                @wheel="onWheel"
            />
        </div>
    </Teleport>
</template>
