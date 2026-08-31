import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/Button';
import { Text } from '@/components/ui/Text';
import { Avatar } from '@/components/ui/Avatar';
import { Header } from '@/components/common/Header';
import { Screen } from '@/components/common/Screen';
import { ErrorView } from '@/components/ui/ErrorView';
import { LiveKitStage } from '@/components/live/LiveKitStage';
import { HostMediaBar } from '@/components/live/HostMediaBar';
import { LiveHearts, type LiveHeartsHandle } from '@/components/live/LiveHearts';
import { FilterSelector } from '@/faceFilters/components/FilterSelector';
import { FaceFilterPublisher } from '@/faceFilters/components/FaceFilterPublisher';
import { liveApi } from '@/api/live';
import { getErrorMessage } from '@/api/client';
import { queryKeys } from '@/constants/queryKeys';
import { useAuth } from '@/hooks/useAuth';
import { useKeyboard } from '@/hooks/useKeyboard';
import { useSettings } from '@/hooks/useSettings';
import { useSocket } from '@/providers/SocketProvider';
import { useThemeColors } from '@/hooks/useThemeColors';
import { haptics } from '@/utils/haptics';
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
  const keyboard = useKeyboard();
  const { user } = useAuth();
  const socket = useSocket();
  const settings = useSettings();
  const [chat, setChat] = useState('');
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const lastChatIdRef = useRef<string | undefined>(undefined);
  const [viewers, setViewers] = useState(0);
  const [likes, setLikes] = useState(0);
  const heartsRef = useRef<LiveHeartsHandle>(null);
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

  // Polled for every host, not just while the viewer sheet is open: a viewer who
  // joins before the host finishes `live:join` is otherwise never counted, so
  // the header sat at "0 watching" for the whole stream.
  const viewerList = useQuery({
    queryKey: [...queryKeys.liveRoom(liveId), 'viewers'] as const,
    queryFn: () => liveApi.viewers(liveId),
    enabled: Boolean(isHost),
    refetchInterval: showViewers ? 5_000 : 10_000,
  });

  useEffect(() => {
    const count = viewerList.data?.viewerCount;
    if (typeof count === 'number') setViewers(count);
  }, [viewerList.data?.viewerCount]);

  useEffect(() => {
    if (typeof live.data?.likeCount === 'number') {
      setLikes((prev) => (prev > live.data!.likeCount! ? prev : live.data!.likeCount!));
    }
  }, [live.data?.likeCount]);

  const sendLike = useCallback(() => {
    void haptics.light();
    heartsRef.current?.burst();
    setLikes((n) => n + 1);
    liveApi
      .like(liveId)
      .then((res) => {
        const total = res?.totalLikes ?? res?.likeCount;
        if (typeof total === 'number') setLikes(total);
      })
      .catch(() => undefined);
  }, [liveId]);

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
    const offLike = socket.on(SocketEvents.LiveLike, (...args: unknown[]) => {
      const p = args[0] as { totalLikes?: number; userId?: string };
      if (typeof p?.totalLikes === 'number') setLikes(p.totalLikes);
      // Our own like already animated optimistically; don't double it.
      if (p?.userId && user?.id && String(p.userId) === String(user.id)) return;
      heartsRef.current?.burst();
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
      offLike();
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

  if (live.isError && !live.data) {
    return (
      <Screen>
        <Header title="Live" onBack={() => navigation.goBack()} />
        <ErrorView message={getErrorMessage(live.error)} onRetry={() => live.refetch()} />
      </Screen>
    );
  }

  return (
    <Screen padded={false}>
      {/* Android is edge-to-edge since API 35, so the window no longer resizes
          for the keyboard and KeyboardAvoidingView's Android branch did
          nothing, hiding the composer behind the keyboard. */}
      <View style={{ flex: 1, backgroundColor: '#000', paddingBottom: keyboard.height }}>
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
        <View style={styles.metaLeft}>
          <Text variant="caption" muted numberOfLines={1}>
            {live.data?.host?.displayName ?? 'Host'}
            {coHostName ? ` + ${coHostName}` : ''}
          </Text>
          <View style={styles.statRow}>
            <Pressable
              onPress={() => (isHost ? setShowViewers(true) : undefined)}
              style={[styles.statPill, { backgroundColor: c.elevated }]}
            >
              <Ionicons name="eye" size={13} color={c.text} />
              <Text variant="caption" color={c.text}>
                {viewers} watching
              </Text>
            </Pressable>
            <View style={[styles.statPill, { backgroundColor: c.elevated }]}>
              <Ionicons name="heart" size={13} color="#FF4D8D" />
              <Text variant="caption" color={c.text}>
                {likes}
              </Text>
            </View>
          </View>
        </View>
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
              layout="grid"
              videoFit="cover"
              showAvControls={false}
              onDisconnected={leave}
              onRoom={onRoom}
              style={{ flex: 1 }}
            />
            {canPublish ? (
              <View style={styles.filterOverlay} pointerEvents="box-none">
                <FaceFilterPublisher room={room} />
                <HostMediaBar room={room} />
                <FilterSelector compact />
              </View>
            ) : null}
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
            <LiveChatBar
              value={chat}
              onChange={setChat}
              onSend={sendChat}
              onLike={sendLike}
              cost={chatCost}
            />
          </View>
        ) : null}

        <LiveHearts ref={heartsRef} />
      </View>

      {canPublish ? (
        <View
          style={[
            styles.chatDock,
            // The keyboard already covers the gesture bar, so adding its inset
            // on top of the KeyboardAvoidingView padding would float the
            // composer above the keyboard.
            { paddingBottom: keyboard.visible ? spacing.sm : Math.max(insets.bottom, spacing.sm) },
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
          <LiveChatBar
            value={chat}
            onChange={setChat}
            onSend={sendChat}
            onLike={sendLike}
            cost={chatCost}
          />
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
      </View>
    </Screen>
  );
}

/**
 * Compact composer for the live room. The previous version put a full-size
 * `Input` (52pt tall, thick border, 16pt padding) between two labelled buttons,
 * which left so little room that the placeholder was cut mid-word.
 */
function LiveChatBar({
  value,
  onChange,
  onSend,
  onLike,
  cost,
}: {
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  onLike: () => void;
  cost: number;
}) {
  const c = useThemeColors();
  return (
    <View>
      {cost > 0 ? (
        <Text variant="tiny" style={styles.chatCost}>
          {cost}♦ per message
        </Text>
      ) : null}
      <View style={styles.chatRow}>
        <View style={styles.chatField}>
          <TextInput
            value={value}
            onChangeText={onChange}
            placeholder="Say something…"
            placeholderTextColor="rgba(255,255,255,0.65)"
            style={styles.chatInput}
            maxLength={500}
            returnKeyType="send"
            onSubmitEditing={onSend}
            blurOnSubmit={false}
          />
        </View>
        <Pressable
          onPress={onSend}
          accessibilityLabel="Send message"
          style={[styles.chatBtn, { backgroundColor: c.pink }]}
        >
          <Ionicons name="send" size={17} color="#fff" />
        </Pressable>
        <Pressable onPress={onLike} accessibilityLabel="Send a like" style={styles.chatBtn}>
          <Ionicons name="heart" size={20} color="#FF4D8D" />
        </Pressable>
      </View>
    </View>
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
  filterOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 12,
    zIndex: 20,
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
  chatCost: { color: 'rgba(255,255,255,0.7)', marginLeft: 14, marginBottom: 2 },
  chatField: {
    flex: 1,
    minWidth: 0,
    height: 44,
    borderRadius: 22,
    paddingHorizontal: 16,
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.24)',
  },
  chatInput: {
    color: '#fff',
    fontSize: 15,
    padding: 0,
  },
  chatBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  metaLeft: { flex: 1, gap: 4 },
  statRow: { flexDirection: 'row', gap: 8 },
  statPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 999,
  },
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
