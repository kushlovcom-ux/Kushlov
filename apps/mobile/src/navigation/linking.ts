import * as Linking from 'expo-linking';
import type { LinkingOptions } from '@react-navigation/native';
import type { RootStackParamList } from './types';
import { env } from '@/config/env';

const prefix = Linking.createURL('/');

export const linking: LinkingOptions<RootStackParamList> = {
  prefixes: [prefix, 'kushlov://', env.siteUrl, 'https://www.klproind.com'],
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
              Live: 'live',
              Messages: 'messages',
              Wallet: 'wallet',
            },
          },
          PublicProfile: 'u/:userId',
          Chat: 'chat/:conversationId',
          LiveRoom: 'live/:liveId',
          Matches: 'matches',
          Notifications: 'notifications',
          Settings: 'settings',
          BecomeHost: 'become-host',
          Contact: 'contact',
        },
      },
    },
  },
};
