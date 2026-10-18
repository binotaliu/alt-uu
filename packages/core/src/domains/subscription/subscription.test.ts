import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createTestContext, type TestContext } from '../../../test/db/helpers';
import { createFakeFetch } from '../../http/testing';
import { LocalStoreBilling } from './localStoreBilling';
import { ENTITLEMENT_KEY } from './entitlementStore';
import { createSubscriptionServices } from './createSubscriptionServices';
import type {
  StoreBilling,
  StoreEntitlement,
  StorePlatform,
  StoreProduct,
  StorePurchaseResult,
} from './types';

class FakeBilling implements StoreBilling {
  fetchedIds: string[][] = [];
  purchases: string[] = [];
  purchaseResult: StorePurchaseResult = { status: 'cancelled' };
  entitlements: StoreEntitlement[] = [];
  products: StoreProduct[] = [];

  constructor(readonly platform: StorePlatform | null = 'ios') {}

  async fetchProducts(productIds: string[]): Promise<StoreProduct[]> {
    this.fetchedIds.push(productIds);

    return this.products;
  }

  async purchase(productId: string): Promise<StorePurchaseResult> {
    this.purchases.push(productId);

    return this.purchaseResult;
  }

  async restore(): Promise<StoreEntitlement[]> {
    return this.entitlements;
  }

  async currentEntitlements(): Promise<StoreEntitlement[]> {
    return this.entitlements;
  }
}

const IAP = 'https://alt-uu.binota.org';
const reference = {
  transaction_id: 'original-txn-1',
  product_id: 'alt_uu_premium_monthly',
};

let context: TestContext;

function setup(
  options: {
    billing?: StoreBilling;
    routes?: Parameters<typeof createFakeFetch>[0];
  } = {},
) {
  const fake = createFakeFetch(options.routes ?? []);
  const resetPaidPreferences = vi.fn(async () => undefined);
  const billing = options.billing ?? new FakeBilling();
  const services = createSubscriptionServices({
    billing,
    fetch: fake.fetch,
    keyValues: context.keyValues,
    clock: context.clock,
    resetPaidPreferences,
  });

  return { services, fake, resetPaidPreferences, billing };
}

async function seedEntitlement(overrides: Record<string, unknown> = {}) {
  await context.keyValues.set(
    ENTITLEMENT_KEY,
    JSON.stringify({
      active: true,
      productId: 'alt_uu_premium_monthly',
      expiresAt: '2026-11-01T00:00:00+00:00',
      platform: 'ios',
      reference,
      checkedAt: '2026-06-01T00:00:00+00:00',
      ...overrides,
    }),
  );
}

beforeEach(async () => {
  context = await createTestContext();
});

describe('fetchAvailableProducts', () => {
  it('lists the products the store reports', async () => {
    const billing = new FakeBilling();
    billing.products = [
      {
        id: 'alt_uu_premium_monthly',
        displayName: 'Alt UU Premium',
        description: 'Cross-device sync',
        displayPrice: 'NT$90',
        price: 90,
      },
    ];
    const { services } = setup({ billing });

    expect(await services.fetchAvailableProducts()).toEqual(billing.products);
  });

  it('uses the lowercase Play Console ids on Android', async () => {
    const billing = new FakeBilling('android');
    const { services } = setup({ billing });

    await services.fetchAvailableProducts();

    expect(billing.fetchedIds).toEqual([
      ['alt_uu_plus.monthly', 'alt_uu_plus.yearly'],
    ]);
  });

  it('uses the uppercase App Store Connect ids on iOS', async () => {
    const billing = new FakeBilling('ios');
    const { services } = setup({ billing });

    await services.fetchAvailableProducts();

    expect(billing.fetchedIds).toEqual([
      ['ALT_UU_PLUS.MONTHLY', 'ALT_UU_PLUS.YEARLY'],
    ]);
  });

  it('falls back to the iOS ids with the local dev billing', async () => {
    const { services } = setup({ billing: new LocalStoreBilling() });

    expect(await services.fetchAvailableProducts()).toEqual([
      {
        id: 'ALT_UU_PLUS.MONTHLY',
        displayName: '月訂閱',
        description: '享有一個月的 Alt UU+ 服務',
        displayPrice: 'NT$90',
        price: 90,
      },
      {
        id: 'ALT_UU_PLUS.YEARLY',
        displayName: '年訂閱',
        description: '享有一整年的 Alt UU+ 服務',
        displayPrice: 'NT$560',
        price: 560,
      },
    ]);
  });
});

