import { View, type ViewProps } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export interface ScreenProps extends ViewProps {
    /** Skip the top inset when a header below already pads for it. */
    ignoreTopInset?: boolean;
    ignoreBottomInset?: boolean;
}

/** Page background (legacy `bg-theme-100 dark:bg-zinc-950`) with safe-area padding. */
export function Screen({
    className,
    style,
    ignoreTopInset = false,
    ignoreBottomInset = false,
    ...props
}: ScreenProps) {
    const insets = useSafeAreaInsets();

    return (
        <View
            className={`flex-1 bg-theme-100 dark:bg-zinc-950 ${className ?? ''}`}
            style={[
                {
                    paddingTop: ignoreTopInset ? 0 : insets.top,
                    paddingBottom: ignoreBottomInset ? 0 : insets.bottom,
                },
                style,
            ]}
            {...props}
        />
    );
}
