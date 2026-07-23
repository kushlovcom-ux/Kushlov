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
import { useThemeColors } from '@/hooks/useThemeColors';
import { isValidEmail, isValidPassword, isValidUsername } from '@/utils/validation';
import { spacing } from '@/theme';
import type { AuthStackParamList } from '@/navigation/types';

type Props = NativeStackScreenProps<AuthStackParamList, 'Register'>;

export function RegisterScreen({ navigation }: Props) {
  const c = useThemeColors();
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
      // Always register as a normal user — become a host later from Profile.
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
    <Screen padded={false}>
      <LinearGradient colors={['#12081a', c.bg, '#080610']} style={StyleSheet.absoluteFill} />
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
            <Text variant="h1">Join Kushlov</Text>
            <Text muted style={{ marginTop: 6, textAlign: 'center' }}>
              Create your account and start meeting people. Host applications are available after signup.
            </Text>
          </View>

          <View style={[styles.card, { backgroundColor: c.card, borderColor: c.border }]}>
            <Input
              label="Email"
              value={form.email}
              onChangeText={(v) => set('email', v)}
              autoCapitalize="none"
              keyboardType="email-address"
              error={errors.email}
              placeholder="you@email.com"
            />
            <View style={{ height: spacing.md }} />
            <Input
              label="Username"
              value={form.username}
              onChangeText={(v) => set('username', v)}
              autoCapitalize="none"
              error={errors.username}
              placeholder="yourname"
            />
            <View style={{ height: spacing.md }} />
            <Input
              label="Display name"
              value={form.displayName}
              onChangeText={(v) => set('displayName', v)}
              error={errors.displayName}
              placeholder="How others see you"
            />
            <View style={{ height: spacing.md }} />
            <Input
              label="Password"
              value={form.password}
              onChangeText={(v) => set('password', v)}
              secureTextEntry
              error={errors.password}
              placeholder="At least 8 characters"
            />
            <View style={{ height: spacing.md }} />
            <Input
              label="Country (ISO)"
              value={form.country}
              onChangeText={(v) => set('country', v)}
              autoCapitalize="characters"
              error={errors.country}
              placeholder="IN"
            />
            <Button
              title="Create account"
              onPress={submit}
              loading={isRegistering}
              fullWidth
              size="lg"
              style={{ marginTop: spacing.xl }}
            />
          </View>

          <Pressable onPress={() => navigation.navigate('Login')} style={styles.footer}>
            <Text muted>
              Already have an account? <Text color={c.pink}>Log in</Text>
            </Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: spacing['2xl'], paddingTop: 56, paddingBottom: 48 },
  hero: { alignItems: 'center', marginVertical: spacing.xl },
  logo: { width: 72, height: 72, marginBottom: spacing.md },
  card: {
    borderRadius: 24,
    borderWidth: 1,
    padding: spacing.xl,
  },
  footer: { marginTop: spacing['2xl'], alignItems: 'center' },
});
