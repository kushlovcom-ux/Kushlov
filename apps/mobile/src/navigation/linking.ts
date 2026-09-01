import * as Linking from 'expo-linking';
import { getStateFromPath as defaultGetStateFromPath } from '@react-navigation/native';
import type { LinkingOptions } from '@react-navigation/native';
import type { RootStackParamList } from './types';
import { env } from '@/config/env';
import { setPendingCallLink } from '@/services/pendingCallLink';

const prefix = Linking.createURL('/');

function rewritePath(path: string): string {
  const stripped = path.replace(/^\//, '');
  if (stripped.startsWith('likes')) return 'matches';
  if (stripped.startsWith('profile/')) return stripped.replace(/^profile/, 'u');
  if (stripped.startsWith('call/')) {
    const [idPart, query] = stripped.slice('call/'.length).split('?');
    const params = new URLSearchParams(query ?? '');
    setPendingCallLink({
      callId: idPart,
      callType: params.get('type') ?? 'audio',
    });
    return 'home';
  }
  return stripped;
}

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
  getStateFromPath: (path, options) => defaultGetStateFromPath(rewritePath(path), options),
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
              Live: 'live',
              Wallet: 'wallet',
              Profile: 'profile-tab',
            },
          },
          PublicProfile: 'u/:userId',
          Chat: 'chat/:conversationId',
          LiveRoom: 'live/:liveId',
          LiveList: 'live-rooms',
          Wallet: 'wallet-stack',
          Notifications: 'notifications',
          Settings: 'settings',
          BecomeHost: 'become-host',
          Contact: 'contact',
          CallHistory: 'calls',
        },
      },
    },
  },
};
