import type { DataImportResult } from '@altuu/core';
import { Sheet, Text } from '@altuu/ui';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { useServiceMutation } from '../../services/useServiceQuery';
import { SubPage } from '../components/SubPage';
import {
  Card,
  CardDescription,
  CardTitle,
  ErrorText,
  FlashBanner,
  OutlineButton,
  PremiumBadge,
  Sparkles,
  useFlash,
} from '../components/primitives';
import { useSubscriptionStatus } from '../hooks/useSubscriptionStatus';
import { pickJsonFileText, saveTextFile } from '../lib/files';

/** Legacy Account/DataExport.vue. */
export function DataExportScreen() {
  const subscription = useSubscriptionStatus();
  const { flash, show } = useFlash();
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<DataImportResult | null>(
    null,
  );

  const exportData = useServiceMutation<boolean>({
    op: 'dataExport.export',
    mutationFn: async (_variables, services) => {
      const { fileName, contents } =
        await services.dataPortability.exportFile();

      return saveTextFile(fileName, contents, 'application/json');
    },
  });

  const importData = useServiceMutation<DataImportResult | null>({
    op: 'dataExport.import',
    mutationFn: async (_variables, services) => {
      const text = await pickJsonFileText();

      return text === null ? null : services.dataPortability.importFile(text);
    },
  });

  const onExport = async () => {
    if (exportData.isPending) {
      return;
    }

    setExportError(null);

    try {
      const saved = await exportData.mutateAsync();

      if (saved) {
        show('已匯出資料');
      }
    } catch (error) {
      setExportError(
        error instanceof Error ? error.message : '匯出失敗，請稍後再試。',
      );
    }
  };

  const onImport = async () => {
    if (importData.isPending) {
      return;
    }

    if (!subscription.active) {
      setShowUpgrade(true);

      return;
    }

    setImportError(null);
    setImportResult(null);

    try {
      const result = await importData.mutateAsync();

      if (result !== null) {
        setImportResult(result);
        show('已匯入資料');
      }
    } catch (error) {
      setImportError(
        error instanceof Error
          ? error.message
          : '匯入失敗，請確認檔案格式是否正確。',
      );
    }
  };

  const goToSubscription = () => {
    setShowUpgrade(false);
    router.push('/courses/account/subscription');
  };

  return (
    <SubPage title="資料匯出入" backHref="/courses/account">
      <FlashBanner flash={flash} />

      <Card>
        <CardTitle>匯出資料</CardTitle>
        <CardDescription>
          將裝置上所有帳號的學習紀錄（播放進度與每日學習活動）匯出為 JSON
          檔案，方便備份或轉移到其他裝置。
        </CardDescription>
        <View className="mt-3">
          <OutlineButton
            icon="arrow-down-tray"
            label={exportData.isPending ? '匯出中…' : '匯出為 JSON 檔案'}
            disabled={exportData.isPending}
            onPress={() => void onExport()}
          />
        </View>
        {exportError ? (
          <View className="mt-3">
            <ErrorText>{exportError}</ErrorText>
          </View>
        ) : null}
      </Card>

      <Card>
        <View className="flex-row items-center gap-1.5">
          <CardTitle>匯入資料</CardTitle>
          {subscription.active ? null : <PremiumBadge />}
        </View>
        <CardDescription>
          選擇先前匯出的 JSON
          檔案以還原學習紀錄。只有使用者名稱與本裝置帳號相符的資料才會被匯入。
        </CardDescription>
        <View className="mt-3">
          <OutlineButton
            icon="arrow-up-tray"
            label={importData.isPending ? '匯入中…' : '選擇檔案匯入'}
            disabled={importData.isPending}
            onPress={() => void onImport()}
          />
        </View>
        {importError ? (
          <View className="mt-3">
            <ErrorText>{importError}</ErrorText>
          </View>
        ) : null}
        {importResult ? (
          <View className="mt-3 gap-1">
            <Text className="text-xs text-emerald-700 dark:text-emerald-300">
              {`已匯入 ${importResult.importedAccountsCount} 個帳號的資料，共 ${importResult.importedPlaybackProgressCount} 筆播放進度、${importResult.importedAccountDailyActivitiesCount} 筆每日學習活動。`}
            </Text>
            {importResult.skippedUsernames.length > 0 ? (
              <Text className="text-xs text-emerald-700 dark:text-emerald-300">
                {`以下使用者名稱在本裝置找不到對應帳號，已略過：${importResult.skippedUsernames.join('、')}`}
              </Text>
            ) : null}
          </View>
        ) : null}
      </Card>

      {subscription.active ? null : (
        <View className="overflow-hidden rounded-xl bg-orange-500 p-4 dark:bg-orange-700">
          <Text className="text-sm font-medium text-white">
            {'想要匯入學習紀錄嗎？\n訂閱 Alt UU+ 即可解鎖此功能與更多內容。'}
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={goToSubscription}
            className="mt-3 flex-row items-center gap-1.5 self-start rounded-lg bg-white/95 px-3 py-1.5"
          >
            <Sparkles size={14} className="text-amber-700" />
            <Text className="text-xs font-semibold text-amber-700">
              訂閱 Alt UU+
            </Text>
          </Pressable>
        </View>
      )}

      <Sheet
        visible={showUpgrade}
        onClose={() => setShowUpgrade(false)}
        placement="center"
      >
        <View className="items-center gap-2 px-5 py-6">
          <Sparkles />
          <Text className="text-sm font-semibold text-theme-900 dark:text-zinc-100">
            資料匯入為 Alt UU+ 專屬功能
          </Text>
          <Text className="text-center text-xs text-theme-700 dark:text-zinc-400">
            升級為 Alt UU+ 即可啟用匯入學習紀錄。
          </Text>
        </View>
        <View className="flex-row justify-end gap-2 border-t border-theme-200 px-5 py-4 dark:border-zinc-700">
          <Pressable
            accessibilityRole="button"
            onPress={() => setShowUpgrade(false)}
            className="rounded-xl border border-theme-300 bg-white px-4 py-2 dark:border-zinc-600 dark:bg-zinc-800"
          >
            <Text className="text-sm font-semibold text-theme-700 dark:text-zinc-200">
              關閉
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={goToSubscription}
            className="rounded-xl bg-theme-700 px-4 py-2 dark:bg-theme-800"
          >
            <Text className="text-sm font-semibold text-white">升級</Text>
          </Pressable>
        </View>
      </Sheet>
    </SubPage>
  );
}
