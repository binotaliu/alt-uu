import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ThemeProvider } from '@altuu/ui';

import '../global.css';

export default function RootLayout() {
    return (
        <ThemeProvider>
            <StatusBar style="auto" />
            <Stack screenOptions={{ headerShown: false }} />
        </ThemeProvider>
    );
}
