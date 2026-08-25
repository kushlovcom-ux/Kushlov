import 'react-native-gesture-handler';
import React, { useEffect } from 'react';
import { Appearance } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import { AppProviders } from '@/providers/AppProviders';
import { RootNavigator } from '@/navigation/RootNavigator';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { useThemeStore } from '@/store/theme';
import { registerForPushNotifications } from '@/services/notifications';
import { preloadLiveKitNative } from '@/services/livekit';

SplashScreen.preventAutoHideAsync().catch(() => undefined);

export default function App() {
  const syncSystem = useThemeStore((s) => s.syncSystem);

  useEffect(() => {
    syncSystem();
    const sub = Appearance.addChangeListener(() => {
      syncSystem();
    });
    return () => sub.remove();
  }, [syncSystem]);

  useEffect(() => {
    void SplashScreen.hideAsync().catch(() => undefined);
    preloadLiveKitNative();
    void registerForPushNotifications().catch(() => undefined);
  }, []);

  return (
    <ErrorBoundary>
      <AppProviders>
        <RootNavigator />
      </AppProviders>
    </ErrorBoundary>
  );
}
