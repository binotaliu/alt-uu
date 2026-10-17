import { useEffect } from 'react';

import { useServiceRuntime } from '../services/AppServicesProvider';
import { useClientConfigStore, useWhatsNewStore } from '../services/stores';
import { hasUnseenRelease } from './releaseNotes';

/** Open / close the What's new sheet from anywhere (for example Settings). */
export function useWhatsNew() {
    const isOpen = useWhatsNewStore((state) => state.isOpen);
    const open = useWhatsNewStore((state) => state.open);
    const close = useWhatsNewStore((state) => state.close);

    return { isOpen, open, close };
}

/**
 * Opens the sheet once after an upgrade to a version that has release notes
 * (legacy MainScreen behaviour). Call it from the main courses screen.
 */
export function useShowWhatsNewOnUpgrade(): void {
    const runtime = useServiceRuntime();
    const preferencesLoaded = useClientConfigStore(
        (state) => state.preferencesLoaded,
    );
    const seenVersion = useClientConfigStore(
        (state) => state.preferences.whatsNewSeenVersion,
    );
    const onboardingCompleted = useClientConfigStore(
        (state) => state.preferences.onboardingCompleted,
    );
    const open = useWhatsNewStore((state) => state.open);
    const { appVersion } = runtime.services.buildConfig;

    useEffect(() => {
        if (
            preferencesLoaded &&
            onboardingCompleted &&
            hasUnseenRelease(appVersion, seenVersion)
        ) {
            open();
        }
    }, [preferencesLoaded, onboardingCompleted, appVersion, seenVersion, open]);
}
