import React, { useState } from 'react';
import {
  Alert,
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
import { authApi } from '@/api/auth';
import { getErrorMessage } from '@/api/client';
import { useThemeColors } from '@/hooks/useThemeColors';
import { isValidEmail } from '@/utils/validation';
import { spacing } from '@/theme';
import type { AuthStackParamList } from '@/navigation/types';

type Props = NativeStackScreenProps<AuthStackParamList, 'ForgotPassword'>;

export function ForgotPasswordScreen({ navigation }: Props) {
  const c = useThemeColors();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    if (!isValidEmail(email)) {
      setError('Enter a valid email');
      return;
    }
    setError('');
    setLoading(true);
    try {
      await authApi.forgotPassword(email.trim());
      Alert.alert('Check your email', 'If an account exists, we sent reset instructions.', [
        { text: 'OK', onPress: () => navigation.navigate('Login') },
      ]);
    } catch (err) {
      Alert.alert('Error', getErrorMessage(err));
    } finally {
      setLoading(false);
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
            <Text variant="display">Forgot password</Text>
            <Text muted style={{ marginTop: 8 }}>
              Enter your email and we&apos;ll send a reset link.
            </Text>
          </View>

          <View
            style={[
              styles.card,
              { backgroundColor: c.card, borderColor: c.border, shadowColor: c.primary },
            ]}
          >
            <Input
              label="Email"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              error={error}
              placeholder="you@email.com"
            />
            <View style={{ height: spacing.xl }} />
            <Button title="Send reset link" onPress={submit} loading={loading} fullWidth size="lg" />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: spacing['2xl'], paddingTop: 56, paddingBottom: 48 },
  hero: { marginVertical: spacing.xl },
  card: {
    borderRadius: 28,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing.xl,
    shadowOpacity: 0.18,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 6,
  },
});
