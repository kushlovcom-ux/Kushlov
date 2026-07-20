import React, { useEffect, useState } from 'react';
import { Alert, FlatList, StyleSheet, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Text } from '@/components/ui/Text';
import { Header } from '@/components/common/Header';
import { Screen } from '@/components/common/Screen';
import { ErrorView } from '@/components/ui/ErrorView';
import { liveApi } from '@/api/live';
import { getErrorMessage } from '@/api/client';
import { queryKeys } from '@/constants/queryKeys';
import { connectRoom, disconnectRoom, ensureLiveKitNative } from '@/services/livekit';
import { useThemeColors } from '@/hooks/useThemeColors';
import { spacing } from '@/theme';
import type { AppStackParamList } from '@/navigation/types';
import type { Room } from 'livekit-client';

type Props = NativeStackScreenProps<AppStackParamList, 'LiveRoom'>;

export function LiveRoomScreen({ navigation, route }: Props) {
  const { liveId } = route.params;
  const c = useThemeColors();
  const [chat, setChat] = useState('');
  const [messages, setMessages] = useState<string[]>([]);
  const [room, setRoom] = useState<Room | null>(null);
  const [nativeOk, setNativeOk] = useState<boolean | null>(null);

  const live = useQuery({
    queryKey: queryKeys.liveRoom(liveId),
    queryFn: () => liveApi.get(liveId),
  });

  const join = useMutation({
    mutationFn: () => liveApi.join(liveId),
    onSuccess: async (data) => {
      const ok = await ensureLiveKitNative();
      setNativeOk(ok);
      if (ok && data.token && data.livekitUrl) {
        try {
          const r = await connectRoom({ url: data.livekitUrl, token: data.token });
          setRoom(r);
        } catch (err) {
          Alert.alert('LiveKit', getErrorMessage(err));
        }
      }
    },
  });

  useEffect(() => {
    join.mutate();
    return () => {
      liveApi.leave(liveId).catch(() => undefined);
      disconnectRoom(room).catch(() => undefined);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveId]);

  const sendChat = async () => {
    const msg = chat.trim();
    if (!msg) return;
    try {
      await liveApi.chat(liveId, msg);
      setMessages((m) => [...m, msg]);
      setChat('');
    } catch (err) {
      Alert.alert('Chat', getErrorMessage(err));
    }
  };

  if (live.isError) {
    return (
      <Screen>
        <Header title="Live" onBack={() => navigation.goBack()} />
        <ErrorView message={getErrorMessage(live.error)} onRetry={() => live.refetch()} />
      </Screen>
    );
  }

  return (
    <Screen>
      <Header title={live.data?.title ?? 'Live'} onBack={() => navigation.goBack()} />
      <View style={[styles.stage, { backgroundColor: c.elevated }]}>
        <Text variant="h3">{live.data?.host?.displayName ?? 'Host'}</Text>
        <Text muted>
          {live.data?.viewerCount ?? 0} watching · {live.data?.likeCount ?? 0} likes
        </Text>
        {nativeOk === false ? (
          <Text muted style={{ marginTop: 12, textAlign: 'center' }}>
            Video requires a custom native build. Chat and reactions still work.
          </Text>
        ) : null}
      </View>
      <View style={styles.row}>
        <Button title="Like" size="sm" onPress={() => liveApi.like(liveId)} />
      </View>
      <FlatList
        data={messages}
        keyExtractor={(_, i) => String(i)}
        style={{ flex: 1, marginTop: spacing.md }}
        renderItem={({ item }) => <Text style={{ marginBottom: 6 }}>{item}</Text>}
        ListEmptyComponent={<Text muted>No chat yet</Text>}
      />
      <View style={styles.chatRow}>
        <View style={{ flex: 1 }}>
          <Input value={chat} onChangeText={setChat} placeholder="Say something…" />
        </View>
        <Button title="Send" size="sm" onPress={sendChat} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  stage: {
    height: 220,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  row: { flexDirection: 'row', marginTop: spacing.md },
  chatRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
});
