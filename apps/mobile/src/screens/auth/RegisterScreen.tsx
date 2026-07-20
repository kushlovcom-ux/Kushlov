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
import { isValidEmail, isValidPassword, isValidUsername } from '@/utils/validation';
import { spacing } from '@/theme';
import type { AuthStackParamList } from '@/navigation/types';

type Props = NativeStackScreenProps<AuthStackParamList, 'Register'>;

export function RegisterScreen({ navigation }: Props) {
  const { register, isRegistering } = useAuth();
  const [form, setForm] = useState({
    email: '',
    username: '',
    displayName: '',
    password: '',
    country: 'IN',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async () => {
    const next: Record<string, string> = {};
    if (!isValidEmail(form.email)) next.email = 'Enter a valid email';
    if (!isValidUsername(form.username)) next.username = '3–30 letters, numbers, underscore';
    if (form.displayName.trim().length < 2) next.displayName = 'Enter your display name';
    if (!isValidPassword(form.password)) next.password = 'At least 8 characters';
    if (form.country.trim().length < 2) next.country = 'Country code required';
    setErrors(next);
    if (Object.keys(next).length) return;
    try {
      await register({
        email: form.email.trim(),
        username: form.username.trim(),
        displayName: form.displayName.trim(),
        password: form.password,
        country: form.country.trim().toUpperCase(),
        accountType: 'user',
      });
    } catch (err) {
      Alert.alert('Registration failed', getErrorMessage(err));
    }
  };

  return (
    <Screen scroll>
      <Header title="Create account" onBack={() => navigation.goBack()} />
      <Input label="Email" value={form.email} onChangeText={(v) => set('email', v)} autoCapitalize="none" keyboardType="email-address" error={errors.email} />
      <View style={{ height: spacing.md }} />
      <Input label="Username" value={form.username} onChangeText={(v) => set('username', v)} autoCapitalize="none" error={errors.username} />
      <View style={{ height: spacing.md }} />
      <Input label="Display name" value={form.displayName} onChangeText={(v) => set('displayName', v)} error={errors.displayName} />
      <View style={{ height: spacing.md }} />
      <Input label="Password" value={form.password} onChangeText={(v) => set('password', v)} secureTextEntry error={errors.password} />
      <View style={{ height: spacing.md }} />
      <Input label="Country (ISO)" value={form.country} onChangeText={(v) => set('country', v)} autoCapitalize="characters" error={errors.country} />
      <Button title="Sign up" onPress={submit} loading={isRegistering} style={{ marginTop: spacing.xl }} />
      <Pressable onPress={() => navigation.navigate('Login')} style={styles.footer}>
        <Text muted>
          Already have an account? <Text color="#ec4899">Log in</Text>
        </Text>
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  footer: { marginTop: spacing['2xl'], alignItems: 'center', marginBottom: 40 },
});
