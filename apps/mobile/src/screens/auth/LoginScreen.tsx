import React, { useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Text } from '@/components/ui/Text';
import { Header } from '@/components/common/Header';
import { Screen } from '@/components/common/Screen';
import { getErrorMessage } from '@/api/client';
import { useAuth } from '@/hooks/useAuth';
import { getGoogleIdToken, useGoogleAuth } from '@/services/google-auth';
import { isValidEmail, isValidPassword } from '@/utils/validation';
import { spacing } from '@/theme';
import type { AuthStackParamList } from '@/navigation/types';

type Props = NativeStackScreenProps<AuthStackParamList, 'Login'>;

export function LoginScreen({ navigation }: Props) {
  const { login, loginWithGoogle, isLoggingIn } = useAuth();
  const { ready, promptAsync } = useGoogleAuth();
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
      const idToken = await getGoogleIdToken(promptAsync);
      await loginWithGoogle({ idToken });
    } catch (err) {
      Alert.alert('Google Sign-In', getErrorMessage(err));
    }
  };

  return (
    <Screen scroll>
      <Header title="Log in" onBack={() => navigation.goBack()} />
      <Text muted style={{ marginBottom: spacing.lg }}>
        Welcome back to Kushlov
      </Text>
      <Input
        label="Email"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
        error={errors.email}
      />
      <View style={{ height: spacing.md }} />
      <Input
        label="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        error={errors.password}
      />
      <Pressable onPress={() => navigation.navigate('ForgotPassword')} style={styles.forgot}>
        <Text variant="caption" color="#ec4899">
          Forgot password?
        </Text>
      </Pressable>
      <Button title="Log in" onPress={submit} loading={isLoggingIn} />
      <Button
        title="Continue with Google"
        variant="secondary"
        onPress={onGoogle}
        disabled={!ready}
        style={{ marginTop: spacing.md }}
      />
      <Pressable onPress={() => navigation.navigate('Register')} style={styles.footer}>
        <Text muted>
          New here? <Text color="#ec4899">Create an account</Text>
        </Text>
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  forgot: { alignSelf: 'flex-end', marginVertical: spacing.md },
  footer: { marginTop: spacing['2xl'], alignItems: 'center' },
});
