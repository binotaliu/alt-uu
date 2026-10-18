import type {
  StoreBilling,
  StoreEntitlement,
  StoreProduct,
  StorePurchaseResult,
} from './types';

const catalog: Record<string, Omit<StoreProduct, 'id'>> = {
  monthly: {
    displayName: '月訂閱',
    description: '享有一個月的 Alt UU+ 服務',
    displayPrice: 'NT$90',
    price: 90,
  },
  yearly: {
    displayName: '年訂閱',
    description: '享有一整年的 Alt UU+ 服務',
    displayPrice: 'NT$560',
    price: 560,
  },
};

/**
 * Port of legacy LocalAltUUPlus: the dev stand-in used when there is no store
 * (simulator without StoreKit config, tests). Lists plausible products;
 * purchasing and restoring do nothing, like the legacy no-op bridge.
 */
export class LocalStoreBilling implements StoreBilling {
  readonly platform = null;

  async fetchProducts(productIds: string[]): Promise<StoreProduct[]> {
    return productIds.map((id) => {
      const plan = id.toLowerCase().endsWith('yearly')
        ? catalog.yearly
        : id.toLowerCase().endsWith('monthly')
          ? catalog.monthly
          : {
              displayName: id,
              description: '本機開發用模擬方案',
              displayPrice: 'NT$0',
              price: 0,
            };

      return { id, ...plan };
    });
  }

  async purchase(): Promise<StorePurchaseResult> {
    return { status: 'unknown' };
  }

  async restore(): Promise<StoreEntitlement[]> {
    return [];
  }

  async currentEntitlements(): Promise<StoreEntitlement[]> {
    return [];
  }
}
