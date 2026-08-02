import React, { useState } from 'react';
import { Alert, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as ImagePicker from 'expo-image-picker';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Text } from '@/components/ui/Text';
import { Header } from '@/components/common/Header';
import { Screen } from '@/components/common/Screen';
import { getErrorMessage } from '@/api/client';
import { verificationApi } from '@/api/verification';
import { queryKeys } from '@/constants/queryKeys';
import { Gender } from '@/types';
import { spacing } from '@/theme';
import type { AppStackParamList } from '@/navigation/types';

type Props = NativeStackScreenProps<AppStackParamList, 'BecomeHost'>;

export function BecomeHostScreen({ navigation }: Props) {
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const me = useQuery({
    queryKey: queryKeys.verification,
    queryFn: () => verificationApi.me(),
  });

  const [basic, setBasic] = useState({
    name: '',
    username: '',
    bio: '',
    gender: Gender.Female,
    dob: '1998-01-01',
    country: 'IN',
  });
  const [govId, setGovId] = useState<string | null>(null);
  const [selfie, setSelfie] = useState<string | null>(null);

  const pick = async (setter: (uri: string) => void) => {
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.85,
    });
    if (!res.canceled && res.assets[0]) setter(res.assets[0].uri);
  };

  const submitBasic = async () => {
    setLoading(true);
    try {
      await verificationApi.submitBasic({
        ...basic,
        name: basic.name.trim(),
        username: basic.username.trim(),
        languages: ['en'],
      });
      setStep(1);
    } catch (err) {
      Alert.alert('Step 1 failed', getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const submitDocs = async () => {
    if (!govId) {
      Alert.alert('Required', 'Upload a government ID photo.');
      return;
    }
    setLoading(true);
    try {
      await verificationApi.submitDocuments({ governmentIdUri: govId });
      setStep(2);
    } catch (err) {
      Alert.alert('Step 2 failed', getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const submitIdentity = async () => {
    if (!selfie) {
      Alert.alert('Required', 'Upload a clear selfie.');
      return;
    }
    setLoading(true);
    try {
      await verificationApi.submitIdentity({ selfieUris: [selfie] });
      Alert.alert('Submitted', 'We will review your host application shortly.', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (err) {
      Alert.alert('Step 3 failed', getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen scroll>
      <Header title="Become a host" onBack={() => navigation.goBack()} />
      <Text muted style={{ marginBottom: spacing.md }}>
        Step {step + 1} of 3
        {me.data?.status ? ` · status: ${String(me.data.status)}` : ''}
      </Text>

      {step === 0 ? (
        <>
          <Input label="Legal name" value={basic.name} onChangeText={(v) => setBasic((s) => ({ ...s, name: v }))} />
          <View style={{ height: spacing.md }} />
          <Input label="Host username" value={basic.username} onChangeText={(v) => setBasic((s) => ({ ...s, username: v }))} autoCapitalize="none" />
          <View style={{ height: spacing.md }} />
          <Input label="Bio" value={basic.bio} onChangeText={(v) => setBasic((s) => ({ ...s, bio: v }))} />
          <View style={{ height: spacing.md }} />
          <Input label="Date of birth (YYYY-MM-DD)" value={basic.dob} onChangeText={(v) => setBasic((s) => ({ ...s, dob: v }))} />
          <View style={{ height: spacing.md }} />
          <Input label="Country" value={basic.country} onChangeText={(v) => setBasic((s) => ({ ...s, country: v }))} />
          <View style={{ height: spacing.xl }} />
          <Button title="Continue" onPress={submitBasic} loading={loading} fullWidth />
        </>
      ) : null}

      {step === 1 ? (
        <>
          <Text style={{ marginBottom: spacing.md }}>Upload government ID</Text>
          <Button
            title={govId ? 'Change ID photo' : 'Pick ID photo'}
            variant="secondary"
            onPress={() => pick(setGovId)}
          />
          <Button title="Continue" onPress={submitDocs} loading={loading} style={{ marginTop: spacing.xl }} />
        </>
      ) : null}

      {step === 2 ? (
        <>
          <Text style={{ marginBottom: spacing.md }}>Upload a selfie for identity check</Text>
          <Button
            title={selfie ? 'Change selfie' : 'Pick selfie'}
            variant="secondary"
            onPress={() => pick(setSelfie)}
          />
          <Button title="Submit application" onPress={submitIdentity} loading={loading} style={{ marginTop: spacing.xl }} />
        </>
      ) : null}
    </Screen>
  );
}
