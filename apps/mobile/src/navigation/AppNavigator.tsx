import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
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
import { useThemeColors } from '@/hooks/useThemeColors';
import type { AppStackParamList, MainTabParamList } from './types';

const Tab = createBottomTabNavigator<MainTabParamList>();
const Stack = createNativeStackNavigator<AppStackParamList>();

function MainTabs() {
  const c = useThemeColors();
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: {
          backgroundColor: c.card,
          borderTopColor: c.border,
        },
        tabBarActiveTintColor: c.primary,
        tabBarInactiveTintColor: c.textMuted,
        tabBarIcon: ({ color, size }) => {
          const map: Record<string, keyof typeof Ionicons.glyphMap> = {
            Home: 'home',
            Discover: 'compass',
            Live: 'radio',
            Messages: 'chatbubbles',
            Wallet: 'wallet',
          };
          return <Ionicons name={map[route.name] ?? 'ellipse'} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Discover" component={DiscoverScreen} />
      <Tab.Screen name="Live" component={LiveListScreen} />
      <Tab.Screen name="Messages" component={ConversationsScreen} />
      <Tab.Screen name="Wallet" component={WalletScreen} />
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
    </Stack.Navigator>
  );
}
