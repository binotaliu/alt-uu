import { render } from '@testing-library/react-native';
import type { ReactElement } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AppServicesProvider } from '../services/AppServicesProvider';
import type { AppServices } from '../services/types';
import {
  createFakeServices,
  createTestQueryClient,
  resetStores,
} from '../testing/fakeServices';

const metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
};

/**
 * Renders `ui` with the fake shell services plus per-test service
 * overrides (`{ course: {...}, nouTools: {...} }`, merged at the top level).
 */
export async function renderWithServices(
  ui: ReactElement,
  overrides: Partial<Record<keyof AppServices, unknown>> = {},
) {
  resetStores();

  const { services } = createFakeServices();
  const merged = { ...services, ...overrides } as unknown as AppServices;
  const queryClient = createTestQueryClient();
  const router = { push: jest.fn(), replace: jest.fn() };

  const result = await render(
    <SafeAreaProvider initialMetrics={metrics}>
      <AppServicesProvider
        services={merged}
        queryClient={queryClient}
        router={router}
      >
        {ui}
      </AppServicesProvider>
    </SafeAreaProvider>,
  );

  return { ...result, services: merged, queryClient };
}
