import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Text } from '@/components/ui/Text';
import { Avatar } from '@/components/ui/Avatar';
import { Header } from '@/components/common/Header';
import { Screen } from '@/components/common/Screen';
import { ErrorView } from '@/components/ui/ErrorView';
import { LiveKitStage } from '@/components/live/LiveKitStage';
import { VideoFilterBar, FilterOverlay, type VideoFilterId } from '@/components/calls/VideoFilterBar';
import { liveApi } from '@/api/live';
import { getErrorMessage } from '@/api/client';
import { queryKeys } from '@/constants/queryKeys';
import { useAuth } from '@/hooks/useAuth';
import { useSettings } from '@/hooks/useSettings';
import { useSocket } from '@/providers/SocketProvider';
import { useThemeColors } from '@/hooks/useThemeColors';
import { spacing } from '@/theme';
import { SocketEvents } from '@/types';
import type { AppStackParamList } from '@/navigation/types';
import type { Room } from 'livekit-client';

type Props = NativeStackScreenProps<AppStackParamList, 'LiveRoom'>;

type ChatMsg = {
  id?: string;
  user?: { displayName?: string; avatarUrl?: string };
  message: string;
};

function hostIdOf(live: {
  hostId?: string;
  host?: string | { id?: string; _id?: string };
}): string | undefined {
  if (live.hostId) return String(live.hostId);
  if (!live.host) return undefined;
  if (typeof live.host === 'string') return live.host;
  return live.host.id ?? live.host._id;
}

function coHostIdOf(live: {
  coHostId?: string;
  coHost?: string | { id?: string; _id?: string };
}): string | undefined {
  if (live.coHostId) return String(live.coHostId);
  if (!live.coHost) return undefined;
  if (typeof live.coHost === 'string') return live.coHost;
  return live.coHost.id ?? live.coHost._id;
}

