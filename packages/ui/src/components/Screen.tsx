import { View, type ViewProps } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export function Screen({ className, style, ...props }: ViewProps) {
    const insets = useSafeAreaInsets();

    return (
        <View
            className={`flex-1 bg-theme-50 dark:bg-theme-900 ${className ?? ''}`}
            style={[
                { paddingTop: insets.top, paddingBottom: insets.bottom },
                style,
            ]}
            {...props}
        />
    );
}
