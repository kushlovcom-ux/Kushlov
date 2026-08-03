import React, { useMemo, useState } from 'react';
import { Alert, Image, View } from 'react-native';
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
import { useThemeColors } from '@/hooks/useThemeColors';
import { spacing } from '@/theme';
import type { AppStackParamList } from '@/navigation/types';

type Props = NativeStackScreenProps<AppStackParamList, 'BecomeHost'>;

const SELFIE_COUNT = 3;
const DEFAULT_SELFIE_INSTRUCTIONS = [
  'Look straight into the camera',
  'Turn your head to the left',
  'Smile naturally',
];
const DEFAULT_VIDEO_INSTRUCTION =
  "Hold a paper with today's date and say your full name clearly.";

async function ensureCameraPermission() {
  const cam = await ImagePicker.requestCameraPermissionsAsync();
  if (!cam.granted) {
    throw new Error('Camera permission is required for live verification.');
  }
}

export function BecomeHostScreen({ navigation }: Props) {
  const c = useThemeColors();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const me = useQuery({
    queryKey: queryKeys.verification,
    queryFn: () => verificationApi.me(),
  });
  const instructionsQuery = useQuery({
    queryKey: queryKeys.verificationInstructions,
    queryFn: () => verificationApi.instructions(),
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
  const [selfies, setSelfies] = useState<Array<string | null>>([null, null, null]);
  const [videoUri, setVideoUri] = useState<string | null>(null);

  const instructions = instructionsQuery.data ?? [];
  const selfieInstructions = useMemo(() => {
    const fromAdmin = instructions
      .filter((i) => i.category === 'selfie')
      .map((i) => i.text)
      .filter(Boolean);
    return Array.from({ length: SELFIE_COUNT }, (_, i) =>
      fromAdmin[i] ?? DEFAULT_SELFIE_INSTRUCTIONS[i] ?? `Selfie ${i + 1}`,
    );
  }, [instructions]);

  const videoInstruction =
    instructions.find((i) => i.category === 'video')?.text ?? DEFAULT_VIDEO_INSTRUCTION;

  const pickGovId = async () => {
    try {
      await ensureCameraPermission();
      const res = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        quality: 0.85,
      });
      if (!res.canceled && res.assets[0]) setGovId(res.assets[0].uri);
    } catch (err) {
      Alert.alert('Camera', getErrorMessage(err));
    }
  };

  const captureLiveSelfie = async (index: number) => {
    try {
      await ensureCameraPermission();
      const res = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        quality: 0.85,
        allowsEditing: false,
      });
      if (!res.canceled && res.assets[0]) {
        setSelfies((prev) => {
          const next = [...prev];
          next[index] = res.assets[0]!.uri;
          return next;
        });
      }
    } catch (err) {
      Alert.alert('Live selfie', getErrorMessage(err));
    }
  };

  const recordLiveVideo = async () => {
    try {
      await ensureCameraPermission();
      const res = await ImagePicker.launchCameraAsync({
        mediaTypes: ['videos'],
        videoMaxDuration: 15,
        allowsEditing: false,
        quality: 0.6,
      });
      if (!res.canceled && res.assets[0]) setVideoUri(res.assets[0].uri);
    } catch (err) {
      Alert.alert('Live video', getErrorMessage(err));
    }
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
      Alert.alert('Required', 'Capture a government ID photo with your camera.');
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
    const selfieUris = selfies.filter((u): u is string => !!u);
    if (selfieUris.length < SELFIE_COUNT) {
      Alert.alert('Required', 'Capture all three live selfies using your camera.');
      return;
    }
    if (!videoUri) {
      Alert.alert('Required', 'Record a live verification video using your camera.');
      return;
    }
    setLoading(true);
    try {
      await verificationApi.submitIdentity({
        selfieUris,
        selfieInstructions,
        videoUri,
        videoInstruction,
      });
      Alert.alert('Submitted', 'We will review your host application shortly.', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (err) {
      Alert.alert('Step 3 failed', getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const allSelfiesDone = selfies.every(Boolean);

  return (
    <Screen scroll>
      <Header title="Become a host" onBack={() => navigation.goBack()} />
      <Text muted style={{ marginBottom: spacing.md }}>
        Step {step + 1} of 3
        {me.data?.status ? ` · status: ${String(me.data.status)}` : ''}
      </Text>

      {step === 0 ? (
        <>
          <Input
            label="Legal name"
            value={basic.name}
            onChangeText={(v) => setBasic((s) => ({ ...s, name: v }))}
          />
          <View style={{ height: spacing.md }} />
          <Input
            label="Host username"
            value={basic.username}
            onChangeText={(v) => setBasic((s) => ({ ...s, username: v }))}
            autoCapitalize="none"
          />
          <View style={{ height: spacing.md }} />
          <Input
            label="Bio"
            value={basic.bio}
            onChangeText={(v) => setBasic((s) => ({ ...s, bio: v }))}
          />
          <View style={{ height: spacing.md }} />
          <Input
            label="Date of birth (YYYY-MM-DD)"
            value={basic.dob}
            onChangeText={(v) => setBasic((s) => ({ ...s, dob: v }))}
          />
          <View style={{ height: spacing.md }} />
          <Input
            label="Country"
            value={basic.country}
            onChangeText={(v) => setBasic((s) => ({ ...s, country: v }))}
          />
          <View style={{ height: spacing.xl }} />
          <Button title="Continue" onPress={submitBasic} loading={loading} fullWidth size="lg" />
        </>
      ) : null}

      {step === 1 ? (
        <>
          <Text variant="h2" color={c.pink} style={{ marginBottom: spacing.md }}>
            Upload government ID
          </Text>
          <Text muted style={{ marginBottom: spacing.md }}>
            Use your camera to photograph your government ID. Gallery uploads are not allowed.
          </Text>
          {govId ? (
            <Image
              source={{ uri: govId }}
              style={{
                width: '100%',
                height: 180,
                borderRadius: 16,
                marginBottom: spacing.md,
                backgroundColor: c.elevated,
              }}
              resizeMode="cover"
            />
          ) : null}
          <Button
            title={govId ? 'Retake ID photo' : 'Pick ID photo'}
            variant="primary"
            fullWidth
            size="lg"
            onPress={() => void pickGovId()}
          />
          <View style={{ height: spacing['2xl'] }} />
          <Button
            title="Continue"
            onPress={submitDocs}
            loading={loading}
            fullWidth
            size="lg"
          />
        </>
      ) : null}

      {step === 2 ? (
        <>
          <Text variant="h2" color={c.pink} style={{ marginBottom: spacing.md }}>
            Upload three selfie for identity check
          </Text>
          <Text muted style={{ marginBottom: spacing.md }}>
            Take three live selfies with your front camera (not from files), then record a short live
            video following the admin instruction.
          </Text>

          {instructions.length > 0 ? (
            <View
              style={{
                borderWidth: 1,
                borderColor: c.border,
                backgroundColor: c.elevated,
                borderRadius: 16,
                padding: spacing.md,
                marginBottom: spacing.lg,
                gap: spacing.sm,
              }}
            >
              <Text variant="captionBold" color={c.pink}>
                Admin instructions
              </Text>
              {instructions.map((ins) => (
                <Text key={ins._id ?? ins.id ?? ins.text} muted style={{ lineHeight: 18 }}>
                  [{ins.category}] {ins.text}
                </Text>
              ))}
            </View>
          ) : null}

          {selfieInstructions.map((instruction, index) => (
            <View key={`selfie-${index}`} style={{ marginBottom: spacing.lg }}>
              <Text variant="captionBold" color={c.pink} style={{ marginBottom: spacing.xs }}>
                Live selfie {index + 1} of {SELFIE_COUNT}
              </Text>
              <Text muted style={{ marginBottom: spacing.sm }}>
                {instruction}
              </Text>
              {selfies[index] ? (
                <Image
                  source={{ uri: selfies[index]! }}
                  style={{
                    width: '100%',
                    height: 160,
                    borderRadius: 16,
                    marginBottom: spacing.sm,
                    backgroundColor: c.elevated,
                  }}
                  resizeMode="cover"
                />
              ) : null}
              <Button
                title={selfies[index] ? `Retake selfie ${index + 1}` : `Pick selfie ${index + 1}`}
                variant="primary"
                fullWidth
                size="lg"
                onPress={() => void captureLiveSelfie(index)}
              />
            </View>
          ))}

          <Text variant="h2" color={c.pink} style={{ marginBottom: spacing.sm }}>
            Live verification video
          </Text>
          <Text muted style={{ marginBottom: spacing.md }}>
            {videoInstruction}
          </Text>
          <Text muted style={{ marginBottom: spacing.md }}>
            Record 3–15 seconds with your front camera. Do not upload a file from gallery.
          </Text>
          {videoUri ? (
            <Text color={c.success} style={{ marginBottom: spacing.sm }}>
              Live video captured. You can retake before submitting.
            </Text>
          ) : null}
          <Button
            title={videoUri ? 'Retake live video' : 'Record live video'}
            variant="primary"
            fullWidth
            size="lg"
            onPress={() => void recordLiveVideo()}
            disabled={!allSelfiesDone}
          />

          <View style={{ height: spacing['2xl'] }} />
          <Button
            title="Submit application"
            onPress={submitIdentity}
            loading={loading}
            fullWidth
            size="lg"
            disabled={!allSelfiesDone || !videoUri}
          />
        </>
      ) : null}
    </Screen>
  );
}
