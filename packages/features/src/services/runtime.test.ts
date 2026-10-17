import { SessionInvalidError, UserFacingHttpError } from '@altuu/core';

import {
    account,
    createTestRuntime,
    resetStores,
} from '../testing/fakeServices';
import { ServiceError } from './serviceError';
import {
    useBootstrapStore,
    useClientConfigStore,
    useSessionExpiryStore,
} from './stores';

beforeEach(resetStores);

describe('run', () => {
    it('tracks the operation and returns the result', async () => {
        const { runtime, state } = createTestRuntime();

        await expect(runtime.run('courses.list', () => 42)).resolves.toBe(42);
        expect(state.operations).toEqual([
            { op: 'courses.list', failed: false },
        ]);
    });

    it('rejects with a ServiceError carrying the user-facing message and code', async () => {
        const { runtime } = createTestRuntime();
        const error = await runtime
            .run('courses.list', () => {
                throw new UserFacingHttpError(503, '學校系統忙碌中');
            })
            .catch((caught: unknown) => caught);

        expect(error).toBeInstanceOf(ServiceError);
        expect((error as ServiceError).message).toBe('學校系統忙碌中');
        expect((error as ServiceError).displayCode).toBe('CRS-U503');
    });

    it('hides unexpected errors behind the generic message', async () => {
        const { runtime } = createTestRuntime();
        const error = (await runtime
            .run('courses.list', () => {
                throw new TypeError('boom');
            })
            .catch((caught: unknown) => caught)) as ServiceError;

        expect(error.message).toBe('App 發生未預期的錯誤，請稍後再試。');
        expect(error.displayCode).toBe('CRS-J');
        expect(error.exception.message).toBe('boom');
    });
});

describe('session expiry', () => {
    it('opens the picker when other accounts exist', async () => {
        const { runtime } = createTestRuntime({
            accounts: [account(2), account(3)],
        });

        await runtime.handleSessionInvalid(1);

        const expiry = useSessionExpiryStore.getState();
        expect(expiry.pickerOpen).toBe(true);
        expect(expiry.failedAccountId).toBe(1);
    });

    it('sends the user to re-login when the failed account is the only one', async () => {
        const { runtime, router } = createTestRuntime({
            accounts: [account(1)],
        });
        useSessionExpiryStore.getState().setCurrentPath('/courses');

        // The failed account itself is not "other", so with just one account
        // there is nothing to switch to.
        await runtime.handleSessionInvalid(1);

        expect(router.push).toHaveBeenCalledWith('/reauth/1');
        expect(useSessionExpiryStore.getState().returnTo).toBe('/courses');
    });

    it('goes to login when no account is known', async () => {
        const { runtime, router } = createTestRuntime();

        await runtime.handleSessionInvalid(null);

        expect(router.push).toHaveBeenCalledWith('/login');
    });

    it('does nothing while already on the login or reauth screens', async () => {
        const { runtime, router } = createTestRuntime({
            accounts: [account(2)],
        });
        useSessionExpiryStore.getState().setCurrentPath('/reauth/1');

        await runtime.handleSessionInvalid(1);

        expect(router.push).not.toHaveBeenCalled();
        expect(useSessionExpiryStore.getState().pickerOpen).toBe(false);
    });

    it('is triggered by a SessionInvalidError from run, once for concurrent failures', async () => {
        const { runtime } = createTestRuntime({
            accounts: [account(2)],
        });
        const fail = () =>
            runtime
                .run('courses.list', () => {
                    throw new SessionInvalidError(1);
                })
                .catch(() => undefined);

        await Promise.all([fail(), fail()]);
        await new Promise((resolve) => setTimeout(resolve, 0));

        expect(useSessionExpiryStore.getState().pickerOpen).toBe(true);
    });
});

describe('launch', () => {
    it.each([
        [false, [], '/onboarding'],
        [true, [], '/login'],
        [true, [account(1, { isActive: true })], '/courses'],
    ])(
        'onboardingCompleted=%s with %j accounts starts at %s',
        async (onboardingCompleted, accounts, expected) => {
            const { runtime, state } = createTestRuntime({ accounts });
            state.preferences = { ...state.preferences, onboardingCompleted };

            await expect(runtime.loadInitialState()).resolves.toBe(expected);
            expect(useBootstrapStore.getState()).toMatchObject({
                ready: true,
                initialRoute: expected,
            });
            expect(
                useClientConfigStore.getState().preferences.onboardingCompleted,
            ).toBe(onboardingCompleted);
        },
    );

    it('marks the session authenticated and loads the profile after a good bootstrap', async () => {
        const { runtime } = createTestRuntime({ accounts: [account(1)] });

        await runtime.runLaunchTasks();

        expect(useClientConfigStore.getState().sessionStatus).toBe(
            'authenticated',
        );
        expect(useClientConfigStore.getState().profile?.displayName).toBe(
            'User',
        );
    });

    it('starts the re-login flow for the active account when bootstrap fails', async () => {
        const { runtime, router } = createTestRuntime({
            accounts: [account(1)],
            activeAccountId: 1,
            bootstrap: async () => ({ authenticated: false }),
        });

        await runtime.runLaunchTasks();

        expect(useClientConfigStore.getState().sessionStatus).toBe(
            'unauthenticated',
        );
        expect(router.push).toHaveBeenCalledWith('/reauth/1');
    });

    it('stays quiet without accounts', async () => {
        const { runtime, router } = createTestRuntime();

        await runtime.runLaunchTasks();

        expect(router.push).not.toHaveBeenCalled();
        expect(useClientConfigStore.getState().sessionStatus).toBe(
            'unauthenticated',
        );
    });
});

describe('preferences', () => {
    it('persists then mirrors an update into the client store', async () => {
        const { runtime, state } = createTestRuntime();

        await runtime.updatePreferences({ appearance: 'dark' });

        expect(state.preferences.appearance).toBe('dark');
        expect(useClientConfigStore.getState().preferences.appearance).toBe(
            'dark',
        );
    });
});
