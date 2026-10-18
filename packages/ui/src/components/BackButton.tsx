import { useRouter, type Href } from 'expo-router';
import { Pressable } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { cssInterop } from 'nativewind';

const StyledSvg = cssInterop(Svg, {
  className: { target: 'style', nativeStyleToProp: { color: true } },
});

export interface BackButtonProps {
  /**
   * Where "back" leads when there is no history to pop (legacy
   * navigateBack). Without it the button just goes back.
   */
  href?: Href;
  /** Overrides the default navigation. */
  onPress?: () => void;
  className?: string;
}

/** Chevron back button; pops history, or replaces with `href` when there is none. */
export function BackButton({ href, onPress, className }: BackButtonProps) {
  const router = useRouter();

  const handlePress = () => {
    if (onPress !== undefined) {
      onPress();

      return;
    }

    if (router.canGoBack() || href === undefined) {
      router.back();

      return;
    }

    router.replace(href);
  };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="返回"
      hitSlop={8}
      onPress={handlePress}
      className={className ?? 'items-center justify-center px-3 py-1.5'}
    >
      <StyledSvg
        width={24}
        height={24}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2.1}
        className="text-theme-700 dark:text-zinc-300"
      >
        <Path
          d="M15 18l-6-6 6-6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </StyledSvg>
    </Pressable>
  );
}
