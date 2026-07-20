import React from 'react';
import { Alert } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Text } from '@/components/ui/Text';
import { Button } from '@/components/ui/Button';
import { Header } from '@/components/common/Header';
import { Screen } from '@/components/common/Screen';
import { spacing } from '@/theme';
import type { AppStackParamList } from '@/navigation/types';

type Props = NativeStackScreenProps<AppStackParamList, 'Privacy'>;

export function PrivacyScreen({ navigation }: Props) {
  return (
    <Screen scroll>
      <Header title="Privacy" onBack={() => navigation.goBack()} />
      <Text muted style={{ marginBottom: spacing.lg }}>
        Control who can find you and manage blocked accounts.
      </Text>
      <Button
        title="Manage blocked users"
        variant="secondary"
        onPress={() => navigation.navigate('BlockedUsers')}
      />
      <Button
        title="Report a safety concern"
        variant="outline"
        style={{ marginTop: spacing.md }}
        onPress={() => navigation.navigate('Contact')}
      />
      <Button
        title="Learn more"
        variant="ghost"
        style={{ marginTop: spacing.md }}
        onPress={() => Alert.alert('Privacy', 'Your data is used to power matches, calls, and safety tools on Kushlov.')}
      />
    </Screen>
  );
}
