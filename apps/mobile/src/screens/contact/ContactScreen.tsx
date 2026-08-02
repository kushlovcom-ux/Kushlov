import React, { useState } from 'react';
import { Alert, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Text } from '@/components/ui/Text';
import { Header } from '@/components/common/Header';
import { Screen } from '@/components/common/Screen';
import { contactApi } from '@/api/contact';
import { getErrorMessage } from '@/api/client';
import { queryKeys } from '@/constants/queryKeys';
import { formatRelative } from '@/utils/format';
import { spacing } from '@/theme';
import type { AppStackParamList } from '@/navigation/types';

type Props = NativeStackScreenProps<AppStackParamList, 'Contact'>;

export function ContactScreen({ navigation }: Props) {
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const inquiries = useQuery({
    queryKey: queryKeys.contact,
    queryFn: () => contactApi.list({ limit: 20 }),
  });

  const submit = async () => {
    if (subject.trim().length < 3 || message.trim().length < 10) {
      Alert.alert('Incomplete', 'Add a subject and a detailed message.');
      return;
    }
    setLoading(true);
    try {
      await contactApi.submit({
        subject: subject.trim(),
        category: 'general',
        message: message.trim(),
      });
      setSubject('');
      setMessage('');
      inquiries.refetch();
      Alert.alert('Sent', 'Our team will get back to you soon.');
    } catch (err) {
      Alert.alert('Error', getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen scroll>
      <Header title="Contact" onBack={() => navigation.goBack()} />
      <Input label="Subject" value={subject} onChangeText={setSubject} />
      <View style={{ height: spacing.md }} />
      <Input
        label="Message"
        value={message}
        onChangeText={setMessage}
        multiline
        style={{ minHeight: 120, textAlignVertical: 'top' }}
      />
      <View style={{ height: spacing.xl }} />
      <Button title="Send" onPress={submit} loading={loading} fullWidth />

      <Text variant="h3" style={{ marginTop: spacing['2xl'], marginBottom: spacing.md }}>
        Your inquiries
      </Text>
      {(inquiries.data?.items ?? []).map((i) => (
        <View key={i.id} style={{ marginBottom: spacing.md }}>
          <Text variant="bodyBold">{i.subject}</Text>
          <Text muted variant="caption">
            {i.status ?? 'open'} · {formatRelative(i.createdAt)}
          </Text>
        </View>
      ))}
    </Screen>
  );
}
