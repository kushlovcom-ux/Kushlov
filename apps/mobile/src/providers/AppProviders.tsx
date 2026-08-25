import React, { useEffect, useState } from 'react';
import { Appearance, StatusBar } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CallOverlay } from '@/components/calls/CallOverlay';
import { ColiveInviteModal } from '@/components/live/ColiveInviteModal';
import { SocketProvider } from './SocketProvider';
import { useThemeStore } from '@/store/theme';
import { useIsDark } from '@/hooks/useThemeColors';
import { usePresence } from '@/hooks/usePresence';
import { useIncomingCallWatcher } from '@/hooks/useIncomingCallWatcher';
import { usePushTokenSync } from '@/hooks/usePushTokenSync';
import { useNotificationNavigation } from '@/hooks/useNotificationNavigation';
import { useFaceFilterStore } from '@/faceFilters/hooks/useFaceFilter';

function ThemeBridge({ children }: { children: React.ReactNode }) {
  const syncSystem = useThemeStore((s) => s.syncSystem);
  const dark = useIsDark();
  usePresence();
  useIncomingCallWatcher();
  usePushTokenSync();
  useNotificationNavigation();
  const hydrateFilters = useFaceFilterStore((s) => s.hydrate);
  const filtersHydrated = useFaceFilterStore((s) => s.hydrated);

  useEffect(() => {
    if (!filtersHydrated) void hydrateFilters();
  }, [filtersHydrated, hydrateFilters]);

  useEffect(() => {
    const sub = Appearance.addChangeListener(() => syncSystem());
    return () => sub.remove();
  }, [syncSystem]);

  return (
    <>
      <StatusBar barStyle={dark ? 'light-content' : 'dark-content'} />
      {children}
    </>
  );
}

export function AppProviders({ children }: { children: React.ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            retry: 1,
            staleTime: 20_000,
          },
        },
      }),
  );

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={client}>
          <ThemeBridge>
            <SocketProvider>
              {children}
              <CallOverlay />
              <ColiveInviteModal />
            </SocketProvider>
          </ThemeBridge>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
