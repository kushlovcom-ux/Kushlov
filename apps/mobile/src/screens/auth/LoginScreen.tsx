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
import { Eye, EyeOff } from 'lucide-react-native';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Text } from '@/components/ui/Text';
import { Screen } from '@/components/common/Screen';
import { getErrorMessage } from '@/api/client';
import { useAuth } from '@/hooks/useAuth';
import { useThemeColors } from '@/hooks/useThemeColors';
import { isValidEmail, isValidPassword } from '@/utils/validation';
import { spacing } from '@/theme';
import type { AuthStackParamList } from '@/navigation/types';

type Props = NativeStackScreenProps<AuthStackParamList, 'Login'>;

export function LoginScreen({ navigation }: Props) {
  const c = useThemeColors();
  const { login, isLoggingIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
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
              secureTextEntry={!showPassword}
              error={errors.password}
              placeholder="Your password"
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
            <Pressable onPress={() => navigation.navigate('ForgotPassword')} style={styles.forgot}>
              <Text variant="caption" color={c.pink}>
                Forgot password?
              </Text>
            </Pressable>
            <Button title="Log in" onPress={submit} loading={isLoggingIn} fullWidth size="lg" />
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
