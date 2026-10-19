import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';

import { Text } from './Text';

export interface ToggleSwitchProps {
  value: boolean;
  onValueChange: (value: boolean) => void;
  label: string;
  description?: string;
  /** Rendered after the label, e.g. a badge. */
  labelAccessory?: ReactNode;
  disabled?: boolean;
}

/** Legacy ToggleSwitch: label and description on the left, pill switch on the right. */
export function ToggleSwitch({
  value,
  onValueChange,
  label,
  description = '',
  labelAccessory,
  disabled = false,
}: ToggleSwitchProps) {
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityState={{ checked: value, disabled }}
      disabled={disabled}
      onPress={() => onValueChange(!value)}
      className={`flex-row items-center justify-between gap-3 py-2.5 ${disabled ? 'opacity-50' : ''}`}
    >
      <View className="flex-1">
        <View className="flex-row items-center gap-2">
          <Text className="text-sm font-medium text-theme-800 dark:text-zinc-100">
            {label}
          </Text>
          {labelAccessory}
        </View>
        {description ? (
          <Text className="text-xs text-theme-700 dark:text-zinc-300">
            {description}
          </Text>
        ) : null}
      </View>

      <View
        className={`h-8 w-16 shrink-0 justify-center rounded-full border ${
          value
            ? 'border-theme-700 bg-theme-200 dark:border-theme-500 dark:bg-theme-700'
            : 'border-theme-300 bg-white dark:border-theme-300 dark:bg-zinc-700'
        }`}
      >
        <View
          className={`h-5 w-5 rounded-full bg-theme-700 dark:bg-theme-500 ${
            value ? 'self-end' : 'self-start'
          }`}
          style={{ marginHorizontal: 4 }}
        />
      </View>
    </Pressable>
  );
}
