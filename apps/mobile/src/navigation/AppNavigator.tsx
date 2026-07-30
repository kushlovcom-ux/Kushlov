import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { HomeScreen } from '@/screens/home/HomeScreen';
import { DiscoverScreen } from '@/screens/discover/DiscoverScreen';
import { LiveListScreen } from '@/screens/live/LiveListScreen';
import { ConversationsScreen } from '@/screens/messages/ConversationsScreen';
import { WalletScreen } from '@/screens/wallet/WalletScreen';
import { ProfileScreen } from '@/screens/profile/ProfileScreen';
import { PublicProfileScreen } from '@/screens/profile/PublicProfileScreen';
import { ChatScreen } from '@/screens/messages/ChatScreen';
import { MatchesScreen } from '@/screens/matches/MatchesScreen';
import { NotificationsScreen } from '@/screens/notifications/NotificationsScreen';
import { SettingsScreen } from '@/screens/settings/SettingsScreen';
import { EditProfileScreen } from '@/screens/settings/EditProfileScreen';
import { PrivacyScreen } from '@/screens/settings/PrivacyScreen';
import { BlockedUsersScreen } from '@/screens/settings/BlockedUsersScreen';
import { NotificationSettingsScreen } from '@/screens/settings/NotificationSettingsScreen';
import { CallHistoryScreen } from '@/screens/calls/CallHistoryScreen';
import { GroupCallScreen } from '@/screens/calls/GroupCallScreen';
import { TransactionsScreen } from '@/screens/wallet/TransactionsScreen';
import { LiveRoomScreen } from '@/screens/live/LiveRoomScreen';
import { GoLiveScreen } from '@/screens/live/GoLiveScreen';
import { BecomeHostScreen } from '@/screens/host/BecomeHostScreen';
import { ContactScreen } from '@/screens/contact/ContactScreen';
import { LocationSetupScreen } from '@/screens/misc/LocationSetupScreen';
import { PremiumTabBar } from '@/design-system';
import { useBadges } from '@/hooks/useBadges';
import { useThemeColors } from '@/hooks/useThemeColors';
import type { AppStackParamList, MainTabParamList } from './types';

const Tab = createBottomTabNavigator<MainTabParamList>();
const Stack = createNativeStackNavigator<AppStackParamList>();

function MainTabs() {
  const badges = useBadges();
  const msgCount = badges.data?.unreadMessages ?? badges.data?.messages ?? 0;

  return (
    <Tab.Navigator
      tabBar={(props) => <PremiumTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        tabBarHideOnKeyboard: true,
      }}
    >
      <Tab.Screen name="Home" component={HomeScreen} options={{ title: 'Home' }} />
      <Tab.Screen name="Discover" component={DiscoverScreen} options={{ title: 'Discover' }} />
      <Tab.Screen name="Matches" component={MatchesScreen} options={{ title: 'Matches' }} />
      <Tab.Screen
        name="Messages"
        component={ConversationsScreen}
        options={{
          title: 'Chat',
          tabBarBadge: msgCount > 0 ? msgCount : undefined,
        }}
      />
      <Tab.Screen name="Profile" component={ProfileScreen} options={{ title: 'Profile' }} />
    </Tab.Navigator>
  );
}

export function AppNavigator() {
  const c = useThemeColors();
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: c.bg },
        animation: 'fade_from_bottom',
      }}
    >
      <Stack.Screen name="MainTabs" component={MainTabs} />
      <Stack.Screen name="PublicProfile" component={PublicProfileScreen} />
      <Stack.Screen name="Chat" component={ChatScreen} />
      <Stack.Screen name="Matches" component={MatchesScreen} />
      <Stack.Screen name="Notifications" component={NotificationsScreen} />
      <Stack.Screen name="Settings" component={SettingsScreen} />
      <Stack.Screen name="EditProfile" component={EditProfileScreen} />
      <Stack.Screen name="Privacy" component={PrivacyScreen} />
      <Stack.Screen name="BlockedUsers" component={BlockedUsersScreen} />
      <Stack.Screen name="NotificationSettings" component={NotificationSettingsScreen} />
      <Stack.Screen name="CallHistory" component={CallHistoryScreen} />
      <Stack.Screen name="GroupCall" component={GroupCallScreen} />
      <Stack.Screen name="History" component={CallHistoryScreen} />
      <Stack.Screen name="Transactions" component={TransactionsScreen} />
      <Stack.Screen name="LiveRoom" component={LiveRoomScreen} />
      <Stack.Screen name="GoLive" component={GoLiveScreen} />
      <Stack.Screen name="BecomeHost" component={BecomeHostScreen} />
      <Stack.Screen name="Contact" component={ContactScreen} />
      <Stack.Screen name="LocationSetup" component={LocationSetupScreen} />
      <Stack.Screen name="Profile" component={ProfileScreen} />
      <Stack.Screen name="Wallet" component={WalletScreen} />
      <Stack.Screen name="LiveList" component={LiveListScreen} />
    </Stack.Navigator>
  );
}
