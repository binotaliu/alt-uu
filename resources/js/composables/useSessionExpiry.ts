import router from '@/router';
import { useAccountsStore } from '@/stores/accounts';
import { useSessionExpiryStore } from '@/stores/sessionExpiry';

let isHandling = false;

/**
 * Central entry point for "the active account's Hungu session is dead"
 * (a 401 from apiFetch, or a failed app-boot validation). Replaces the old
 * blanket redirect to /login: offers an account picker when other valid
 * profiles exist, otherwise sends the user to a re-login screen scoped to
 * the one account that failed.
 */
export async function handleSessionInvalid(
    failedAccountId: number | null,
): Promise<void> {
    if (isHandling) {
        return;
    }

    // Set before the first await so a second call arriving while this one
    // is still resolving router.isReady()/loadAccounts() can't slip past
    // the guard above.
    isHandling = true;

    try {
        // Background api calls can 401 before Vue Router's initial
        // navigation settles, in which case router.currentRoute is still
        // its placeholder START_LOCATION ('/') rather than the page
        // actually being viewed.
        await router.isReady();

        const currentName = router.currentRoute.value.name as
            | string
            | undefined;

        if (currentName === 'login' || currentName === 'reauth') {
            return;
        }

        const accountsStore = useAccountsStore();

        // A failed remembered-login soft-deletes the account server-side
        // before the response is even sent, so a concurrent request's own
        // middleware check can report a null accountId even though the
        // account is known. Fall back to whichever account this already-
        // loaded list last saw as active (populated at app boot, before any
        // of this could have happened) rather than treating null as "no
        // accounts at all".
        const resolvedAccountId =
            failedAccountId ??
            accountsStore.accounts.find((account) => account.isActive)?.id ??
            null;

        await accountsStore.loadAccounts(true);

        const others = accountsStore.accounts.filter(
            (account) => account.id !== resolvedAccountId,
        );

        if (others.length === 0 && resolvedAccountId === null) {
            router.push({ name: 'login' });

            return;
        }

        const expiry = useSessionExpiryStore();

        if (others.length > 0) {
            expiry.openPicker(resolvedAccountId);

            return;
        }

        expiry.returnTo = router.currentRoute.value.fullPath;
        router.push({
            name: 'reauth',
            params: { accountId: String(resolvedAccountId) },
        });
    } finally {
        isHandling = false;
    }
}
