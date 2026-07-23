import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { NavigationContainer, DarkTheme, DefaultTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { AuthNavigator } from './AuthNavigator';
import { AppNavigator } from './AppNavigator';
import { linking } from './linking';
import { navigationRef } from './navigationRef';
import { useAuth } from '@/hooks/useAuth';
import { useIsDark, useThemeColors } from '@/hooks/useThemeColors';
import { useAuthStore } from '@/store/auth';
import { OnboardingScreen } from '@/screens/onboarding/OnboardingScreen';
import type { RootStackParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator() {
  const { isAuthenticated, hydrated } = useAuth();
  const onboardingSeen = useAuthStore((s) => s.onboardingSeen);
  const dark = useIsDark();
  const c = useThemeColors();

  if (!hydrated) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: c.bg }}>
        <ActivityIndicator color={c.primary} size="large" />
      </View>
    );
  }

  const theme = {
    ...(dark ? DarkTheme : DefaultTheme),
    colors: {
      ...(dark ? DarkTheme.colors : DefaultTheme.colors),
      background: c.bg,
      card: c.card,
      text: c.text,
      border: c.border,
      primary: c.primary,
    },
  };

  return (
    <NavigationContainer ref={navigationRef} linking={linking} theme={theme}>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!onboardingSeen ? (
          <Stack.Screen name="Onboarding" component={OnboardingScreen} />
        ) : isAuthenticated ? (
          <Stack.Screen name="App" component={AppNavigator} />
        ) : (
          <Stack.Screen name="Auth" component={AuthNavigator} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
