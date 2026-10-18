import { PremiumRequiredError } from '@altuu/core';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';

import { useClientConfigStore } from '../../services/stores';
import { account, resetStores } from '../../testing/fakeServices';
import { renderScreen, withServices } from '../testing';
import { ThemeSettings } from './ThemeSettings';

beforeEach(() => {
    resetStores();
    (router.push as jest.Mock).mockClear();
});

function setup({
    subscribed,
    accounts = [account(1, { isActive: true })],
    updateRejects = false,
}: {
    subscribed: boolean;
    accounts?: ReturnType<typeof account>[];
    updateRejects?: boolean;
}) {
    const entitlement = {
        active: subscribed,
        productId: null,
        expiresAt: null,
        platform: null,
    };
    const fake = withServices({
        account: { list: async () => accounts },
        subscription: {
            getCachedEntitlement: async () => entitlement,
            getEntitlementStatus: async () => entitlement,
        },
    });
    const update = jest.fn(async (input: object) => {
        if (updateRejects) {
            throw new PremiumRequiredError();
        }

        return { ...fake.state.preferences, ...input };
    });
    (fake.services.appPreference as unknown as { update: jest.Mock }).update =
        update;

    return { services: fake.services, update };
}

describe('ThemeSettings', () => {
    it('saves the appearance choice', async () => {
        const { services, update } = setup({ subscribed: false });
        await renderScreen(<ThemeSettings />, services);

        await fireEvent.press(screen.getByTestId('appearance-dark'));

        await waitFor(() =>
            expect(update).toHaveBeenCalledWith({ appearance: 'dark' }),
        );
    });

    it('sends non-subscribers to the subscription page for a paid accent', async () => {
        const { services, update } = setup({ subscribed: false });
        await renderScreen(<ThemeSettings />, services);
        await screen.findByText('Alt UU+');

        await fireEvent.press(screen.getByTestId('accent-ocean'));

        expect(router.push).toHaveBeenCalledWith(
            '/courses/account/subscription',
        );
        expect(update).not.toHaveBeenCalled();
    });

    it('applies a paid accent for subscribers', async () => {
        const { services, update } = setup({ subscribed: true });
        await renderScreen(<ThemeSettings />, services);
        await waitFor(() => expect(screen.queryByText('Alt UU+')).toBeNull());

        await fireEvent.press(screen.getByTestId('accent-forest'));

        await waitFor(() =>
            expect(update).toHaveBeenCalledWith({ accentColor: 'forest' }),
        );
        expect(router.push).not.toHaveBeenCalled();
    });

    it('lets everybody go back to the default accent', async () => {
        const { services, update } = setup({ subscribed: false });
        useClientConfigStore.getState().applyPreferences({
            ...useClientConfigStore.getState().preferences,
            accentColor: 'ocean',
        });
        await renderScreen(<ThemeSettings />, services);

        await fireEvent.press(screen.getByTestId('accent-warm'));

        await waitFor(() =>
            expect(update).toHaveBeenCalledWith({ accentColor: 'warm' }),
        );
    });

    it('explains that an account is needed before logging in', async () => {
        const { services, update } = setup({ subscribed: false, accounts: [] });
        await renderScreen(<ThemeSettings />, services);

        await fireEvent.press(screen.getByTestId('accent-red'));

        expect(
            await screen.findByText('登入並訂閱 Alt UU+ 後即可更換主題色。'),
        ).toBeTruthy();
        expect(update).not.toHaveBeenCalled();
    });

    it('goes to the subscription page when the backend rejects the accent', async () => {
        const { services } = setup({ subscribed: true, updateRejects: true });
        await renderScreen(<ThemeSettings />, services);
        await waitFor(() => expect(screen.queryByText('Alt UU+')).toBeNull());

        await fireEvent.press(screen.getByTestId('accent-pink'));

        await waitFor(() =>
            expect(router.push).toHaveBeenCalledWith(
                '/courses/account/subscription',
            ),
        );
    });

    it('hides the accents when Alt UU+ is turned off', async () => {
        const { services } = setup({ subscribed: true });
        useClientConfigStore.getState().applyPreferences({
            ...useClientConfigStore.getState().preferences,
            altUuPlusDisabled: true,
        });
        await renderScreen(<ThemeSettings />, services);

        expect(screen.queryByTestId('accent-ocean')).toBeNull();
        expect(screen.getByTestId('appearance-light')).toBeTruthy();
    });
});