export function LiveRoomScreen({ navigation, route }: Props) {
  const { liveId } = route.params;
  const c = useThemeColors();
  const { user } = useAuth();
  const socket = useSocket();
  const settings = useSettings();
  const [chat, setChat] = useState('');
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [viewers, setViewers] = useState(0);
  const [showViewers, setShowViewers] = useState(false);
  const [showColive, setShowColive] = useState(false);
  const [token, setToken] = useState<string>();
  const [livekitUrl, setLivekitUrl] = useState<string>();
  const [connecting, setConnecting] = useState(true);
  const [connectError, setConnectError] = useState<string | null>(null);
  const [isCoHost, setIsCoHost] = useState(false);
  const [coHostName, setCoHostName] = useState<string | null>(null);
  const [room, setRoom] = useState<Room | null>(null);
  const [filter, setFilter] = useState<VideoFilterId>('none');

  const onRoom = useCallback((r: Room | null) => setRoom(r), []);

  const live = useQuery({
    queryKey: queryKeys.liveRoom(liveId),
    queryFn: () => liveApi.get(liveId),
  });

  const isHost = useMemo(() => {
    if (!live.data || !user?.id) return false;
    return hostIdOf(live.data) === user.id;
  }, [live.data, user?.id]);

  const canPublish = isHost || isCoHost;

  const chatCost = Number(
    (settings.data?.rates as { liveChatPerMessage?: number } | undefined)?.liveChatPerMessage ?? 0,
  );

  const viewerList = useQuery({
    queryKey: [...queryKeys.liveRoom(liveId), 'viewers'] as const,
    queryFn: () => liveApi.viewers(liveId),
    enabled: Boolean(isHost && showViewers),
    refetchInterval: showViewers ? 8_000 : false,
  });

  const otherLives = useQuery({
    queryKey: [...queryKeys.live, 'colive-targets'] as const,
    queryFn: () => liveApi.list({ limit: 40 }),
    enabled: Boolean(isHost && showColive),
  });

  const coliveTargets = useMemo(() => {
    return (otherLives.data?.items ?? []).filter((r) => {
      const h = hostIdOf(r);
      return r.id !== liveId && h && h !== user?.id;
    });
  }, [otherLives.data?.items, liveId, user?.id]);

  useEffect(() => {
    if (!live.data || !user?.id) return;
    const cid = coHostIdOf(live.data);
    if (cid) {
      setCoHostName(
        typeof live.data.coHost === 'object' && live.data.coHost && 'displayName' in live.data.coHost
          ? (live.data.coHost as { displayName?: string }).displayName ?? 'Co-host'
          : 'Co-host',
      );
      if (cid === user.id) setIsCoHost(true);
    }
  }, [live.data, user?.id]);

  useEffect(() => {
    if (!live.data) return;
    let cancelled = false;
    setConnecting(true);
    setConnectError(null);
    (async () => {
      try {
        const data = isHost
          ? await liveApi.hostToken(liveId)
          : isCoHost
            ? await liveApi.coliveAccept(liveId)
            : await liveApi.join(liveId);
        if (cancelled) return;
        if (data.token) setToken(data.token);
        if (data.livekitUrl) setLivekitUrl(data.livekitUrl);
        if (
          'viewerCount' in data &&
          typeof (data as { viewerCount?: number }).viewerCount === 'number'
        ) {
          setViewers((data as { viewerCount: number }).viewerCount);
        } else if (live.data.viewerCount != null) {
          setViewers(live.data.viewerCount);
        }
      } catch (err) {
        if (!cancelled) setConnectError(getErrorMessage(err));
      } finally {
        if (!cancelled) setConnecting(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [live.data, liveId, isHost, isCoHost]);

  useEffect(() => {
    socket.emit(SocketEvents.LiveJoin, { liveId });
    const offChat = socket.on(SocketEvents.LiveChat, (...args: unknown[]) => {
      const m = args[0] as ChatMsg & { _id?: string; id?: string };
      if (m?.message) {
        setMessages((prev) => [
          ...prev,
          { id: m.id ?? m._id, user: m.user, message: m.message },
        ]);
      }
    });
    const offCount = socket.on(SocketEvents.LiveViewerCount, (...args: unknown[]) => {
      const p = args[0] as { viewerCount?: number };
      if (p?.viewerCount != null) setViewers(p.viewerCount);
    });
    const offLeave = socket.on(SocketEvents.LiveLeave, (...args: unknown[]) => {
      const p = args[0] as { ended?: boolean };
      if (p?.ended) {
        Alert.alert('Live ended', 'The host ended this stream.', [
          { text: 'OK', onPress: () => navigation.goBack() },
        ]);
      }
    });
    const offColiveAccept = socket.on(SocketEvents.LiveColiveAccept, (...args: unknown[]) => {
      const p = args[0] as { coHost?: { displayName?: string; id?: string } };
      setCoHostName(p.coHost?.displayName ?? 'Co-host');
      if (p.coHost?.id === user?.id) setIsCoHost(true);
    });
    const offColiveLeave = socket.on(SocketEvents.LiveColiveLeave, () => {
      setCoHostName(null);
      if (isCoHost && !isHost) navigation.goBack();
    });
    return () => {
      socket.emit(SocketEvents.LiveLeave, { liveId });
      offChat();
      offCount();
      offLeave();
      offColiveAccept();
      offColiveLeave();
      if (!isHost && !isCoHost) liveApi.leave(liveId).catch(() => undefined);
    };
  }, [liveId, socket, navigation, isHost, isCoHost, user?.id]);

  const leave = async () => {
    try {
      if (isCoHost && !isHost) await liveApi.coliveLeave(liveId);
      else if (isHost) await liveApi.end(liveId);
      else await liveApi.leave(liveId);
    } catch {
      // ignore
    }
    navigation.goBack();
  };

  const sendChat = async () => {
    const msg = chat.trim();
    if (!msg) return;
    try {
      await liveApi.chat(liveId, msg);
      setChat('');
    } catch (err) {
      Alert.alert('Chat', getErrorMessage(err));
    }
  };

  const inviteColive = async (hostId: string) => {
    try {
      await liveApi.coliveInvite(liveId, hostId);
      Alert.alert('Invite sent', 'Waiting for the host to accept.');
      setShowColive(false);
    } catch (err) {
      Alert.alert('Co-live', getErrorMessage(err));
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
      <Header
        title={live.data?.title ?? 'Live'}
        onBack={() => navigation.goBack()}
        right={
          <Pressable onPress={leave}>
            <Text color={c.danger} variant="bodyBold">
              {isHost ? 'End' : isCoHost ? 'Leave co-live' : 'Leave'}
            </Text>
          </Pressable>
        }
      />

      <View style={styles.meta}>
        <Text variant="caption" muted>
          {live.data?.host?.displayName ?? 'Host'}
          {coHostName ? ` + ${coHostName}` : ''} · {viewers} watching
        </Text>
        <View style={{ flexDirection: 'row', gap: 12 }}>
          {isHost ? (
            <Pressable onPress={() => setShowColive(true)}>
              <Text variant="caption" color={c.pink}>
                Co-host
              </Text>
            </Pressable>
          ) : null}
          {isHost ? (
            <Pressable onPress={() => setShowViewers(true)}>
              <Text variant="caption" color={c.pink}>
                Who's watching
              </Text>
            </Pressable>
          ) : null}
        </View>
      </View>

      <View style={styles.stageWrap}>
        {connectError ? (
          <View style={[styles.stageFallback, { backgroundColor: c.elevated }]}>
            <Text muted style={{ textAlign: 'center' }}>
              {connectError}
            </Text>
            <Button title="Retry" size="sm" onPress={() => live.refetch()} style={{ marginTop: 12 }} />
          </View>
        ) : token && livekitUrl ? (
          <View style={{ flex: 1 }}>
            <LiveKitStage
              token={token}
              serverUrl={livekitUrl}
              publish={canPublish}
              isHost={canPublish}
              onDisconnected={leave}
              onRoom={onRoom}
              style={{ flex: 1 }}
            />
            <FilterOverlay filter={filter} />
          </View>
        ) : (
          <View style={[styles.stageFallback, { backgroundColor: c.elevated }]}>
            <Text muted>{connecting ? 'Connecting…' : 'No media token'}</Text>
          </View>
        )}
      </View>

      {canPublish ? <VideoFilterBar room={room} onFilterChange={setFilter} /> : null}

      <View style={styles.row}>
        <Button title="Like" size="sm" onPress={() => liveApi.like(liveId).catch(() => undefined)} />
      </View>

      <FlatList
        data={messages}
        keyExtractor={(item, i) => item.id ?? String(i)}
        style={{ flex: 1, marginTop: spacing.md }}
        renderItem={({ item }) => (
          <Text style={{ marginBottom: 6 }}>
            <Text color={c.pink} variant="bodyBold">
              {item.user?.displayName ?? 'User'}:{' '}
            </Text>
            {item.message}
          </Text>
        )}
        ListEmptyComponent={<Text muted>No chat yet</Text>}
      />

      <View style={styles.chatRow}>
        <View style={{ flex: 1 }}>
          <Input
            value={chat}
            onChangeText={setChat}
            placeholder={
              !canPublish && chatCost > 0 ? `Say something… (${chatCost}♦/msg)` : 'Say something…'
            }
          />
        </View>
        <Button title="Send" size="sm" onPress={sendChat} />
      </View>
      {!canPublish && chatCost > 0 ? (
        <Text variant="tiny" muted style={{ marginBottom: 4 }}>
          Live chat costs {chatCost} diamond{chatCost === 1 ? '' : 's'} per message
        </Text>
      ) : null}

      <Modal visible={showViewers} transparent animationType="fade" onRequestClose={() => setShowViewers(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setShowViewers(false)}>
          <Pressable
            style={[styles.modalCard, { backgroundColor: c.card, borderColor: c.border }]}
            onPress={() => undefined}
          >
            <Text variant="h3" style={{ marginBottom: spacing.md }}>
              Watching now
            </Text>
            {viewerList.isLoading ? (
              <Text muted>Loading…</Text>
            ) : (viewerList.data?.viewers?.length ?? 0) === 0 ? (
              <Text muted>No viewers yet</Text>
            ) : (
              viewerList.data!.viewers.map((v) => (
                <View key={v.id} style={styles.viewerRow}>
                  <Avatar uri={v.avatarUrl} name={v.displayName} size={32} />
                  <Text>{v.displayName ?? v.username ?? 'Viewer'}</Text>
                </View>
              ))
            )}
            <Button title="Close" size="sm" onPress={() => setShowViewers(false)} style={{ marginTop: spacing.md }} />
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={showColive} transparent animationType="fade" onRequestClose={() => setShowColive(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setShowColive(false)}>
          <Pressable
            style={[styles.modalCard, { backgroundColor: c.card, borderColor: c.border }]}
            onPress={() => undefined}
          >
            <Text variant="h3" style={{ marginBottom: spacing.md }}>
              Invite co-host
            </Text>
            {coliveTargets.length === 0 ? (
              <Text muted>No other hosts are live</Text>
            ) : (
              coliveTargets.map((r) => {
                const hId = hostIdOf(r);
                return (
                  <View key={r.id} style={styles.viewerRow}>
                    <Avatar uri={r.host?.avatarUrl} name={r.host?.displayName} size={32} />
                    <Text style={{ flex: 1 }}>{r.host?.displayName ?? 'Host'}</Text>
                    <Button
                      title="Invite"
                      size="sm"
                      onPress={() => hId && void inviteColive(hId)}
                    />
                  </View>
                );
              })
            )}
            <Button title="Close" size="sm" onPress={() => setShowColive(false)} style={{ marginTop: spacing.md }} />
          </Pressable>
        </Pressable>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  meta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
    gap: 8,
  },
  stageWrap: { height: 260, borderRadius: 16, overflow: 'hidden' },
  stageFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    padding: spacing.lg,
  },
  row: { flexDirection: 'row', marginTop: spacing.md },
  chatRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  modalCard: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing.lg,
    maxHeight: '70%',
  },
  viewerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
});
