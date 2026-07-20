import React, { useEffect, useState } from 'react';
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
import { callsApi } from '@/api/calls';
import { getErrorMessage } from '@/api/client';
import { useThemeColors } from '@/hooks/useThemeColors';
import { connectRoom, disconnectRoom, ensureLiveKitNative } from '@/services/livekit';
import { useCallStore } from '@/store/call';
import { CallStatus, CallType } from '@/types';
import { formatDuration } from '@/utils/format';
import { haptics } from '@/utils/haptics';
import type { Room } from 'livekit-client';
import { spacing } from '@/theme';

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
  const [room, setRoom] = useState<Room | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [nativeOk, setNativeOk] = useState<boolean | null>(null);

  useEffect(() => {
    ensureLiveKitNative().then(setNativeOk);
  }, []);

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
    let cancelled = false;
    async function join() {
      if (!active?.session.token || !active.session.livekitUrl) return;
      setConnecting(true);
      try {
        const r = await connectRoom({
          url: active.session.livekitUrl,
          token: active.session.token,
        });
        if (cancelled) {
          await disconnectRoom(r);
          return;
        }
        setRoom(r);
        markConnected();
        useCallStore.getState().updateSession({ status: CallStatus.Ongoing });
      } catch (err) {
        Alert.alert('Call error', getErrorMessage(err));
      } finally {
        if (!cancelled) setConnecting(false);
      }
    }
    join();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active?.session.id, active?.session.token]);

  useEffect(() => {
    return () => {
      disconnectRoom(room).catch(() => undefined);
    };
  }, [room]);

  const endCall = async () => {
    haptics.medium();
    try {
      if (active) {
        await callsApi.end(active.session.type, active.session.id);
      }
    } catch {
      // ignore
    }
    await disconnectRoom(room);
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

  const flipCamera = async () => {
    try {
      await room?.localParticipant.setCameraEnabled(true);
    } catch {
      // soft fail
    }
  };

  if (incoming && !active) {
    const peer = incoming.caller;
    return (
      <View style={[styles.overlay, { backgroundColor: c.bg }]}>
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

  return (
    <View style={[styles.overlay, { backgroundColor: '#050506' }]}>
      {nativeOk === false ? (
        <Text muted style={{ textAlign: 'center', paddingHorizontal: 24 }}>
          LiveKit native modules are unavailable in Expo Go. Accept/end still work; media requires a
          dev client build.
        </Text>
      ) : null}
      <Text variant="caption" muted>
        {active.session.status === CallStatus.Ringing ? 'Ringing…' : formatDuration(elapsed)}
      </Text>
      <Avatar uri={peer?.avatarUrl} name={peer?.displayName} size={88} />
      <Text variant="h2">{peer?.displayName ?? 'Call'}</Text>
      {connecting ? <ActivityIndicator color={c.primary} style={{ marginTop: 12 }} /> : null}

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
        {isVideo ? (
          <Ctrl icon="camera-reverse" label="Flip" onPress={flipCamera} color={c.elevated} />
        ) : null}
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
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    padding: spacing['2xl'],
  },
  actions: { flexDirection: 'row', gap: 40, marginTop: 40 },
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
