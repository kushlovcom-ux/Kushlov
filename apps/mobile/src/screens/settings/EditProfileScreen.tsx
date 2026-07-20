import React, { useEffect, useState } from 'react';
import { Alert, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useQuery } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Header } from '@/components/common/Header';
import { Screen } from '@/components/common/Screen';
import { usersApi } from '@/api/users';
import { getErrorMessage } from '@/api/client';
import { queryKeys } from '@/constants/queryKeys';
import { useAuth } from '@/hooks/useAuth';
import { spacing } from '@/theme';
import type { AppStackParamList } from '@/navigation/types';

type Props = NativeStackScreenProps<AppStackParamList, 'EditProfile'>;

export function EditProfileScreen({ navigation }: Props) {
  const { user, setUser, refreshMe } = useAuth();
  const profile = useQuery({
    queryKey: queryKeys.profile,
    queryFn: () => usersApi.getProfile(),
  });
  const [displayName, setDisplayName] = useState(user?.displayName ?? '');
  const [bio, setBio] = useState(user?.bio ?? '');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (profile.data?.bio) setBio(profile.data.bio);
  }, [profile.data]);

  const save = async () => {
    setLoading(true);
    try {
      const updated = await usersApi.updateMe({ displayName: displayName.trim(), bio });
      await usersApi.updateProfile({ bio });
      setUser(updated);
      await refreshMe();
      Alert.alert('Saved', 'Your profile was updated.');
      navigation.goBack();
    } catch (err) {
      Alert.alert('Error', getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const uploadAvatar = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.85,
    });
    if (res.canceled || !res.assets[0]) return;
    try {
      const updated = await usersApi.uploadAvatar(res.assets[0].uri);
      setUser(updated);
    } catch (err) {
      Alert.alert('Upload failed', getErrorMessage(err));
    }
  };

  return (
    <Screen scroll>
      <Header title="Edit profile" onBack={() => navigation.goBack()} />
      <Button title="Change avatar" variant="secondary" onPress={uploadAvatar} />
      <View style={{ height: spacing.lg }} />
      <Input label="Display name" value={displayName} onChangeText={setDisplayName} />
      <View style={{ height: spacing.md }} />
      <Input
        label="Bio"
        value={bio}
        onChangeText={setBio}
        multiline
        style={{ minHeight: 100, textAlignVertical: 'top' }}
      />
      <Button title="Save" onPress={save} loading={loading} style={{ marginTop: spacing.xl }} />
    </Screen>
  );
}
