import React from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Button } from '@/components/ui/Button';
import { Text } from '@/components/ui/Text';
import { Screen } from '@/components/common/Screen';
import { useThemeColors } from '@/hooks/useThemeColors';
import { spacing } from '@/theme';
import type { AuthStackParamList } from '@/navigation/types';

type Props = NativeStackScreenProps<AuthStackParamList, 'Welcome'>;

export function WelcomeScreen({ navigation }: Props) {
  const c = useThemeColors();
  return (
    <Screen padded={false}>
      <LinearGradient colors={[c.bg, '#1a0a14', c.bg]} style={styles.hero}>
        <Image
          source={require('../../assets/images/kush.png')}
          style={styles.logo}
          resizeMode="contain"
        />
        <Text variant="display" style={styles.brand}>
          Kushlov
        </Text>
        <Text muted style={{ textAlign: 'center', marginTop: spacing.sm, paddingHorizontal: 32 }}>
          Meet people, go live, and connect with hosts you love.
        </Text>
      </LinearGradient>
      <View style={styles.actions}>
        <Button title="Create account" onPress={() => navigation.navigate('Register')} />
        <Button
          title="Log in"
          variant="outline"
          onPress={() => navigation.navigate('Login')}
          style={{ marginTop: spacing.md }}
        />
        <Button
          title="See how it works"
          variant="ghost"
          onPress={() => navigation.navigate('Onboarding')}
          style={{ marginTop: spacing.sm }}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 48,
  },
  logo: { width: 120, height: 120, marginBottom: 12 },
  brand: { textAlign: 'center' },
  actions: { padding: spacing['2xl'], paddingBottom: 40 },
});
