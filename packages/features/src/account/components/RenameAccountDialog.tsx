import { Button, Sheet, Text } from '@altuu/ui';
import { useState } from 'react';
import { TextInput, View } from 'react-native';

export interface RenameAccountDialogProps {
  isOpen: boolean;
  initialValue: string;
  processing?: boolean;
  error?: string;
  onConfirm: (value: string) => void;
  onCancel: () => void;
}

function RenameForm({
  initialValue,
  processing,
  error,
  onConfirm,
  onCancel,
}: Omit<RenameAccountDialogProps, 'isOpen'>) {
  const [value, setValue] = useState(initialValue);

  return (
    <>
      <View className="px-5 py-4">
        <Text className="text-lg font-semibold text-theme-900 dark:text-zinc-100">
          修改名稱
        </Text>
        <Text className="mt-2 text-sm text-theme-700 dark:text-zinc-400">
          設定這個帳號的自訂名稱，僅顯示在這個裝置上。
        </Text>

        <TextInput
          accessibilityLabel="自訂名稱"
          value={value}
          onChangeText={setValue}
          maxLength={30}
          placeholder="請輸入自訂名稱"
          placeholderTextColor="#9ca3af"
          returnKeyType="done"
          onSubmitEditing={() => onConfirm(value)}
          className="mt-3 rounded-lg border border-theme-300 bg-white px-3 py-2 text-sm text-theme-900 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
        />

        {error ? (
          <Text className="mt-2 text-xs text-rose-600 dark:text-rose-400">
            {error}
          </Text>
        ) : null}
      </View>
      <View className="flex-row justify-end gap-2 border-t border-theme-200 px-5 py-4 dark:border-zinc-700">
        <Button label="取消" variant="secondary" onPress={onCancel} />
        <Button
          label={processing ? '儲存中…' : '儲存'}
          disabled={processing}
          onPress={() => onConfirm(value)}
        />
      </View>
    </>
  );
}

/** Legacy RenameAccountDialog: nickname input (max 30 characters). */
export function RenameAccountDialog({
  isOpen,
  initialValue,
  processing = false,
  error = '',
  onConfirm,
  onCancel,
}: RenameAccountDialogProps) {
  return (
    <Sheet visible={isOpen} onClose={onCancel} placement="center">
      {isOpen ? (
        <RenameForm
          initialValue={initialValue}
          processing={processing}
          error={error}
          onConfirm={onConfirm}
          onCancel={onCancel}
        />
      ) : null}
    </Sheet>
  );
}
