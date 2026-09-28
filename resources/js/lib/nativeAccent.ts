import { BridgeCall } from '#nativephp';
import type { AccentId } from '@/lib/accents';

export function isNativeAccentBridgeAvailable(): boolean {
    return (
        typeof document !== 'undefined' &&
        document.body?.classList.contains('device-ios') === true
    );
}

/**
 * Sets the iOS app-wide tint (selection handles, native controls, etc.) and the
 * native media player accent. Best effort: failures leave the default tint.
 */
export async function setNativeAccentColor(accent: AccentId): Promise<void> {
    if (!isNativeAccentBridgeAvailable()) {
        return;
    }

    try {
        await BridgeCall('AppAccent.SetColor', { accent });
    } catch {
        // Older native builds don't ship the function; keep the default tint.
    }
}
