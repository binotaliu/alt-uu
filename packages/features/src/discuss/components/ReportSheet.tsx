import type { ReportType } from '@altuu/core';
import { Button, Sheet, Text } from '@altuu/ui';
import { Pressable, ScrollView, View } from 'react-native';

import { REPORT_REASONS } from '../moderation';

export interface ReportSheetProps {
  visible: boolean;
  reportType: ReportType | null;
  isSubmitting: boolean;
  /** `null` until a submission finished. */
  reportSuccess: boolean | null;
  onChangeType: (type: ReportType) => void;
  onClose: () => void;
  onSubmit: () => void;
}

/** Legacy ReportModal: reason radio list, disclosure text and result banners. */
export function ReportSheet({
  visible,
  reportType,
  isSubmitting,
  reportSuccess,
  onChangeType,
  onClose,
  onSubmit,
}: ReportSheetProps) {
  return (
    <Sheet visible={visible} onClose={onClose} placement="center">
      <View className="border-b border-theme-200 px-5 py-4 dark:border-zinc-700">
        <Text className="text-lg font-semibold text-theme-900 dark:text-zinc-100">
          檢舉此內容
        </Text>
      </View>

      <ScrollView className="max-h-96" contentContainerClassName="px-5 py-4">
        <Text className="mb-3 text-sm text-theme-700 dark:text-zinc-400">
          請選擇檢舉原因：
        </Text>

        <View className="gap-2" accessibilityRole="radiogroup">
          {REPORT_REASONS.map((reason) => {
            const selected = reportType === reason.value;

            return (
              <Pressable
                key={reason.value}
                accessibilityRole="radio"
                accessibilityState={{ checked: selected }}
                onPress={() => onChangeType(reason.value)}
                className={`flex-row items-center gap-2 rounded-lg border px-3 py-2 ${
                  selected
                    ? 'border-theme-700 bg-theme-50 dark:border-theme-500 dark:bg-theme-900'
                    : 'border-theme-200 dark:border-zinc-700'
                }`}
              >
                <View
                  className={`size-4 items-center justify-center rounded-full border ${
                    selected
                      ? 'border-theme-700 dark:border-theme-500'
                      : 'border-theme-300 dark:border-zinc-500'
                  }`}
                >
                  {selected ? (
                    <View className="size-2 rounded-full bg-theme-700 dark:bg-theme-500" />
                  ) : null}
                </View>
                <Text
                  className={`text-sm ${
                    selected
                      ? 'text-theme-900 dark:text-zinc-100'
                      : 'text-theme-700 dark:text-zinc-300'
                  }`}
                >
                  {reason.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Text className="mt-3 rounded-lg border border-dashed border-theme-300 bg-theme-50 p-3 text-sm text-theme-700 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
          本檢舉功能由 Alt UU 提供：你的檢舉內容將傳送給 Alt UU
          而非校方，包含去識別化的裝置資訊與討論板資訊，以及所檢舉的文字內容。一般來說，檢舉的內容將會在
          24 小時內被處理。
        </Text>

        {reportSuccess === true ? (
          <Text
            accessibilityRole="alert"
            className="mt-3 rounded-lg bg-emerald-50 p-2 text-sm text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
          >
            檢舉已送出，感謝你的回報。
          </Text>
        ) : null}
        {reportSuccess === false ? (
          <Text
            accessibilityRole="alert"
            className="mt-3 rounded-lg bg-rose-50 p-2 text-sm text-rose-700 dark:bg-rose-950 dark:text-rose-300"
          >
            檢舉送出失敗，請稍後再試。
          </Text>
        ) : null}
      </ScrollView>

      <View className="flex-row justify-end gap-2 border-t border-theme-200 px-5 py-4 dark:border-zinc-700">
        <Button label="取消" variant="secondary" onPress={onClose} />
        <Button
          label={isSubmitting ? '送出中…' : '送出檢舉'}
          disabled={reportType === null || isSubmitting}
          onPress={onSubmit}
        />
      </View>
    </Sheet>
  );
}
