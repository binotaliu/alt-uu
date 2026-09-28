import { BridgeCall } from '#nativephp';

export type NativeMediaType = 'audio' | 'video';
export type NativeAppearanceMode = 'system' | 'light' | 'dark';

export interface NativeMediaSessionContext {
    routePath: string;
    cid: string;
    activityId: string;
    href?: string | null;
    startedAt?: string | null;
}

export interface NativeMediaPlayerState {
    isActive: boolean;
    currentTime: number;
    type: NativeMediaType;
    url?: string;
    sessionContext?: Partial<NativeMediaSessionContext>;
}

export interface NativeMediaFrame {
    x: number;
    y: number;
    width: number;
    height: number;
}

interface SetNativeMediaPlayerPayload {
    url: string;
    type: NativeMediaType;
    frame: NativeMediaFrame;
    courseName?: string;
    materialName?: string;
    appearance?: NativeAppearanceMode;
    sessionContext?: NativeMediaSessionContext | null;
    force?: boolean;
}

export function isNativeMediaBridgeAvailable(): boolean {
    if (typeof window === 'undefined') {
        return false;
    }

    return (
        document.body.classList.contains('device-android') ||
        document.body.classList.contains('device-ios')
    );
}

export async function setNativeMediaPlayer(
    payload: SetNativeMediaPlayerPayload,
): Promise<boolean> {
    try {
        const body: Record<string, unknown> = {
            url: payload.url,
            type: payload.type,
            frame: payload.frame,
        };

        if (payload.courseName) {
            body.courseName = payload.courseName;
        }

        if (payload.materialName) {
            body.materialName = payload.materialName;
        }

        if (payload.appearance) {
            body.appearance = payload.appearance;
        }

        if (payload.sessionContext) {
            body.sessionContext = payload.sessionContext;
        }

        if (payload.force) {
            body.force = true;
        }

        await BridgeCall('MediaPlayer.SetPlayer', body);

        return true;
    } catch {
        return false;
    }
}

export async function stopNativeMediaPlayer(
    expectedUrl?: string,
): Promise<void> {
    try {
        await BridgeCall(
            'MediaPlayer.Stop',
            expectedUrl ? { url: expectedUrl } : undefined,
        );
    } catch {
        // Ignore missing bridge in non-native environments.
    }
}

export async function getNativeMediaCurrentTime(): Promise<number> {
    try {
        const result = await BridgeCall('MediaPlayer.GetCurrentTime');
        const time = (result as { time?: number }).time;

        return typeof time === 'number' && isFinite(time) ? time : 0;
    } catch {
        return 0;
    }
}

export async function getNativeMediaDuration(): Promise<number> {
    try {
        const result = await BridgeCall('MediaPlayer.GetCurrentTime');
        const duration = (result as { duration?: number }).duration;

        return typeof duration === 'number' && isFinite(duration)
            ? duration
            : 0;
    } catch {
        return 0;
    }
}

export function isNativeFrameCaptureAvailable(): boolean {
    return isNativeMediaBridgeAvailable();
}

/**
 * Captures the current video frame natively (watermarked with the student ID)
 * and presents the system share sheet. Rejects with the native error message.
 */
export async function captureNativeMediaFrame(payload: {
    studentId: string;
    courseName?: string;
    materialName?: string;
}): Promise<void> {
    await BridgeCall('MediaPlayer.CaptureFrame', payload);
}

export async function getNativeMediaState(): Promise<NativeMediaPlayerState | null> {
    try {
        const result = await BridgeCall('MediaPlayer.GetState');
        const state = result as Partial<NativeMediaPlayerState>;

        if (typeof state.isActive !== 'boolean') {
            return null;
        }

        return {
            isActive: state.isActive,
            currentTime:
                typeof state.currentTime === 'number' &&
                isFinite(state.currentTime)
                    ? state.currentTime
                    : 0,
            type: state.type === 'video' ? 'video' : 'audio',
            url: typeof state.url === 'string' ? state.url : undefined,
            sessionContext:
                state.sessionContext && typeof state.sessionContext === 'object'
                    ? state.sessionContext
                    : undefined,
        };
    } catch {
        return null;
    }
}
