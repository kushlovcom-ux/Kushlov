import { useEffect } from 'react';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Crypto from 'expo-crypto';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { devicesApi } from '@/api/devices';
import { usersApi } from '@/api/users';
import { getExpoPushToken } from '@/services/notifications';
import { useAuthStore } from '@/store/auth';

const DEVICE_ID_KEY = 'kushlov.deviceId';
export const PUSH_TOKEN_KEY = 'kushlov.expoPushToken';

export async function getDeviceId() {
  try {
    const existing = await AsyncStorage.getItem(DEVICE_ID_KEY);
    if (existing) return existing;
    const next =
      typeof Crypto.randomUUID === 'function'
        ? Crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    await AsyncStorage.setItem(DEVICE_ID_KEY, next);
    return next;
  } catch {
    return `anon-${Date.now()}`;
  }
}

async function registerToken(pushToken: string) {
  const deviceId = await getDeviceId();
  const platform: 'ios' | 'android' = Platform.OS === 'ios' ? 'ios' : 'android';
  const appVersion = Constants.expoConfig?.version;
  const osVersion = Device.osVersion ?? undefined;
  await AsyncStorage.setItem(PUSH_TOKEN_KEY, pushToken);
  await devicesApi.register({
    pushToken,
    platform,
    deviceId,
    appVersion,
    osVersion,
  });
  // Keep legacy endpoint in sync for older servers during rollout.
  try {
    await usersApi.registerPushToken(pushToken, { platform, deviceId });
  } catch {
    /* devices/register is the source of truth */
  }
}

export async function clearStoredPushToken() {
  try {
    const stored = await AsyncStorage.getItem(PUSH_TOKEN_KEY);
    const deviceId = await AsyncStorage.getItem(DEVICE_ID_KEY);
    if (deviceId) {
      await devicesApi.unregister(deviceId, stored ?? undefined);
    } else if (stored) {
      await usersApi.clearPushToken(stored);
    }
    await AsyncStorage.removeItem(PUSH_TOKEN_KEY);
  } catch {
    /* still log out */
  }
}

/** After login, fetch an Expo push token and store it on the user so the server can notify a closed app. */
export function usePushTokenSync() {
  const token = useAuthStore((s) => s.accessToken);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    void (async () => {
      const pushToken = await getExpoPushToken();
      if (!pushToken || cancelled) return;
      try {
        await registerToken(pushToken);
      } catch {
        /* optional — overlay/socket still work */
      }
    })();

    let tokenSub: { remove: () => void } | undefined;
    try {
      tokenSub = Notifications.addPushTokenListener((t) => {
        if (!t.data || cancelled) return;
        void registerToken(t.data).catch(() => undefined);
      });
    } catch {
      /* Expo Go / older client */
    }

    return () => {
      cancelled = true;
      tokenSub?.remove();
    };
  }, [token]);
}
