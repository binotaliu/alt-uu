import { Text as RNText, type TextProps } from 'react-native';

import { cn } from '../cn';

export function Text({ className, ...props }: TextProps) {
  return (
    <RNText
      className={cn('text-base text-theme-900 dark:text-zinc-100', className)}
      {...props}
    />
  );
}