describe('getEntitlementStatus', () => {
  it('refreshes and caches from the backend using the cached purchase reference', async () => {
    await seedEntitlement();
    const { services, fake } = setup({
      routes: [
        [
          `${IAP}/api/iap/entitlement*`,
          {
            body: {
              active: true,
              product_id: 'alt_uu_premium_monthly',
              expires_at: '2026-12-01T00:00:00+00:00',
              platform: 'ios',
            },
          },
        ],
      ],
    });

    expect(await services.getEntitlementStatus()).toEqual({
      active: true,
      productId: 'alt_uu_premium_monthly',
      expiresAt: '2026-12-01T00:00:00+00:00',
      platform: 'ios',
    });

    const url = new URL(fake.requests[0].url);

    expect(url.origin + url.pathname).toBe(`${IAP}/api/iap/entitlement`);
    expect(Object.fromEntries(url.searchParams)).toEqual({
      platform: 'ios',
      transaction_id: 'original-txn-1',
      product_id: 'alt_uu_premium_monthly',
    });
    expect((await services.store.get())?.expiresAt).toBe(
      '2026-12-01T00:00:00+00:00',
    );
  });

  it.each([
    ['an upstream 500', { status: 500 }],
    ['a connection failure', new Error('offline')],
  ])('falls back to the cached entitlement on %s', async (_name, reply) => {
    await seedEntitlement({ expiresAt: '2026-11-01T00:00:00+00:00' });
    const { services } = setup({
      routes: [[`${IAP}/api/iap/entitlement*`, reply]],
    });

    expect(await services.getEntitlementStatus()).toMatchObject({
      active: true,
      productId: 'alt_uu_premium_monthly',
    });
  });

  it('marks the cache inactive only when the backend says so', async () => {
    await seedEntitlement();
    const { services } = setup({
      routes: [
        [
          `${IAP}/api/iap/entitlement*`,
          { body: { active: false, platform: 'ios' } },
        ],
      ],
    });

    expect(await services.getEntitlementStatus()).toMatchObject({
      active: false,
    });
    expect(await services.getEntitlementStatus()).toMatchObject({
      active: false,
    });
  });

  it('resets the accent color when the backend reports the subscription inactive', async () => {
    await seedEntitlement();
    const { services, resetPaidPreferences } = setup({
      routes: [
        [
          `${IAP}/api/iap/entitlement*`,
          { body: { active: false, platform: 'ios' } },
        ],
      ],
    });

    await services.getEntitlementStatus();

    expect(resetPaidPreferences).toHaveBeenCalledOnce();
  });

  it('keeps the accent color when the backend cannot be reached', async () => {
    await seedEntitlement();
    const { services, resetPaidPreferences } = setup({
      routes: [[`${IAP}/api/iap/entitlement*`, new Error('offline')]],
    });

    expect(await services.getEntitlementStatus()).toMatchObject({
      active: true,
    });
    expect(resetPaidPreferences).not.toHaveBeenCalled();
  });

  it('keeps the accent color when the backend reports it active', async () => {
    await seedEntitlement();
    const { services, resetPaidPreferences } = setup({
      routes: [
        [
          `${IAP}/api/iap/entitlement*`,
          { body: { active: true, platform: 'ios' } },
        ],
      ],
    });

    expect(await services.getEntitlementStatus()).toMatchObject({
      active: true,
    });
    expect(resetPaidPreferences).not.toHaveBeenCalled();
  });

  it('returns inactive without contacting the backend when there is no cached reference', async () => {
    const { services, fake } = setup();

    expect(await services.getEntitlementStatus()).toEqual({
      active: false,
      productId: null,
      expiresAt: null,
      platform: null,
    });
    expect(fake.requests).toHaveLength(0);
  });
});

describe('getCachedEntitlement', () => {
  it('returns the cached entitlement without contacting the backend', async () => {
    await seedEntitlement({
      reference: { transaction_id: 'original-txn-1' },
    });
    const { services, fake } = setup();

    expect(await services.getCachedEntitlement()).toMatchObject({
      active: true,
      productId: 'alt_uu_premium_monthly',
    });
    expect(fake.requests).toHaveLength(0);
  });

  it('returns inactive when nothing is stored', async () => {
    const { services } = setup();

    expect(await services.getCachedEntitlement()).toMatchObject({
      active: false,
    });
  });

  it('reports a cached active entitlement as inactive once its expiry has passed', async () => {
    await seedEntitlement({
      platform: 'android',
      expiresAt: new Date(context.clock.now().getTime() - 60_000).toISOString(),
    });
    const { services } = setup();

    expect(await services.getCachedEntitlement()).toMatchObject({
      active: false,
      platform: 'android',
    });
  });

  it('ignores a corrupt cache row', async () => {
    await context.keyValues.set(ENTITLEMENT_KEY, '{nope');
    const { services } = setup();

    expect(await services.getCachedEntitlement()).toMatchObject({
      active: false,
    });
  });
});

