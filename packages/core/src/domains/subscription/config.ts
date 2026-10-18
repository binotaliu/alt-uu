/** Port of legacy `config('services.iap')`. */
export interface SubscriptionConfig {
  baseUrl: string;
  /** Seconds. */
  timeoutSeconds: number;
  /**
   * Google Play product IDs must start with a digit or lowercase letter, so
   * Android cannot reuse the App Store Connect IDs.
   */
  productIds: { ios: string[]; android: string[] };
}

export const defaultSubscriptionConfig: SubscriptionConfig = {
  baseUrl: 'https://alt-uu.binota.org',
  timeoutSeconds: 10,
  productIds: {
    ios: ['ALT_UU_PLUS.MONTHLY', 'ALT_UU_PLUS.YEARLY'],
    android: ['alt_uu_plus.monthly', 'alt_uu_plus.yearly'],
  },
};
