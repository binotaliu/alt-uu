import { Button, Sheet, Text, Icon } from '@altuu/ui';
import * as Clipboard from 'expo-clipboard';
import { useEffect, useRef, useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';

type CopyState = 'idle' | 'copied' | 'failed';

export interface LiveSessionNicknameDialogProps {
  visible: boolean;
  nickname: string;
  url: string;
  email: string;
  onClose: () => void;
  onEnter: () => void;
}

/** 「設定顯示暱稱」: nickname (and optionally URL / e-mail) to copy before joining. */
export function LiveSessionNicknameDialog({
  visible,
  nickname,
  url,
  email,
  onClose,
  onEnter,
}: LiveSessionNicknameDialogProps) {
  const [showMoreInfo, setShowMoreInfo] = useState(false);
  const [copyStates, setCopyStates] = useState<Record<string, CopyState>>({});
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  useEffect(() => {
    const pending = timers.current;

    return () => {
      Object.values(pending).forEach(clearTimeout);
    };
  }, []);

  const copyField = async (key: string, value: string) => {
    let state: CopyState = 'copied';

    try {
      await Clipboard.setStringAsync(value);
    } catch {
      state = 'failed';
    }

    setCopyStates((current) => ({ ...current, [key]: state }));
    clearTimeout(timers.current[key]);
    timers.current[key] = setTimeout(
      () => setCopyStates((current) => ({ ...current, [key]: 'idle' })),
      2000,
    );
  };

  const fields = [
    { key: 'nickname', label: '顯示暱稱', value: nickname, visible: true },
    {
      key: 'url',
      label: '教室連結',
      value: url,
      visible: showMoreInfo && url !== '',
    },
    {
      key: 'email',
      label: '電子郵件',
      value: email,
      visible: showMoreInfo && email !== '',
    },
  ].filter((field) => field.visible);

  const hasCopyFailure = fields.some(
    (field) => copyStates[field.key] === 'failed',
  );

  return (
    <Sheet visible={visible} onClose={onClose} placement="center">
      <View className="px-5 py-4">
        <Text className="text-lg font-semibold text-theme-900 dark:text-zinc-100">
          設定顯示暱稱
        </Text>
        <Text className="mt-2 text-sm text-theme-700 dark:text-zinc-400">
          進入教室前，請將您的顯示暱稱設定為以下內容，方便老師與同學辨識身分。
        </Text>

        {fields.map((field) => (
          <View key={field.key} className="mt-3">
            <Text className="text-xs font-medium text-theme-700 dark:text-zinc-400">
              {field.label}
            </Text>
            <View className="mt-1 flex-row items-center gap-2">
              <TextInput
                accessibilityLabel={field.label}
                editable={false}
                selectTextOnFocus
                value={field.value}
                className="min-w-0 flex-1 rounded-lg border border-theme-300 bg-theme-50 px-3 py-2 text-sm text-theme-900 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
              />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`複製${field.label}`}
                onPress={() => void copyField(field.key, field.value)}
                className="shrink-0 flex-row items-center gap-1 rounded-lg border border-theme-300 px-3 py-2 active:bg-theme-50 dark:border-zinc-600 dark:active:bg-zinc-800"
              >
                <Icon
                  name={
                    copyStates[field.key] === 'copied'
                      ? 'check'
                      : 'clipboard-document'
                  }
                  size={16}
                  className="text-theme-700 dark:text-zinc-200"
                />
                <Text className="text-sm font-medium text-theme-700 dark:text-zinc-200">
                  {copyStates[field.key] === 'copied' ? '已複製' : '複製'}
                </Text>
              </Pressable>
            </View>
          </View>
        ))}

        {hasCopyFailure ? (
          <Text className="mt-2 text-xs text-rose-600 dark:text-rose-400">
            自動複製失敗，請手動選取並複製上方文字。
          </Text>
        ) : null}

        <Pressable
          accessibilityRole="button"
          accessibilityState={{ expanded: showMoreInfo }}
          onPress={() => setShowMoreInfo((current) => !current)}
          className="mt-3 self-start"
        >
          <Text className="text-sm font-medium text-theme-700 underline dark:text-zinc-300">
            {showMoreInfo ? '隱藏更多資訊' : '顯示更多資訊'}
          </Text>
        </Pressable>
      </View>

      <View className="flex-row justify-end gap-2 border-t border-theme-200 px-5 py-4 dark:border-zinc-700">
        <Button label="取消" variant="secondary" onPress={onClose} />
        <Button label="進入教室" onPress={onEnter} />
      </View>
    </Sheet>
  );
}
