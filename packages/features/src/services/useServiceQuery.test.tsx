import { UserFacingHttpError } from '@altuu/core';
import { renderHook, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import {
    createFakeServices,
    createTestQueryClient,
    resetStores,
} from '../testing/fakeServices';
import { AppServicesProvider } from './AppServicesProvider';
import { ServiceError } from './serviceError';
import { useServiceMutation, useServiceQuery } from './useServiceQuery';

beforeEach(resetStores);

function setup() {
    const fake = createFakeServices();
    const queryClient = createTestQueryClient();
    const wrapper = ({ children }: { children: ReactNode }) => (
        <AppServicesProvider
            services={fake.services}
            queryClient={queryClient}
            router={{ push: jest.fn(), replace: jest.fn() }}
        >
            {children}
        </AppServicesProvider>
    );

    return { ...fake, wrapper };
}

describe('useServiceQuery', () => {
    it('resolves data and records the operation', async () => {
        const { wrapper, state } = setup();
        const { result } = await renderHook(
            () =>
                useServiceQuery({
                    op: 'accounts.list',
                    queryKey: ['t1'],
                    queryFn: async () => 'hello',
                }),
            { wrapper },
        );

        await waitFor(() => expect(result.current.data).toBe('hello'));
        expect(state.operations).toEqual([
            { op: 'accounts.list', failed: false },
        ]);
    });

    it('exposes failures as ServiceError with the operation code', async () => {
        const { wrapper } = setup();
        const { result } = await renderHook(
            () =>
                useServiceQuery({
                    op: 'courses.list',
                    queryKey: ['t2'],
                    queryFn: async () => {
                        throw new UserFacingHttpError(500, '壞掉了');
                    },
                }),
            { wrapper },
        );

        await waitFor(() => expect(result.current.error).not.toBeNull());
        expect(result.current.error).toBeInstanceOf(ServiceError);
        expect(result.current.error?.message).toBe('壞掉了');
        expect(result.current.error?.displayCode).toBe('CRS-H500');
    });
});

describe('useServiceMutation', () => {
    it('passes variables and services to the mutation function', async () => {
        const { wrapper, state } = setup();
        const { result } = await renderHook(
            () =>
                useServiceMutation({
                    op: 'app.preferences',
                    mutationFn: async (value: string, services) => {
                        expect(services).toBeDefined();

                        return `${value}!`;
                    },
                }),
            { wrapper },
        );

        await expect(result.current.mutateAsync('hi')).resolves.toBe('hi!');
        expect(state.operations[0]).toEqual({
            op: 'app.preferences',
            failed: false,
        });
    });
});
