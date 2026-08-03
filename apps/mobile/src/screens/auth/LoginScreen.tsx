import React, { useState } from 'react';
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Text } from '@/components/ui/Text';
import { Screen } from '@/components/common/Screen';
import { getErrorMessage } from '@/api/client';
import { useAuth } from '@/hooks/useAuth';
import { getGoogleIdToken, useGoogleAuth } from '@/services/google-auth';
import { useThemeColors } from '@/hooks/useThemeColors';
import { isValidEmail, isValidPassword } from '@/utils/validation';
import { spacing } from '@/theme';
import type { AuthStackParamList } from '@/navigation/types';

type Props = NativeStackScreenProps<AuthStackParamList, 'Login'>;

export function LoginScreen({ navigation }: Props) {
  const c = useThemeColors();
  const { login, loginWithGoogle, isLoggingIn } = useAuth();
  const { ready, configured } = useGoogleAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});

  const submit = async () => {
    const next: typeof errors = {};
    if (!isValidEmail(email)) next.email = 'Enter a valid email';
    if (!isValidPassword(password)) next.password = 'Password must be at least 8 characters';
    setErrors(next);
    if (Object.keys(next).length) return;
    try {
      await login({ email: email.trim(), password });
    } catch (err) {
      Alert.alert('Login failed', getErrorMessage(err));
    }
  };

  const onGoogle = async () => {
    try {
      if (!configured) {
        Alert.alert(
          'Google Sign-In',
          Platform.OS === 'android'
            ? 'Set EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID + EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID (with package com.kushlov.app and EAS SHA-1), then rebuild the app.'
            : 'Google Sign-In is not configured for this build.',
        );
        return;
      }
      const idToken = await getGoogleIdToken();
      await loginWithGoogle({ idToken });
    } catch (err) {
      Alert.alert('Google Sign-In', getErrorMessage(err));
    }
  };

  return (
    <Screen padded={false}>
      <LinearGradient colors={[...c.gradientNight]} style={StyleSheet.absoluteFill} />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Pressable onPress={() => navigation.goBack()} hitSlop={12}>
            <Text variant="caption" color={c.pink}>
              ← Back
            </Text>
          </Pressable>

          <View style={styles.hero}>
            <Image
              source={require('../../assets/images/kush.png')}
              style={styles.logo}
              resizeMode="contain"
            />
            <Text variant="display">Welcome back</Text>
            <Text muted style={{ marginTop: 8, textAlign: 'center' }}>
              Sign in to continue your Kushlov story
            </Text>
          </View>

          <View
            style={[
              styles.card,
              {
                backgroundColor: c.card,
                borderColor: c.border,
                shadowColor: c.primary,
              },
            ]}
          >
            <Input
              label="Email"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              error={errors.email}
              placeholder="you@email.com"
            />
            <View style={{ height: spacing.md }} />
            <Input
              label="Password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              error={errors.password}
              placeholder="Your password"
            />
            <Pressable onPress={() => navigation.navigate('ForgotPassword')} style={styles.forgot}>
              <Text variant="caption" color={c.pink}>
                Forgot password?
              </Text>
            </Pressable>
            <Button title="Log in" onPress={submit} loading={isLoggingIn} fullWidth size="lg" />
            {configured ? (
              <Button
                title="Continue with Google"
                variant="secondary"
                onPress={onGoogle}
                disabled={!ready}
                fullWidth
                style={{ marginTop: spacing.md }}
              />
            ) : null}
          </View>

          <Pressable onPress={() => navigation.navigate('Register')} style={styles.footer}>
            <Text muted>
              New here? <Text color={c.pink}>Create an account</Text>
            </Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: spacing['2xl'], paddingTop: 56, paddingBottom: 48 },
  hero: { alignItems: 'center', marginVertical: spacing['2xl'] },
  logo: { width: 72, height: 72, marginBottom: spacing.md },
  card: {
    borderRadius: 28,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing.xl,
    shadowOpacity: 0.2,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 8,
  },
  forgot: { alignSelf: 'flex-end', marginVertical: spacing.md },
  footer: { marginTop: spacing['2xl'], alignItems: 'center' },
});
