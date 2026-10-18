import {
  ActivityIndicator,
  Pressable,
  type PressableProps,
} from 'react-native';

import { Text } from './Text';

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';

export interface ButtonProps extends Omit<PressableProps, 'children'> {
  label: string;
  variant?: ButtonVariant;
  loading?: boolean;
  className?: string;
}

const containerStyles: Record<ButtonVariant, string> = {
  primary: 'bg-theme-700 active:bg-theme-800 dark:bg-theme-800',
  secondary:
    'border border-theme-300 bg-white active:bg-theme-50 dark:border-zinc-600 dark:bg-zinc-800',
  danger: 'bg-rose-600 active:bg-rose-700 dark:bg-rose-700',
  ghost: 'active:bg-theme-50 dark:active:bg-zinc-800',
};

const labelStyles: Record<ButtonVariant, string> = {
  primary: 'text-white',
  secondary: 'text-theme-700 dark:text-zinc-200',
  danger: 'text-white',
  ghost: 'text-theme-700 dark:text-theme-400',
};

/** Rounded text button; the shared look of dialog and form actions. */
export function Button({
  label,
  variant = 'primary',
  loading = false,
  disabled,
  className,
  ...props
}: ButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled || loading}
      className={`min-h-10 flex-row items-center justify-center gap-2 rounded-xl px-4 py-2 ${containerStyles[variant]} ${disabled || loading ? 'opacity-50' : ''} ${className ?? ''}`}
      {...props}
    >
      {loading ? <ActivityIndicator size="small" color="#9ca3af" /> : null}
      <Text className={`text-sm font-semibold ${labelStyles[variant]}`}>
        {label}
      </Text>
    </Pressable>
  );
}
