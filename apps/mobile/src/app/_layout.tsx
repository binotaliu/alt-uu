import { AppRoot } from '@altuu/features';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';

import { createAppServices } from '../compositionRoot';
import { DevDeepLinkHelper } from '../DevDeepLinkHelper';
import '../global.css';

void SplashScreen.preventAutoHideAsync();

const hideSplash = () => {
  void SplashScreen.hideAsync();
};

export default function RootLayout() {
  return (
    <AppRoot createServices={createAppServices} onReady={hideSplash}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="browser" options={{ presentation: 'modal' }} />
      </Stack>
      {__DEV__ ? <DevDeepLinkHelper /> : null}
    </AppRoot>
  );
}
