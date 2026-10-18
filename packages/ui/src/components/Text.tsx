import { Text as RNText, type TextProps } from 'react-native';

export function Text({ className, ...props }: TextProps) {
  return (
    <RNText
      className={`text-base text-theme-900 dark:text-zinc-100 ${className ?? ''}`}
      {...props}
    />
  );
}
