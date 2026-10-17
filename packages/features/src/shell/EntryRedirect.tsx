import { Screen } from '@altuu/ui';
import { Redirect } from 'expo-router';
import { ActivityIndicator } from 'react-native';

import { useBootstrapStore } from '../services/stores';

/**
 * The `/` route: sends the user to onboarding, login or the course list
 * (legacy `resolveInitialRoute`). The session itself is validated in the
 * background by the launch tasks, so this never waits for the network.
 */
export function EntryRedirect() {
    const ready = useBootstrapStore((state) => state.ready);
    const initialRoute = useBootstrapStore((state) => state.initialRoute);

    if (!ready) {
        return (
            <Screen className="items-center justify-center">
                <ActivityIndicator />
            </Screen>
        );
    }

    return <Redirect href={initialRoute} />;
}