describe('purchaseSubscription', () => {
  it('verifies and caches an iOS purchase', async () => {
    const billing = new FakeBilling('ios');
    billing.purchaseResult = {
      status: 'purchased',
      platform: 'ios',
      transactionId: 'txn-1',
      originalTransactionId: 'original-txn-1',
      productId: 'alt_uu_premium_monthly',
      jws: 'fake-jws',
    };
    const { services, fake } = setup({
      billing,
      routes: [
        [
          `${IAP}/api/iap/verify*`,
          {
            body: {
              active: true,
              product_id: 'alt_uu_premium_monthly',
              expires_at: '2026-11-01T00:00:00+00:00',
              platform: 'ios',
            },
          },
        ],
      ],
    });

    expect(
      await services.purchaseSubscription('alt_uu_premium_monthly'),
    ).toMatchObject({ active: true, productId: 'alt_uu_premium_monthly' });

    expect(fake.requests[0].method).toBe('POST');
    expect(fake.requests[0].url).toBe(`${IAP}/api/iap/verify`);
    expect(JSON.parse(fake.requests[0].body as string)).toEqual({
      platform: 'ios',
      transaction_id: 'original-txn-1',
      product_id: 'alt_uu_premium_monthly',
    });
    expect((await services.store.get())?.reference).toEqual(reference);
  });

  it('sends the purchase token for an Android purchase', async () => {
    const billing = new FakeBilling('android');
    billing.purchaseResult = {
      status: 'purchased',
      platform: 'android',
      productId: 'alt_uu_plus.yearly',
      purchaseToken: 'token-9',
      orderId: 'order-9',
    };
    const { services, fake } = setup({
      billing,
      routes: [
        [
          `${IAP}/api/iap/verify*`,
          { body: { active: true, platform: 'android' } },
        ],
      ],
    });

    await services.purchaseSubscription('alt_uu_plus.yearly');

    expect(JSON.parse(fake.requests[0].body as string)).toEqual({
      platform: 'android',
      purchase_token: 'token-9',
      product_id: 'alt_uu_plus.yearly',
    });
  });

  it.each(['cancelled', 'pending', 'unknown'] as const)(
    'does not contact the backend when the purchase is %s',
    async (status) => {
      const billing = new FakeBilling();
      billing.purchaseResult = { status };
      const { services, fake } = setup({ billing });

      expect(
        await services.purchaseSubscription('alt_uu_premium_monthly'),
      ).toMatchObject({ active: false });
      expect(fake.requests).toHaveLength(0);
    },
  );

  it('is inactive when the backend is unreachable after a purchase', async () => {
    const billing = new FakeBilling();
    billing.purchaseResult = {
      status: 'purchased',
      platform: 'ios',
      productId: 'p',
      originalTransactionId: 'o',
    };
    const { services } = setup({
      billing,
      routes: [[`${IAP}/api/iap/verify*`, new Error('offline')]],
    });

    expect(await services.purchaseSubscription('p')).toMatchObject({
      active: false,
    });
  });

  it('does nothing without a store', async () => {
    const { services } = setup({ billing: new LocalStoreBilling() });

    expect(await services.purchaseSubscription('x')).toMatchObject({
      active: false,
    });
  });

  it('validates the product id', async () => {
    const { services } = setup();

    await expect(services.purchaseSubscription('')).rejects.toMatchObject({
      status: 422,
    });
    await expect(
      services.purchaseSubscription('x'.repeat(192)),
    ).rejects.toMatchObject({ status: 422 });
  });
});

describe('restorePurchases', () => {
  it('verifies and caches a restored Android purchase', async () => {
    const billing = new FakeBilling('android');
    billing.entitlements = [
      {
        platform: 'android',
        productId: null,
        productIds: ['alt_uu_premium_monthly'],
        purchaseToken: 'token-1',
        orderId: 'order-1',
      },
    ];
    const { services, fake } = setup({
      billing,
      routes: [
        [
          `${IAP}/api/iap/verify*`,
          {
            body: {
              active: true,
              product_id: 'alt_uu_premium_monthly',
              expires_at: '2026-11-01T00:00:00+00:00',
              platform: 'android',
            },
          },
        ],
      ],
    });

    expect(await services.restorePurchases()).toMatchObject({
      active: true,
      platform: 'android',
    });
    expect(JSON.parse(fake.requests[0].body as string)).toMatchObject({
      purchase_token: 'token-1',
      product_id: 'alt_uu_premium_monthly',
    });
  });

  it('restores an iOS purchase by its original transaction id', async () => {
    const billing = new FakeBilling('ios');
    billing.entitlements = [
      {
        platform: 'ios',
        productId: 'ALT_UU_PLUS.YEARLY',
        transactionId: 'txn-2',
        originalTransactionId: 'orig-2',
        jws: 'jws',
      },
    ];
    const { services, fake } = setup({
      billing,
      routes: [[`${IAP}/api/iap/verify*`, { body: { active: true } }]],
    });

    await services.restorePurchases();

    expect(JSON.parse(fake.requests[0].body as string)).toEqual({
      platform: 'ios',
      transaction_id: 'orig-2',
      product_id: 'ALT_UU_PLUS.YEARLY',
    });
  });

  it('returns inactive when there is nothing to restore', async () => {
    const { services, fake } = setup();

    expect(await services.restorePurchases()).toMatchObject({
      active: false,
    });
    expect(fake.requests).toHaveLength(0);
  });
});
