import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '@/components/ui/Text';
import { Avatar } from '@/components/ui/Avatar';
import { LiveKitStage } from '@/components/live/LiveKitStage';
import { AddCallParticipant } from '@/components/calls/AddCallParticipant';
import {
  VideoFilterBar,
  FilterOverlay,
  type VideoFilterId,
} from '@/components/calls/VideoFilterBar';
import { callsApi } from '@/api/calls';
import { getErrorMessage } from '@/api/client';
import { useThemeColors } from '@/hooks/useThemeColors';
import { ensureLiveKitNative } from '@/services/livekit';
import { useCallStore } from '@/store/call';
import { CallStatus, CallType } from '@/types';
import { formatDuration } from '@/utils/format';
import { haptics } from '@/utils/haptics';
import { spacing } from '@/theme';
import type { Room } from 'livekit-client';

export function CallOverlay() {
  const c = useThemeColors();
  const active = useCallStore((s) => s.active);
  const incoming = useCallStore((s) => s.incoming);
  const clear = useCallStore((s) => s.clear);
  const setIncoming = useCallStore((s) => s.setIncoming);
  const startCall = useCallStore((s) => s.startCall);
  const setMuted = useCallStore((s) => s.setMuted);
  const setCameraOff = useCallStore((s) => s.setCameraOff);
  const setSpeakerOn = useCallStore((s) => s.setSpeakerOn);
  const markConnected = useCallStore((s) => s.markConnected);
  const [elapsed, setElapsed] = useState(0);
  const [nativeOk, setNativeOk] = useState<boolean | null>(null);
  const [room, setRoom] = useState<Room | null>(null);
  const [filter, setFilter] = useState<VideoFilterId>('none');

  const onRoom = useCallback((r: Room | null) => {
    setRoom(r);
  }, []);

  useEffect(() => {
    if (!active && !incoming) return;
    let cancelled = false;
    ensureLiveKitNative()
      .then((ok) => {
        if (!cancelled) setNativeOk(ok);
      })
      .catch(() => {
        if (!cancelled) setNativeOk(false);
      });
    return () => {
      cancelled = true;
    };
  }, [active, incoming]);

  useEffect(() => {
    if (!active?.connectedAt) {
      setElapsed(0);
      return;
    }
    const t = setInterval(() => {
      setElapsed(Math.floor((Date.now() - (active.connectedAt ?? Date.now())) / 1000));
    }, 1000);
    return () => clearInterval(t);
  }, [active?.connectedAt]);

  useEffect(() => {
    if (!active?.session.token || !active.session.livekitUrl) return;
    if (!active.connectedAt) markConnected();
    useCallStore.getState().updateSession({ status: CallStatus.Ongoing });
  }, [
    active?.session.id,
    active?.session.token,
    active?.session.livekitUrl,
    active?.connectedAt,
    markConnected,
  ]);

  const endCall = async () => {
    haptics.medium();
    try {
      if (active) {
        await callsApi.end(active.session.type, active.session.id);
      }
    } catch {
      // ignore
    }
    setRoom(null);
    clear();
  };

  const acceptIncoming = async () => {
    if (!incoming) return;
    try {
      const session = await callsApi.accept(incoming.type, incoming.id);
      startCall(session, 'callee', incoming.caller);
      setIncoming(null);
    } catch (err) {
      Alert.alert('Could not accept', getErrorMessage(err));
    }
  };

  const rejectIncoming = async () => {
    if (!incoming) return;
    try {
      await callsApi.reject(incoming.type, incoming.id);
    } catch {
      // ignore
    }
    setIncoming(null);
  };

  const toggleMute = async () => {
    if (!active) return;
    const next = !active.muted;
    setMuted(next);
    try {
      await room?.localParticipant.setMicrophoneEnabled(!next);
    } catch {
      // soft fail
    }
  };

  const toggleCamera = async () => {
    if (!active || active.session.type !== CallType.Video) return;
    const next = !active.cameraOff;
    setCameraOff(next);
    try {
      await room?.localParticipant.setCameraEnabled(!next);
    } catch {
      // soft fail
    }
  };

  if (incoming && !active) {
    const peer = incoming.caller;
    return (
      <View style={[styles.overlay, styles.centerFill, { backgroundColor: c.bg }]}>
        <Text variant="caption" muted>
          Incoming {incoming.type} call
        </Text>
        <Avatar uri={peer?.avatarUrl} name={peer?.displayName} size={96} />
        <Text variant="h2">{peer?.displayName ?? 'Someone'}</Text>
        <View style={styles.actions}>
          <Pressable
            onPress={rejectIncoming}
            style={[styles.round, { backgroundColor: c.danger }]}
          >
            <Ionicons name="call" size={28} color="#fff" style={{ transform: [{ rotate: '135deg' }] }} />
          </Pressable>
          <Pressable
            onPress={acceptIncoming}
            style={[styles.round, { backgroundColor: c.success }]}
          >
            <Ionicons name="call" size={28} color="#fff" />
          </Pressable>
        </View>
      </View>
    );
  }

  if (!active) return null;

  const peer = active.peer;
  const isVideo = active.session.type === CallType.Video;
  const token = active.session.token;
  const url = active.session.livekitUrl;

  return (
    <View style={[styles.overlay, { backgroundColor: '#050506' }]}>
      {token && url ? (
        <View style={StyleSheet.absoluteFill}>
          <LiveKitStage
            token={token}
            serverUrl={url}
            publish
            audioOnly={!isVideo}
            onDisconnected={() => void endCall()}
            onRoom={onRoom}
            style={{ flex: 1, borderRadius: 0 }}
          />
          {isVideo ? <FilterOverlay filter={filter} /> : null}
        </View>
      ) : (
        <View style={styles.centerMeta}>
          <Avatar uri={peer?.avatarUrl} name={peer?.displayName} size={88} />
          <Text variant="h2">{peer?.displayName ?? 'Call'}</Text>
          <ActivityIndicator color={c.primary} style={{ marginTop: 12 }} />
        </View>
      )}

      <View style={styles.topMeta} pointerEvents="box-none">
        <Text variant="caption" muted>
          {active.session.status === CallStatus.Ringing ? 'Ringing…' : formatDuration(elapsed)}
        </Text>
        <Text variant="bodyBold">{peer?.displayName ?? 'Call'}</Text>
        {nativeOk === false ? (
          <Text muted style={{ textAlign: 'center', paddingHorizontal: 24, marginTop: 8 }}>
            LiveKit native modules unavailable in Expo Go. Use a dev client / EAS build for media.
          </Text>
        ) : null}
        <View style={{ marginTop: 12 }}>
          <AddCallParticipant callId={active.session.id} type={active.session.type} />
        </View>
      </View>

      {isVideo ? (
        <View style={styles.filterBar}>
          <VideoFilterBar room={room} onFilterChange={setFilter} />
        </View>
      ) : null}

      <View style={styles.controls}>
        <Ctrl
          icon={active.muted ? 'mic-off' : 'mic'}
          label={active.muted ? 'Unmute' : 'Mute'}
          onPress={toggleMute}
          color={c.elevated}
        />
        {isVideo ? (
          <Ctrl
            icon={active.cameraOff ? 'videocam-off' : 'videocam'}
            label="Camera"
            onPress={toggleCamera}
            color={c.elevated}
          />
        ) : (
          <Ctrl
            icon={active.speakerOn ? 'volume-high' : 'volume-mute'}
            label="Speaker"
            onPress={() => setSpeakerOn(!active.speakerOn)}
            color={c.elevated}
          />
        )}
        <Ctrl icon="call" label="End" onPress={endCall} color={c.danger} rotate />
      </View>
    </View>
  );
}

function Ctrl({
  icon,
  label,
  onPress,
  color,
  rotate,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  color: string;
  rotate?: boolean;
}) {
  return (
    <Pressable onPress={onPress} style={styles.ctrl}>
      <View style={[styles.roundSm, { backgroundColor: color }]}>
        <Ionicons
          name={icon}
          size={22}
          color="#fff"
          style={rotate ? { transform: [{ rotate: '135deg' }] } : undefined}
        />
      </View>
      <Text variant="tiny" muted>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1000,
  },
  centerFill: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    padding: spacing['2xl'],
  },
  centerMeta: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  topMeta: {
    position: 'absolute',
    top: 56,
    left: 0,
    right: 0,
    alignItems: 'center',
    gap: 4,
  },
  filterBar: {
    position: 'absolute',
    bottom: 120,
    left: 0,
    right: 0,
  },
  actions: {
    flexDirection: 'row',
    gap: 40,
    marginTop: 40,
  },
  round: {
    width: 68,
    height: 68,
    borderRadius: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roundSm: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  controls: {
    position: 'absolute',
    bottom: 48,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    paddingHorizontal: 16,
  },
  ctrl: { alignItems: 'center', gap: 6 },
});
