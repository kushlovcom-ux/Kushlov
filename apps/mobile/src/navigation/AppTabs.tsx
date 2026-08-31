import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { HomeScreen } from '@/screens/home/HomeScreen';
import { DiscoverScreen } from '@/screens/discover/DiscoverScreen';
import { ConversationsScreen } from '@/screens/messages/ConversationsScreen';
import { MatchesScreen } from '@/screens/matches/MatchesScreen';
import { ProfileScreen } from '@/screens/profile/ProfileScreen';
import { LiveListScreen } from '@/screens/live/LiveListScreen';
import { WalletScreen } from '@/screens/wallet/WalletScreen';
import { PremiumTabBar } from '@/design-system';
import { useBadges } from '@/hooks/useBadges';
import type { MainTabParamList } from './types';

const Tab = createBottomTabNavigator<MainTabParamList>();

/** Alternate tabs entry (badges + premium bar). Prefer AppNavigator MainTabs. */
export function AppTabs() {
  const badges = useBadges();
  const messageCount = badges.data?.messages ?? badges.data?.unreadMessages ?? 0;

  return (
    <Tab.Navigator
      tabBar={(props) => <PremiumTabBar {...props} />}
      screenOptions={{ headerShown: false, tabBarHideOnKeyboard: true, freezeOnBlur: true, lazy: true }}
    >
      <Tab.Screen name="Home" component={HomeScreen} options={{ title: 'Home' }} />
      <Tab.Screen name="Discover" component={DiscoverScreen} options={{ title: 'Discover' }} />
      <Tab.Screen name="Matches" component={MatchesScreen} options={{ title: 'Matches' }} />
      <Tab.Screen
        name="Messages"
        component={ConversationsScreen}
        options={{
          title: 'Chat',
          tabBarBadge: messageCount > 0 ? messageCount : undefined,
        }}
      />
      <Tab.Screen name="Live" component={LiveListScreen} options={{ title: 'Live' }} />
      <Tab.Screen name="Wallet" component={WalletScreen} options={{ title: 'Wallet' }} />
      <Tab.Screen name="Profile" component={ProfileScreen} options={{ title: 'Profile' }} />
    </Tab.Navigator>
  );
}
