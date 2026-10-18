import type { EntitlementViewModel, ProductViewModel } from '@altuu/core';
import { Text } from '@altuu/ui';
import { Alert, Platform, Pressable, View } from 'react-native';

import {
    useServiceMutation,
    useServiceQuery,
} from '../../services/useServiceQuery';
import { openExternalUrl } from '../../shell/openUrl';
import { AccountIcon } from '../components/AccountIcon';
import { SubPage } from '../components/SubPage';
import { Sparkles } from '../components/primitives';
import {
    formatExpiry,
    useSubscriptionStatus,
} from '../hooks/useSubscriptionStatus';

const PERKS = [
    '切換不同顏色主題',
    '檢視每日學習統計',
    '支持 Alt UU 的開發與維護',
] as const;

const MANAGE_SUBSCRIPTION_URL = {
    ios: 'itms-apps://apps.apple.com/account/subscriptions',
    android: 'https://play.google.com/store/account/subscriptions',
} as const;

/** Store copy shown under the plans (legacy `device-ios` / `device-android` spans). */
export function storeDisclosure(platform: string): string {
    const store = platform === 'ios' ? 'Apple App Store' : 'Google Play';

    return `訂閱費用將通過 ${store} 進行收取，並自動續訂，除非你在本次計費週期結束前至少 24 小時取消。\n若要管理你的訂閱項目，請前往 ${store} 的帳號設定。`;
}

