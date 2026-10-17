import { router } from 'expo-router';
import { Linking } from 'react-native';

/** Opens `url` in the app's in-app browser screen (`/browser`). */
export function openInAppBrowser(url: string): void {
    router.push({ pathname: '/browser', params: { url } });
}

/** Opens `url` in the system browser or store app. */
export async function openExternalUrl(url: string): Promise<void> {
    try {
        await Linking.openURL(url);
    } catch {
        // No handler for the URL; nothing sensible to do.
    }
}
