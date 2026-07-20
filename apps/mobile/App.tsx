import 'react-native-gesture-handler';
import React, { useEffect } from 'react';
import { Appearance } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import { AppProviders } from '@/providers/AppProviders';
import { RootNavigator } from '@/navigation/RootNavigator';
import { ErrorBoundary } from '@/components/ErrorBoundary';
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
    let cancelled = false;

    const boot = async () => {
      // Always reveal UI quickly — never wait on push/permissions.
      const hide = async () => {
        if (!cancelled) await SplashScreen.hideAsync().catch(() => undefined);
      };

      const hideTimer = setTimeout(() => {
        void hide();
      }, 1500);

      try {
        await Promise.race([
          registerForPushNotifications(),
          new Promise((r) => setTimeout(r, 1200)),
        ]);
      } catch {
        /* optional */
      } finally {
        clearTimeout(hideTimer);
        await hide();
      }
    };

    void boot();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <ErrorBoundary>
      <AppProviders>
        <RootNavigator />
      </AppProviders>
    </ErrorBoundary>
  );
}
