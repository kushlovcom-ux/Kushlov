import 'react-native-gesture-handler';
import React, { useEffect } from 'react';
import { Appearance } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import { AppProviders } from '@/providers/AppProviders';
import { RootNavigator } from '@/navigation/RootNavigator';
import { useThemeStore } from '@/store/theme';
import { registerForPushNotifications } from '@/services/notifications';

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
    const boot = async () => {
      try {
        await registerForPushNotifications();
      } catch {
        /* optional */
      } finally {
        await SplashScreen.hideAsync().catch(() => undefined);
      }
    };
    void boot();
  }, []);

  return (
    <AppProviders>
      <RootNavigator />
    </AppProviders>
  );
}
