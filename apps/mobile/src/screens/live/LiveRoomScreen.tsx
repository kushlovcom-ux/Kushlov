import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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
import { FilterSelector } from '@/faceFilters/components/FilterSelector';
import { FaceFilterPublisher } from '@/faceFilters/components/FaceFilterPublisher';
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

function chatIdOf(m: ChatMsg & { _id?: string }): string | undefined {
  return m.id ?? m._id;
}

function mergeChat(prev: ChatMsg[], incoming: ChatMsg[]): ChatMsg[] {
  const seen = new Set(prev.map((m) => m.id).filter(Boolean) as string[]);
  const next = [...prev];
  for (const raw of incoming) {
    const id = chatIdOf(raw);
    const message = raw.message?.trim();
    if (!message) continue;
    if (id && seen.has(id)) continue;
    if (id) seen.add(id);
    next.push({ id, user: raw.user, message });
  }
  return next;
}

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
  const { liveId, coliveToken, livekitUrl: handoffUrl } = route.params;
  const c = useThemeColors();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const socket = useSocket();
  const settings = useSettings();
  const [chat, setChat] = useState('');
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const lastChatIdRef = useRef<string | undefined>(undefined);
  const [viewers, setViewers] = useState(0);
  const [showViewers, setShowViewers] = useState(false);
  const [showColive, setShowColive] = useState(false);
  const [token, setToken] = useState<string>();
  const [livekitUrl, setLivekitUrl] = useState<string>();
  const [connecting, setConnecting] = useState(true);
  const [connectError, setConnectError] = useState<string | null>(null);
  const [isCoHostOverride, setIsCoHostOverride] = useState(false);
  const [coHostName, setCoHostName] = useState<string | null>(null);
  const [room, setRoom] = useState<Room | null>(null);

  const onRoom = useCallback((r: Room | null) => setRoom(r), []);

  const live = useQuery({
    queryKey: queryKeys.liveRoom(liveId),
    queryFn: () => liveApi.get(liveId),
    enabled: Boolean(liveId),
  });

  const isHost = useMemo(() => {
    if (!live.data || !user?.id) return false;
    return hostIdOf(live.data) === user.id;
  }, [live.data, user?.id]);

  const isCoHost = useMemo(() => {
    if (isCoHostOverride) return true;
    if (!live.data || !user?.id) return false;
    return coHostIdOf(live.data) === user.id;
  }, [live.data, user?.id, isCoHostOverride]);

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
    } else if (!isCoHostOverride) {
      setCoHostName(null);
    }
  }, [live.data, user?.id, isCoHostOverride]);

  // Accept handoff → publish into group live immediately.
  useEffect(() => {
    if (!coliveToken) return;
    setIsCoHostOverride(true);
    setToken(coliveToken);
    if (handoffUrl) setLivekitUrl(handoffUrl);
    setConnecting(false);
  }, [coliveToken, handoffUrl]);

  useEffect(() => {
    if (!live.data) return;
    if (coliveToken && isCoHost) return;
    let cancelled = false;
    setConnecting(true);
    setConnectError(null);
    (async () => {
      try {
        const data = isHost
          ? await liveApi.hostToken(liveId)
          : isCoHost
            ? await liveApi.coliveToken(liveId)
            : await liveApi.join(liveId);
        if (cancelled) return;
        if (data.token) setToken(data.token);
        if (data.livekitUrl) setLivekitUrl(data.livekitUrl);
        if ('role' in data && data.role === 'cohost') setIsCoHostOverride(true);
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
  }, [live.data, liveId, isHost, isCoHost, coliveToken]);

  const appendChat = useCallback((incoming: ChatMsg | ChatMsg[]) => {
    const list = Array.isArray(incoming) ? incoming : [incoming];
    setMessages((prev) => {
      const next = mergeChat(prev, list);
      const last = next[next.length - 1]?.id;
      if (last) lastChatIdRef.current = last;
      return next;
    });
  }, []);

  // HTTP poll — REST chat is saved on Vercel while Socket.io may live on the VPS.
  useEffect(() => {
    if (!liveId) return;
    let cancelled = false;

    const pull = async () => {
      try {
        const after = lastChatIdRef.current;
        const data = await liveApi.listChat(liveId, {
          after,
          limit: after ? 50 : 40,
        });
        if (!cancelled && data.messages?.length) {
          appendChat(data.messages);
        }
      } catch {
        /* ignore transient poll errors */
      }
    };

    void pull();
    const ms = socket.connected ? 5_000 : 2_500;
    const timer = setInterval(() => void pull(), ms);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [liveId, socket.connected, appendChat]);

  useEffect(() => {
    const joinRoom = () => {
      socket.emit(SocketEvents.LiveJoin, { liveId });
    };
    joinRoom();

    const s = socket.get();
    s?.on('connect', joinRoom);

    const offChat = socket.on(SocketEvents.LiveChat, (...args: unknown[]) => {
      const m = args[0] as ChatMsg & { _id?: string; id?: string };
      if (m?.message) appendChat(m);
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
      if (p.coHost?.id === user?.id) setIsCoHostOverride(true);
    });
    const offColiveLeave = socket.on(SocketEvents.LiveColiveLeave, () => {
      setCoHostName(null);
      if (isCoHost && !isHost) navigation.goBack();
    });
    return () => {
      s?.off('connect', joinRoom);
      socket.emit(SocketEvents.LiveLeave, { liveId });
      offChat();
      offCount();
      offLeave();
      offColiveAccept();
      offColiveLeave();
      // Do NOT HTTP-leave here — that runs on every listener rebind and drops viewers.
    };
  }, [liveId, socket, navigation, isHost, isCoHost, user?.id, socket.connected, appendChat]);

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
    setChat('');
    try {
      const created = await liveApi.chat(liveId, msg);
      appendChat({
        id: created.id ?? created._id,
        user: created.user ?? { displayName: user?.displayName },
        message: created.message ?? msg,
      });
    } catch (err) {
      setChat(msg);
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

  if (!liveId) {
    return (
      <Screen>
        <Header title="Live" onBack={() => navigation.goBack()} />
        <ErrorView message="Invalid live stream id. Go back and try again." />
      </Screen>
    );
  }

  if (live.isError) {
    return (
      <Screen>
        <Header title="Live" onBack={() => navigation.goBack()} />
        <ErrorView message={getErrorMessage(live.error)} onRetry={() => live.refetch()} />
      </Screen>
    );
  }

  return (
    <Screen padded={false}>
      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: '#000' }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
      >
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
                Who&apos;s watching
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
          <View style={StyleSheet.absoluteFill}>
            <LiveKitStage
              token={token}
              serverUrl={livekitUrl}
              publish={canPublish}
              isHost={canPublish}
              onDisconnected={leave}
              onRoom={onRoom}
              style={{ flex: 1 }}
            />
          </View>
        ) : (
          <View style={[styles.stageFallback, { backgroundColor: c.elevated }]}>
            <Text muted>{connecting ? 'Connecting…' : 'No media token'}</Text>
          </View>
        )}

        {!canPublish ? (
          <View style={styles.chatOverlay} pointerEvents="box-none">
            <FlatList
              data={messages}
              keyExtractor={(item, i) => item.id ?? String(i)}
              style={{ maxHeight: 150 }}
              renderItem={({ item }) => (
                <View style={styles.chatBubble}>
                  <Text>
                    <Text color={c.pink} variant="bodyBold">
                      {item.user?.displayName ?? 'User'}:{' '}
                    </Text>
                    <Text color="#fff">{item.message}</Text>
                  </Text>
                </View>
              )}
            />
            <View style={styles.chatRow}>
              <View style={{ flex: 1 }}>
                <Input
                  value={chat}
                  onChangeText={setChat}
                  placeholder={
                    chatCost > 0 ? `Say something… (${chatCost}♦/msg)` : 'Say something…'
                  }
                />
              </View>
              <Button title="Send" size="sm" onPress={sendChat} />
              <Button
                title="Like"
                size="sm"
                variant="secondary"
                onPress={() => liveApi.like(liveId).catch(() => undefined)}
              />
            </View>
          </View>
        ) : null}
      </View>

      {canPublish ? (
        <View
          style={[
            styles.chatDock,
            { paddingBottom: Math.max(insets.bottom, spacing.sm) },
          ]}
        >
          <FlatList
            data={messages}
            keyExtractor={(item, i) => item.id ?? String(i)}
            style={styles.chatDockList}
            renderItem={({ item }) => (
              <View style={styles.chatBubble}>
                <Text>
                  <Text color={c.pink} variant="bodyBold">
                    {item.user?.displayName ?? 'User'}:{' '}
                  </Text>
                  <Text color="#fff">{item.message}</Text>
                </Text>
              </View>
            )}
          />
          <View style={styles.chatRow}>
            <View style={{ flex: 1 }}>
              <Input value={chat} onChangeText={setChat} placeholder="Say something…" />
            </View>
            <Button title="Send" size="sm" onPress={sendChat} />
            <Button
              title="Like"
              size="sm"
              variant="secondary"
              onPress={() => liveApi.like(liveId).catch(() => undefined)}
            />
          </View>
          <View style={{ gap: 8, marginTop: spacing.sm }}>
            <FaceFilterPublisher room={room} />
            <FilterSelector />
          </View>
        </View>
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
      </KeyboardAvoidingView>
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
    paddingHorizontal: spacing.md,
  },
  stageWrap: { flex: 1, overflow: 'hidden', position: 'relative', backgroundColor: '#000' },
  stageFallback: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  chatOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    padding: spacing.md,
    maxHeight: '48%',
    justifyContent: 'flex-end',
  },
  chatDock: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    backgroundColor: '#000',
    gap: 4,
  },
  chatDockList: {
    maxHeight: 96,
  },
  chatBubble: {
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginBottom: 4,
    alignSelf: 'flex-start',
    maxWidth: '92%',
  },
  chatRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
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
