import React, { useState } from 'react';
import {
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Eye, EyeOff } from 'lucide-react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Button } from '@/components/ui/Button';
import { CountrySelect } from '@/components/ui/CountrySelect';
import { Input } from '@/components/ui/Input';
import { Text } from '@/components/ui/Text';
import { Screen } from '@/components/common/Screen';
import { getErrorMessage } from '@/api/client';
import { DEFAULT_COUNTRY } from '@/constants/countries';
import { useAuth } from '@/hooks/useAuth';
import { useKeyboard } from '@/hooks/useKeyboard';
import { useThemeColors } from '@/hooks/useThemeColors';
import { isValidEmail, isValidPassword, isValidUsername } from '@/utils/validation';
import { spacing } from '@/theme';
import type { AuthStackParamList } from '@/navigation/types';

type Props = NativeStackScreenProps<AuthStackParamList, 'Register'>;

export function RegisterScreen({ navigation }: Props) {
  const c = useThemeColors();
  const keyboard = useKeyboard();
  const { register, isRegistering } = useAuth();
  const [form, setForm] = useState({
    email: '',
    username: '',
    displayName: '',
    password: '',
    confirmPassword: '',
    country: DEFAULT_COUNTRY,
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async () => {
    const next: Record<string, string> = {};
    if (!isValidEmail(form.email)) next.email = 'Enter a valid email';
    if (!isValidUsername(form.username)) next.username = '3–30 letters, numbers, underscore';
    if (form.displayName.trim().length < 2) next.displayName = 'Enter your display name';
    if (!isValidPassword(form.password)) next.password = 'At least 8 characters';
    if (form.confirmPassword !== form.password) next.confirmPassword = 'Passwords do not match';
    if (!form.country.trim()) next.country = 'Select your country';
    setErrors(next);
    if (Object.keys(next).length) return;
    try {
      await register({
        email: form.email.trim(),
        username: form.username.trim(),
        displayName: form.displayName.trim(),
        password: form.password,
        country: form.country.trim(),
        accountType: 'user',
      });
    } catch (err) {
      Alert.alert('Registration failed', getErrorMessage(err));
    }
  };

  return (
    <Screen padded={false}>
      <LinearGradient colors={[...c.gradientNight]} style={StyleSheet.absoluteFill} />
      {/* Android is edge-to-edge since API 35: the window no longer resizes for
          the keyboard, so screens have to reserve the space themselves. */}
      <View style={{ flex: 1, paddingBottom: keyboard.height }}>
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
            <Text variant="display">Join Kushlov</Text>
            <Text muted style={{ marginTop: 8, textAlign: 'center' }}>
              Create your account and start meeting people. Host applications are available after
              signup.
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
              secureTextEntry={!showPassword}
              error={errors.password}
              placeholder="At least 8 characters"
              right={
                <Pressable
                  onPress={() => setShowPassword((v) => !v)}
                  hitSlop={10}
                  accessibilityRole="button"
                  accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? (
                    <EyeOff size={20} color={c.textMuted} />
                  ) : (
                    <Eye size={20} color={c.textMuted} />
                  )}
                </Pressable>
              }
            />
            <View style={{ height: spacing.md }} />
            <Input
              label="Confirm password"
              value={form.confirmPassword}
              onChangeText={(v) => set('confirmPassword', v)}
              secureTextEntry={!showConfirmPassword}
              error={errors.confirmPassword}
              placeholder="Re-enter your password"
              right={
                <Pressable
                  onPress={() => setShowConfirmPassword((v) => !v)}
                  hitSlop={10}
                  accessibilityRole="button"
                  accessibilityLabel={
                    showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'
                  }
                >
                  {showConfirmPassword ? (
                    <EyeOff size={20} color={c.textMuted} />
                  ) : (
                    <Eye size={20} color={c.textMuted} />
                  )}
                </Pressable>
              }
            />
            <View style={{ height: spacing.md }} />
            <CountrySelect
              label="Country"
              value={form.country}
              onChange={(v) => set('country', v)}
              error={errors.country}
              placeholder="Select your country"
            />
            <View style={{ height: spacing['3xl'] }} />
            <Button
              title="Create account"
              onPress={submit}
              loading={isRegistering}
              fullWidth
              size="lg"
            />
          </View>

          <Pressable onPress={() => navigation.navigate('Login')} style={styles.footer}>
            <Text muted>
              Already have an account? <Text color={c.pink}>Log in</Text>
            </Text>
          </Pressable>
        </ScrollView>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: spacing['2xl'], paddingTop: 56, paddingBottom: 48 },
  hero: { alignItems: 'center', marginVertical: spacing.xl },
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
  footer: { marginTop: spacing['2xl'], alignItems: 'center' },
});
