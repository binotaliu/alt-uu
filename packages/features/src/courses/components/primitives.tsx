import { Text, cn, useCardColumns, useIsTablet } from '@altuu/ui';
import type { ReactNode } from 'react';
import { Pressable, View, type ViewProps } from 'react-native';

/** White bordered surface used by every list card. */
export function Card({ className, ...props }: ViewProps) {
  return (
    <View
      className={cn(
        'rounded-2xl border border-theme-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900',
        className,
      )}
      {...props}
    />
  );
}

/**
 * Equal-width card grid (legacy `grid sm:grid-cols-2 xl:grid-cols-3`). A
 * short last row keeps the column width.
 */
export function CardGrid({
  children,
  twoColumnsFrom,
}: {
  children: ReactNode[];
  /** Width where the second column starts (640 `sm`, 768 `md`). */
  twoColumnsFrom?: number;
}) {
  const columns = useCardColumns(twoColumnsFrom);
  const gap = useIsTablet() ? 'gap-5' : 'gap-3';
  const rows: ReactNode[][] = [];

  for (let index = 0; index < children.length; index += columns) {
    rows.push(children.slice(index, index + columns));
  }

  return (
    <View className={gap}>
      {rows.map((row, rowIndex) => (
        <View key={rowIndex} className={`flex-row ${gap}`}>
          {Array.from({ length: columns }, (_, column) => (
            <View key={column} className="min-w-0 flex-1">
              {row[column] ?? null}
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

/** Dashed empty-state box (legacy `border-dashed bg-theme-50` notice). */
export function EmptyNotice({
  children,
  centered = false,
}: {
  children: ReactNode;
  centered?: boolean;
}) {
  return (
    <View className="rounded-xl border border-dashed border-theme-300 bg-theme-50 p-4 dark:border-zinc-600 dark:bg-zinc-800">
      <Text
        className={`text-sm text-theme-700 dark:text-zinc-300 ${centered ? 'py-8 text-center' : ''}`}
      >
        {children}
      </Text>
    </View>
  );
}

/** Pulsing placeholder block. */
export function Skeleton({ className }: { className: string }) {
  return (
    <View
      className={`animate-pulse rounded bg-theme-200 dark:bg-zinc-700 ${className}`}
    />
  );
}

export interface SegmentedOption<T extends string | boolean> {
  value: T;
  label: string;
}

/** Two-or-more option switch (legacy account scope / timezone selector). */
export function SegmentedControl<T extends string | boolean>({
  options,
  value,
  onChange,
  disabled = false,
}: {
  options: readonly SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  disabled?: boolean;
}) {
  return (
    <View className="flex-row rounded-xl border border-theme-200 bg-theme-50 p-1 dark:border-zinc-700 dark:bg-zinc-800">
      {options.map((option) => {
        const selected = option.value === value;

        return (
          <Pressable
            key={String(option.value)}
            accessibilityRole="button"
            accessibilityState={{ selected, disabled }}
            disabled={disabled}
            onPress={() => onChange(option.value)}
            className={`flex-1 items-center rounded-lg px-3 py-2 ${
              selected ? 'bg-white dark:bg-zinc-700' : ''
            }`}
          >
            <Text
              className={`text-sm font-medium ${
                selected
                  ? 'text-theme-900 dark:text-zinc-100'
                  : 'text-theme-700 dark:text-zinc-400'
              }`}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Small primary action button used inside cards. */
export function CardButton({
  label,
  onPress,
  disabled = false,
  variant = 'primary',
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  variant?: 'primary' | 'outline';
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      className={
        variant === 'primary'
          ? `rounded-lg bg-theme-800 px-3 py-1.5 active:bg-theme-700 dark:bg-zinc-700 dark:active:bg-zinc-600 ${disabled ? 'bg-theme-400 dark:bg-zinc-800' : ''}`
          : `rounded-lg border border-theme-300 px-3 py-1.5 active:bg-theme-50 dark:border-zinc-600 dark:active:bg-zinc-800 ${disabled ? 'opacity-50' : ''}`
      }
    >
      <Text
        className={`text-sm font-medium ${
          variant === 'primary'
            ? 'text-white'
            : 'text-theme-700 dark:text-zinc-300'
        }`}
      >
        {label}
      </Text>
    </Pressable>
  );
}
