import React from 'react';
import { View } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { HomeScreen } from '@/screens/home/HomeScreen';
import { DiscoverScreen } from '@/screens/discover/DiscoverScreen';
import { LiveListScreen } from '@/screens/live/LiveListScreen';
import { ConversationsScreen } from '@/screens/messages/ConversationsScreen';
import { WalletScreen } from '@/screens/wallet/WalletScreen';
import { NavBadge } from '@/components/common/NavBadge';
import { useBadges } from '@/hooks/useBadges';
import { useThemeColors } from '@/hooks/useThemeColors';
import type { MainTabParamList } from './types';

const Tab = createBottomTabNavigator<MainTabParamList>();

export function AppTabs() {
  const c = useThemeColors();
  const badges = useBadges();
  const messageCount = badges.data?.messages ?? badges.data?.unreadMessages ?? 0;

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
          return (
            <View>
              <Ionicons name={map[route.name] ?? 'ellipse'} size={size} color={color} />
              {route.name === 'Messages' ? <NavBadge count={messageCount} /> : null}
            </View>
          );
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
