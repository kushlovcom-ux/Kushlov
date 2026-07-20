import React, { useState } from 'react';
import { Alert, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Text } from '@/components/ui/Text';
import { Header } from '@/components/common/Header';
import { Screen } from '@/components/common/Screen';
import { authApi } from '@/api/auth';
import { getErrorMessage } from '@/api/client';
import { isValidPassword } from '@/utils/validation';
import { spacing } from '@/theme';
import type { AuthStackParamList } from '@/navigation/types';

type Props = NativeStackScreenProps<AuthStackParamList, 'ResetPassword'>;

export function ResetPasswordScreen({ navigation, route }: Props) {
  const [token, setToken] = useState(route.params?.token ?? '');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ token?: string; password?: string }>({});

  const submit = async () => {
    const next: typeof errors = {};
    if (!token.trim()) next.token = 'Reset token is required';
    if (!isValidPassword(password)) next.password = 'At least 8 characters';
    setErrors(next);
    if (Object.keys(next).length) return;
    setLoading(true);
    try {
      await authApi.resetPassword(token.trim(), password);
      Alert.alert('Password updated', 'You can log in with your new password.', [
        { text: 'Log in', onPress: () => navigation.navigate('Login') },
      ]);
    } catch (err) {
      Alert.alert('Error', getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen scroll>
      <Header title="Reset password" onBack={() => navigation.goBack()} />
      <Text muted style={{ marginBottom: spacing.lg }}>
        Paste the token from your email and choose a new password.
      </Text>
      <Input label="Reset token" value={token} onChangeText={setToken} error={errors.token} />
      <View style={{ height: spacing.md }} />
      <Input
        label="New password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        error={errors.password}
      />
      <View style={{ height: spacing.xl }} />
      <Button title="Update password" onPress={submit} loading={loading} />
    </Screen>
  );
}
