import Constants from 'expo-constants';

type Extra = {
  apiUrl?: string;
  socketUrl?: string;
  siteUrl?: string;
  eas?: { projectId?: string };
};

const extra = (Constants.expoConfig?.extra ?? {}) as Extra;

function read(key: string, fallback = ''): string {
  const fromEnv = process.env[key];
  if (fromEnv && fromEnv.length > 0) return fromEnv;
  return fallback;
}

const apiUrl = read(
  'EXPO_PUBLIC_API_URL',
  extra.apiUrl ?? 'https://kushlov-server.vercel.app/api',
);

export const env = {
  apiUrl,
  /** Alias used by the API client */
  apiBase: apiUrl,
  socketUrl: read(
    'EXPO_PUBLIC_SOCKET_URL',
    extra.socketUrl ?? 'https://kushlov-server.vercel.app',
  ),
  siteUrl: read('EXPO_PUBLIC_SITE_URL', extra.siteUrl ?? 'https://www.klproind.com'),
  googleWebClientId: read('EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID'),
  googleAndroidClientId: read('EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID'),
  googleIosClientId: read('EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID'),
  firebase: {
    apiKey: read('EXPO_PUBLIC_FIREBASE_API_KEY'),
    authDomain: read('EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN'),
    projectId: read('EXPO_PUBLIC_FIREBASE_PROJECT_ID'),
    storageBucket: read('EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET'),
    messagingSenderId: read('EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID'),
    appId: read('EXPO_PUBLIC_FIREBASE_APP_ID'),
  },
  easProjectId: read('EXPO_PUBLIC_EAS_PROJECT_ID', extra.eas?.projectId ?? ''),
} as const;

export type Env = typeof env;
