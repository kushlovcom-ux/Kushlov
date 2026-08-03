import * as Linking from 'expo-linking';
import type { LinkingOptions } from '@react-navigation/native';
import type { RootStackParamList } from './types';
import { env } from '@/config/env';

const prefix = Linking.createURL('/');

export const linking: LinkingOptions<RootStackParamList> = {
  prefixes: [
    prefix,
    'kushlov://',
    env.siteUrl,
    'https://www.klproind.com',
    'https://klproind.com',
    'https://www.genzone.cloud',
    'https://genzone.cloud',
  ],
  config: {
    screens: {
      Auth: {
        screens: {
          Welcome: 'welcome',
          Login: 'login',
          Register: 'register',
          ForgotPassword: 'forgot-password',
          ResetPassword: 'reset-password',
          Onboarding: 'onboarding',
        },
      },
      App: {
        screens: {
          MainTabs: {
            screens: {
              Home: 'home',
              Discover: 'discover',
              Matches: 'matches',
              Messages: 'messages',
              Profile: 'profile',
            },
          },
          PublicProfile: 'u/:userId',
          Chat: 'chat/:conversationId',
          LiveRoom: 'live/:liveId',
          LiveList: 'live',
          Wallet: 'wallet',
          Notifications: 'notifications',
          Settings: 'settings',
          BecomeHost: 'become-host',
          Contact: 'contact',
        },
      },
    },
  },
};