/** Legacy Account/Subscription.vue. */
export function SubscriptionScreen() {
    const subscription = useSubscriptionStatus();
    const products = useServiceQuery<ProductViewModel[]>({
        op: 'subscription.products',
        queryKey: ['account', 'subscription', 'products'],
        queryFn: (services) => services.subscription.fetchAvailableProducts(),
    });
    const purchase = useServiceMutation<EntitlementViewModel, string>({
        op: 'subscription.purchase',
        mutationFn: (productId, services) =>
            services.subscription.purchaseSubscription(productId),
    });
    const restore = useServiceMutation<EntitlementViewModel>({
        op: 'subscription.restore',
        mutationFn: (_variables, services) =>
            services.subscription.restorePurchases(),
    });

    const entitlement = subscription.entitlement;
    const currentProductName = entitlement?.productId
        ? (products.data?.find((item) => item.id === entitlement.productId)
              ?.displayName ?? entitlement.productId)
        : null;

    const onPurchase = async (productId: string) => {
        try {
            await subscription.applyEntitlement(
                await purchase.mutateAsync(productId),
            );
        } catch {
            Alert.alert('購買失敗，請稍後重試');
        }
    };

    const onRestore = async () => {
        try {
            await subscription.applyEntitlement(await restore.mutateAsync());
        } catch {
            Alert.alert('還原購買失敗，請稍後重試');
        }
    };

    const manageSubscription = () =>
        openExternalUrl(
            Platform.OS === 'ios'
                ? MANAGE_SUBSCRIPTION_URL.ios
                : MANAGE_SUBSCRIPTION_URL.android,
        );

    return (
        <SubPage title="Alt UU+" backHref="/courses/account">
            <View className="overflow-hidden rounded-2xl border border-theme-200 bg-white shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
                <View className="bg-orange-500 px-5 py-6 dark:bg-orange-700">
                    <View className="flex-row items-center gap-2">
                        <View className="flex-row items-center gap-1 rounded-full bg-white/20 px-3 py-1">
                            <Sparkles size={14} className="text-white" />
                            <Text className="text-xs font-semibold text-white">
                                ALT UU+
                            </Text>
                        </View>
                        {subscription.active ? (
                            <View className="rounded-full bg-white/90 px-2.5 py-1">
                                <Text className="text-xs font-semibold text-amber-700">
                                    已訂閱
                                </Text>
                            </View>
                        ) : null}
                    </View>

                    <Text className="mt-3 text-xl font-bold text-white">
                        {subscription.active
                            ? '感謝你的支持！'
                            : '升級 Alt UU+'}
                    </Text>
                    <Text className="mt-1 text-sm text-white/90">
                        {subscription.active
                            ? '你已解鎖 Alt UU+ 的所有功能'
                            : '解鎖更多專屬功能'}
                    </Text>
                </View>

                <View className="p-5">
                    {!subscription.isLoaded ? (
                        <Text className="py-2 text-center text-sm text-theme-700 dark:text-zinc-400">
                            載入訂閱狀態中…
                        </Text>
                    ) : subscription.active ? (
                        <>
                            <View className="gap-2">
                                {currentProductName ? (
                                    <View className="flex-row items-center justify-between">
                                        <Text className="text-sm text-theme-700 dark:text-zinc-400">
                                            目前方案
                                        </Text>
                                        <Text className="text-sm font-medium text-theme-900 dark:text-zinc-100">
                                            {currentProductName}
                                        </Text>
                                    </View>
                                ) : null}
                                {entitlement?.expiresAt ? (
                                    <View className="flex-row items-center justify-between">
                                        <Text className="text-sm text-theme-700 dark:text-zinc-400">
                                            下次續訂日
                                        </Text>
                                        <Text className="text-sm font-medium text-theme-900 dark:text-zinc-100">
                                            {formatExpiry(
                                                entitlement.expiresAt,
                                            )}
                                        </Text>
                                    </View>
                                ) : null}
                            </View>

                            <Pressable
                                accessibilityRole="button"
                                onPress={() => void manageSubscription()}
                                className="mt-4 items-center rounded-xl border border-theme-300 bg-white px-4 py-2 active:bg-theme-50 dark:border-zinc-600 dark:bg-zinc-800"
                            >
                                <Text className="text-sm font-medium text-theme-700 dark:text-zinc-300">
                                    管理訂閱
                                </Text>
                            </Pressable>
                        </>
                    ) : (
                        <>
                            <View className="gap-2.5">
                                {PERKS.map((perk) => (
                                    <View
                                        key={perk}
                                        className="flex-row items-start gap-2"
                                    >
                                        <View className="mt-0.5">
                                            <AccountIcon
                                                name="check-circle"
                                                size={16}
                                                className="text-amber-600 dark:text-amber-400"
                                            />
                                        </View>
                                        <Text className="flex-1 text-sm text-theme-700 dark:text-zinc-300">
                                            {perk}
                                        </Text>
                                    </View>
                                ))}
                            </View>

                            {products.isPending ? (
                                <Text className="mt-4 text-center text-sm text-theme-700 dark:text-zinc-400">
                                    載入方案中…
                                </Text>
                            ) : products.error ? (
                                <Text className="mt-4 text-center text-sm text-rose-600 dark:text-rose-400">
                                    {products.error.message}
                                </Text>
                            ) : (
                                <View className="mt-4 gap-2">
                                    {(products.data ?? []).map((product) => (
                                        <Pressable
                                            key={product.id}
                                            accessibilityRole="button"
                                            accessibilityLabel={`訂閱 ${product.displayName}`}
                                            disabled={purchase.isPending}
                                            onPress={() =>
                                                void onPurchase(product.id)
                                            }
                                            className={`flex-row items-center justify-between rounded-xl border border-theme-200 p-3 active:bg-amber-50/50 dark:border-zinc-700 ${
                                                purchase.isPending
                                                    ? 'opacity-50'
                                                    : ''
                                            }`}
                                        >
                                            <View className="min-w-0 flex-1">
                                                <Text className="font-medium text-theme-900 dark:text-zinc-100">
                                                    {product.displayName}
                                                </Text>
                                                <Text className="text-xs text-theme-700 dark:text-zinc-400">
                                                    {product.description}
                                                </Text>
                                            </View>
                                            <View className="flex-row items-center gap-2">
                                                <Text className="font-semibold text-theme-900 dark:text-zinc-100">
                                                    {product.displayPrice}
                                                </Text>
                                                <View className="rounded-lg bg-amber-700 px-3 py-1.5">
                                                    <Text className="text-xs font-semibold text-white">
                                                        訂閱
                                                    </Text>
                                                </View>
                                            </View>
                                        </Pressable>
                                    ))}
                                </View>
                            )}

                            <Pressable
                                accessibilityRole="button"
                                disabled={restore.isPending}
                                onPress={() => void onRestore()}
                                className={`mt-3 items-center ${restore.isPending ? 'opacity-50' : ''}`}
                            >
                                <Text className="text-sm font-medium text-theme-700 underline dark:text-zinc-400">
                                    {restore.isPending
                                        ? '還原中…'
                                        : '已購買過？還原購買'}
                                </Text>
                            </Pressable>
                        </>
                    )}

                    <View className="mt-4 border-t border-theme-200 pt-3 dark:border-zinc-700">
                        <Text className="text-xs leading-relaxed text-theme-700 dark:text-zinc-400">
                            {
                                'Alt UU+ 是由 Alt UU 開發人員推出的訂閱服務，而非由學校提供。\n'
                            }
                            {storeDisclosure(Platform.OS)}
                        </Text>
                    </View>
                </View>
            </View>
        </SubPage>
    );
}
