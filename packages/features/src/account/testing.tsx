import { render } from '@testing-library/react-native';
import type { ReactElement } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AppServicesProvider } from '../services/AppServicesProvider';
import type { AppServices } from '../services/types';
import {
    createFakeServices,
    type FakeServiceState,
} from '../testing/fakeServices';

const metrics = {
    frame: { x: 0, y: 0, width: 390, height: 844 },
    insets: { top: 0, left: 0, right: 0, bottom: 0 },
};

/** Deep-ish merge of per-test service stubs over the shared fake services. */
export function withServices(
    overrides: { [K in keyof AppServices]?: Partial<AppServices[K]> | object },
    state: Partial<FakeServiceState> = {},
): { services: AppServices; state: FakeServiceState } {
    const fake = createFakeServices(state);
    const services = { ...fake.services } as unknown as Record<string, object>;

    for (const [key, value] of Object.entries(overrides)) {
        services[key] = { ...services[key], ...value };
    }

    return { services: services as unknown as AppServices, state: fake.state };
}

export async function renderScreen(
    element: ReactElement,
    services: AppServices = createFakeServices().services,
) {
    return render(
        <SafeAreaProvider initialMetrics={metrics}>
            <AppServicesProvider services={services}>
                {element}
            </AppServicesProvider>
        </SafeAreaProvider>,
    );
}
