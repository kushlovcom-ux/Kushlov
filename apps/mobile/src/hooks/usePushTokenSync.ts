import { useEffect } from 'react';
import { Platform } from 'react-native';
import * as Crypto from 'expo-crypto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { usersApi } from '@/api/users';
import { getExpoPushToken } from '@/services/notifications';
import { useAuthStore } from '@/store/auth';

const DEVICE_ID_KEY = 'kushlov.deviceId';
export const PUSH_TOKEN_KEY = 'kushlov.expoPushToken';

async function getDeviceId() {
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
    return undefined;
  }
}

export async function clearStoredPushToken() {
  try {
    const stored = await AsyncStorage.getItem(PUSH_TOKEN_KEY);
    await usersApi.clearPushToken(stored ?? undefined);
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
        await AsyncStorage.setItem(PUSH_TOKEN_KEY, pushToken);
        const deviceId = await getDeviceId();
        await usersApi.registerPushToken(pushToken, {
          platform: Platform.OS === 'ios' ? 'ios' : 'android',
          deviceId,
        });
      } catch {
        /* optional — overlay/socket still work */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);
}
