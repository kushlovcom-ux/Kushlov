import React, { useState } from 'react';
import { Alert, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as ImagePicker from 'expo-image-picker';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Text } from '@/components/ui/Text';
import { Header } from '@/components/common/Header';
import { Screen } from '@/components/common/Screen';
import { liveApi } from '@/api/live';
import { getErrorMessage } from '@/api/client';
import { spacing } from '@/theme';
import type { AppStackParamList } from '@/navigation/types';

type Props = NativeStackScreenProps<AppStackParamList, 'GoLive'>;

export function GoLiveScreen({ navigation }: Props) {
  const [title, setTitle] = useState('');
  const [thumb, setThumb] = useState<string | undefined>();
  const [loading, setLoading] = useState(false);

  const pickThumb = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
    });
    if (!res.canceled && res.assets[0]) setThumb(res.assets[0].uri);
  };

  const start = async () => {
    if (title.trim().length < 3) {
      Alert.alert('Title required', 'Give your stream a title.');
      return;
    }
    setLoading(true);
    try {
      const room = await liveApi.start({ title: title.trim(), thumbnailUri: thumb });
      if (!room.id) throw new Error('Live stream id missing from server response');
      navigation.replace('LiveRoom', { liveId: room.id });
    } catch (err) {
      Alert.alert('Could not go live', getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen scroll>
      <Header title="Go live" onBack={() => navigation.goBack()} />
      <Text muted style={{ marginBottom: spacing.lg }}>
        Start a stream for your audience. Host approval required.
      </Text>
      <Input label="Title" value={title} onChangeText={setTitle} placeholder="Tonight with…" />
      <View style={{ gap: spacing.lg, marginTop: spacing.xl }}>
        <Button
          title={thumb ? 'Change thumbnail' : 'Add thumbnail'}
          variant="secondary"
          fullWidth
          onPress={pickThumb}
        />
        <Button title="Start live" fullWidth onPress={start} loading={loading} />
      </View>
    </Screen>
  );
}
