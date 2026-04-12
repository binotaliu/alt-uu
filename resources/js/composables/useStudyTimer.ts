import { ref, onUnmounted } from 'vue';
import type { StudyTimePayload } from '@/types';

/**
 * Composable for tracking study time on a material node.
 * Sends study time records to the backend via fetch with keepalive.
 */
export function useStudyTimer(
    cid: string,
    getPositionSeconds?: () => Promise<number>,
) {
    const viewingSeconds = ref(0);
    const startedAt = ref<string | null>(null);
    const isSaving = ref(false);
    const lastKnownPlaybackPosition = ref<number | null>(null);

    let timer: ReturnType<typeof setInterval> | null = null;
    let startTimeMs: number | null = null;

    function startTracking(
        hasHref: boolean,
        startedAtOverride: string | null = null,
    ): void {
        stopTimer();

        const normalizedStartedAt = hasHref
            ? (startedAtOverride ?? new Date().toISOString())
            : null;

        startedAt.value = normalizedStartedAt;
        startTimeMs = normalizedStartedAt
            ? new Date(normalizedStartedAt).getTime()
            : null;

        if (startTimeMs !== null && Number.isNaN(startTimeMs)) {
            startedAt.value = new Date().toISOString();
            startTimeMs = new Date(startedAt.value).getTime();
        }

        viewingSeconds.value = startTimeMs
            ? Math.max(0, Math.floor((Date.now() - startTimeMs) / 1000))
            : 0;

        if (!hasHref) {
            return;
        }

        timer = setInterval(() => {
            if (!startTimeMs) {
                return;
            }

            const elapsedMs = Date.now() - startTimeMs;
            viewingSeconds.value = Math.max(0, Math.floor(elapsedMs / 1000));
        }, 1000);
    }

    function stopTimer(): void {
        if (timer) {
            clearInterval(timer);
            timer = null;
        }
    }

    function formatSeconds(total: number): string {
        const mins = Math.floor(total / 60)
            .toString()
            .padStart(2, '0');
        const secs = Math.floor(total % 60)
            .toString()
            .padStart(2, '0');

        return `${mins}:${secs}`;
    }

    async function sendStudyTime(
        activityId: string,
        url: string,
    ): Promise<boolean> {
        if (!startedAt.value) {
            return false;
        }

        const startedAtMs = new Date(startedAt.value).getTime();
        const seconds = Math.max(
            0,
            Math.floor((Date.now() - startedAtMs) / 1000),
        );

        if (seconds < 3) {
            return false;
        }

        viewingSeconds.value = seconds;

        const payload: StudyTimePayload = {
            cid,
            activityId,
            url,
            seconds,
            startedAt: startedAt.value,
        };

        if (getPositionSeconds) {
            try {
                const position = await getPositionSeconds();

                if (position > 0) {
                    payload.positionSeconds = position;
                    lastKnownPlaybackPosition.value = position;
                }
            } catch {
                // Best effort
            }
        }

        if (
            lastKnownPlaybackPosition.value !== null &&
            payload.positionSeconds === undefined
        ) {
            payload.positionSeconds = lastKnownPlaybackPosition.value;
        }

        try {
            const response = await fetch('/study-time', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Accept: 'application/json',
                },
                body: JSON.stringify(payload),
                keepalive: true,
            });

            return response.ok;
        } catch {
            // Best effort
            return false;
        }
    }

    function sendStudyTimeBeacon(activityId: string, url: string): void {
        if (!startedAt.value || viewingSeconds.value < 3) {
            return;
        }

        const formData = new FormData();
        formData.append('cid', cid);
        formData.append('activityId', activityId);
        formData.append('url', url);
        formData.append('seconds', String(viewingSeconds.value));

        if (startedAt.value) {
            formData.append('startedAt', startedAt.value);
        }

        if (lastKnownPlaybackPosition.value !== null) {
            formData.append(
                'positionSeconds',
                String(lastKnownPlaybackPosition.value),
            );
        }

        if (typeof navigator.sendBeacon === 'function') {
            navigator.sendBeacon('/study-time', formData);
        }
    }

    onUnmounted(() => {
        stopTimer();
    });

    function updatePlaybackPosition(position: number): void {
        if (Number.isFinite(position) && position >= 0) {
            lastKnownPlaybackPosition.value = position;
        }
    }

    return {
        viewingSeconds,
        startedAt,
        isSaving,
        startTracking,
        stopTimer,
        formatSeconds,
        sendStudyTime,
        sendStudyTimeBeacon,
        updatePlaybackPosition,
    };
}
