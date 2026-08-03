import Constants from 'expo-constants';

type Extra = {
  apiUrl?: string;
  socketUrl?: string;
  siteUrl?: string;
  googleWebClientId?: string;
  googleAndroidClientId?: string;
  googleIosClientId?: string;
  firebase?: {
    apiKey?: string;
    authDomain?: string;
    projectId?: string;
    storageBucket?: string;
    messagingSenderId?: string;
    appId?: string;
  };
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
  googleWebClientId: read(
    'EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID',
    extra.googleWebClientId ?? '',
  ),
  googleAndroidClientId: read(
    'EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID',
    extra.googleAndroidClientId ?? '',
  ),
  googleIosClientId: read(
    'EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID',
    extra.googleIosClientId ?? '',
  ),
  firebase: {
    apiKey: read('EXPO_PUBLIC_FIREBASE_API_KEY', extra.firebase?.apiKey ?? ''),
    authDomain: read('EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN', extra.firebase?.authDomain ?? ''),
    projectId: read('EXPO_PUBLIC_FIREBASE_PROJECT_ID', extra.firebase?.projectId ?? ''),
    storageBucket: read(
      'EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET',
      extra.firebase?.storageBucket ?? '',
    ),
    messagingSenderId: read(
      'EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID',
      extra.firebase?.messagingSenderId ?? '',
    ),
    appId: read('EXPO_PUBLIC_FIREBASE_APP_ID', extra.firebase?.appId ?? ''),
  },
  easProjectId: read('EXPO_PUBLIC_EAS_PROJECT_ID', extra.eas?.projectId ?? ''),
} as const;

export type Env = typeof env;
