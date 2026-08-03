import type { ConfigContext, ExpoConfig } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => {
  return {
    ...config,
    name: 'Kushlov',
    slug: 'kushlov',
    version: '1.0.0',
    orientation: 'portrait',
    // Razorpay does not support the New Architecture yet — keep it off for stable Android launches.
    newArchEnabled: false,
    // Align Metro resolution with native autolinking in this pnpm monorepo.
    experiments: {
      autolinkingModuleResolution: true,
    },
    icon: './assets/adaptive-icon.png',
    scheme: 'kushlov',
    userInterfaceStyle: 'automatic',
    splash: {
      image: './assets/adaptive-icon.png',
      resizeMode: 'contain',
      backgroundColor: '#0a0a0b',
    },
    ios: {
      supportsTablet: true,
      bundleIdentifier: 'com.kushlov.app',
      infoPlist: {
        NSCameraUsageDescription:
          'Kushlov needs camera access for video calls, live streams, and profile photos.',
        NSMicrophoneUsageDescription:
          'Kushlov needs microphone access for audio/video calls and live streams.',
        NSLocationWhenInUseUsageDescription:
          'Kushlov uses your location to show nearby people and hosts.',
        NSPhotoLibraryUsageDescription:
          'Kushlov needs photo library access to update your profile and gallery.',
        UIBackgroundModes: ['audio', 'voip', 'remote-notification'],
      },
      associatedDomains: ['applinks:www.klproind.com', 'applinks:klproind.com'],
    },
    android: {
      adaptiveIcon: {
        foregroundImage: './assets/adaptive-icon.png',
        backgroundImage: './assets/adaptive-icon.png',
        monochromeImage: './assets/adaptive-icon.png',
        backgroundColor: '#0a0a0b',
      },
      package: 'com.kushlov.app',
      permissions: [
        'CAMERA',
        'RECORD_AUDIO',
        'ACCESS_COARSE_LOCATION',
        'ACCESS_FINE_LOCATION',
        'POST_NOTIFICATIONS',
        'VIBRATE',
        'MODIFY_AUDIO_SETTINGS',
        'BLUETOOTH',
        'BLUETOOTH_CONNECT',
      ],
      intentFilters: [
        {
          action: 'VIEW',
          autoVerify: true,
          data: [
            { scheme: 'https', host: 'www.klproind.com', pathPrefix: '/' },
            { scheme: 'kushlov' },
          ],
          category: ['BROWSABLE', 'DEFAULT'],
        },
      ],
    },
    web: {
      favicon: './assets/favicon.png',
      bundler: 'metro',
    },
    plugins: [
      'expo-secure-store',
      [
        'expo-notifications',
        {
          icon: './assets/adaptive-icon.png',
          color: '#ec4899',
        },
      ],
      [
        'expo-image-picker',
        {
          photosPermission:
            'Allow Kushlov to access your photos for profile and gallery uploads.',
          cameraPermission:
            'Allow Kushlov to use your camera for profile photos and verification.',
        },
      ],
      [
        'expo-location',
        {
          locationWhenInUsePermission:
            'Allow Kushlov to use your location to find people nearby.',
        },
      ],
      [
        'expo-splash-screen',
        {
          backgroundColor: '#0a0a0b',
          image: './assets/adaptive-icon.png',
          imageWidth: 200,
        },
      ],
      'expo-font',
    ],
    extra: {
      eas: {
        projectId:
          process.env.EXPO_PUBLIC_EAS_PROJECT_ID ?? 'ecab9e35-1360-4ce3-b5fb-25076affb3a2',
      },
      apiUrl: process.env.EXPO_PUBLIC_API_URL ?? 'https://kushlov-server.vercel.app/api',
      socketUrl: process.env.EXPO_PUBLIC_SOCKET_URL ?? 'https://kushlov-server.vercel.app',
      siteUrl: process.env.EXPO_PUBLIC_SITE_URL ?? 'https://www.klproind.com',
      googleWebClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? '',
      googleAndroidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID ?? '',
      googleIosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ?? '',
    },
    owner: 'kushlov1',
  } as unknown as ExpoConfig;
};
