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
import { FilterSelector } from '@/faceFilters/components/FilterSelector';
import { FaceFilterPublisher } from '@/faceFilters/components/FaceFilterPublisher';
import { callsApi } from '@/api/calls';
import { getErrorMessage } from '@/api/client';
import { useThemeColors } from '@/hooks/useThemeColors';
import { ensureLiveKitNative } from '@/services/livekit';
import { dismissIncomingCallNotification } from '@/services/notifications';
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
  const heldCall = useCallStore((s) => s.heldCall);
  const parked = useCallStore((s) => s.parked);
  const clear = useCallStore((s) => s.clear);
  const setIncoming = useCallStore((s) => s.setIncoming);
  const setHeldCall = useCallStore((s) => s.setHeldCall);
  const startCall = useCallStore((s) => s.startCall);
  const setMuted = useCallStore((s) => s.setMuted);
  const setCameraOff = useCallStore((s) => s.setCameraOff);
  const setSpeakerOn = useCallStore((s) => s.setSpeakerOn);
  const markConnected = useCallStore((s) => s.markConnected);
  const [elapsed, setElapsed] = useState(0);
  const [nativeOk, setNativeOk] = useState<boolean | null>(null);
  const [room, setRoom] = useState<Room | null>(null);

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

  // Ensure camera actually publishes on video calls once the room is ready.
  useEffect(() => {
    if (!room || !active) return;
    if (active.session.type !== CallType.Video) return;
    void (async () => {
      try {
        await room.localParticipant.setMicrophoneEnabled(!active.muted);
        await room.localParticipant.setCameraEnabled(!active.cameraOff);
      } catch {
        // Permission / device issues — audio may still work
      }
    })();
  }, [room, active?.session.id, active?.session.type, active?.muted, active?.cameraOff]);

  const endCall = async () => {
    haptics.medium();
    const held = useCallStore.getState().heldCall;
    try {
      if (active) {
        await callsApi.end(active.session.type, active.session.id);
      }
    } catch {
      // ignore
    }
    setRoom(null);
    if (held) {
      // Clear held first so socket CallEnd does not double-resume.
      setHeldCall(null);
      useCallStore.setState({ active: null, incoming: null, parked: false });
      try {
        const session = await callsApi.unhold(held.type, held.callId);
        startCall(session, 'caller', held.peer);
      } catch (err) {
        Alert.alert('Resume failed', getErrorMessage(err));
      }
      return;
    }
    clear();
  };

  const endHeldOnly = async () => {
    if (!heldCall) return;
    try {
      await callsApi.end(heldCall.type, heldCall.callId);
    } catch {
      // ignore
    }
    setHeldCall(null);
  };

  const endAllCalls = async () => {
    haptics.medium();
    const held = heldCall;
    if (held) {
      try {
        await callsApi.end(held.type, held.callId);
      } catch {
        // ignore
      }
      setHeldCall(null);
    }
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

  const mergeHeld = async () => {
    if (!active || !heldCall) return;
    try {
      const session = await callsApi.merge(
        active.session.type,
        active.session.id,
        heldCall.callId,
      );
      useCallStore.getState().updateSession({
        id: session.id || active.session.id,
        token: session.token ?? active.session.token,
        livekitUrl: session.livekitUrl ?? active.session.livekitUrl,
        roomName: session.roomName ?? active.session.roomName,
        status: CallStatus.Ongoing,
      });
      setHeldCall(null);
      Alert.alert('Merged', 'Calls merged into one room');
    } catch (err) {
      Alert.alert('Merge failed', getErrorMessage(err));
    }
  };

  const acceptIncoming = async () => {
    if (!incoming) return;
    haptics.success();
    try {
      const session = incoming.interrupt
        ? await callsApi.acceptInterrupt(incoming.type, incoming.id)
        : await callsApi.accept(incoming.type, incoming.id);
      await dismissIncomingCallNotification(incoming.id);
      if (active && incoming.interrupt) {
        // Stay on current room; merge brings C into the same LiveKit room.
        useCallStore.getState().updateSession({
          id: session.id || active.session.id,
          token: session.token ?? active.session.token,
          livekitUrl: session.livekitUrl ?? active.session.livekitUrl,
          roomName: session.roomName ?? active.session.roomName,
          status: CallStatus.Ongoing,
        });
        setIncoming(null);
      } else {
        startCall(session, 'callee', incoming.caller);
        setIncoming(null);
      }
    } catch (err) {
      Alert.alert('Could not accept', getErrorMessage(err));
    }
  };

  const rejectIncoming = async () => {
    if (!incoming) return;
    haptics.medium();
    try {
      await callsApi.reject(incoming.type, incoming.id);
    } catch {
      // ignore
    }
    await dismissIncomingCallNotification(incoming.id);
    setIncoming(null);
  };

  const kickPeer = async (userId: string, name?: string) => {
    if (!active) return;
    Alert.alert('End for participant', `Remove ${name ?? 'this user'} from the call?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => {
          void (async () => {
            try {
              const res = await callsApi.removeParticipant(
                active.session.type,
                active.session.id,
                userId,
              );
              if (res.ended) {
                setRoom(null);
                clear();
              }
            } catch (err) {
              Alert.alert('Remove', getErrorMessage(err));
            }
          })();
        },
      },
    ]);
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
    const isVideo = incoming.type === CallType.Video;
    return (
      <View style={[styles.overlay, styles.centerFill, { backgroundColor: c.bg }]}>
        <Text variant="caption" color={c.pink}>
          Incoming {isVideo ? 'video' : 'audio'} call
        </Text>
        <Avatar uri={peer?.avatarUrl} name={peer?.displayName} size={96} />
        <Text variant="h2">{peer?.displayName ?? 'Someone'}</Text>
        <Text muted style={{ textAlign: 'center', marginBottom: spacing.sm }}>
          {isVideo ? 'Wants to video call you' : 'Wants to audio call you'}
        </Text>
        <View style={styles.actions}>
          <View style={styles.actionCol}>
            <Pressable
              onPress={rejectIncoming}
              accessibilityLabel="Decline call"
              accessibilityRole="button"
              style={[styles.round, { backgroundColor: c.danger }]}
            >
              <Ionicons name="close" size={32} color="#fff" />
            </Pressable>
            <Text variant="bodyBold" color={c.danger}>
              Decline
            </Text>
          </View>
          <View style={styles.actionCol}>
            <Pressable
              onPress={acceptIncoming}
              accessibilityLabel="Accept call"
              accessibilityRole="button"
              style={[styles.round, { backgroundColor: c.success }]}
            >
              <Ionicons name={isVideo ? 'videocam' : 'call'} size={28} color="#fff" />
            </Pressable>
            <Text variant="bodyBold" color={c.success}>
              Accept
            </Text>
          </View>
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
        {parked ? (
          <View style={[styles.holdChip, { backgroundColor: 'rgba(245, 158, 11, 0.25)' }]}>
            <Ionicons name="pause" size={14} color="#fbbf24" />
            <Text variant="caption" color="#fbbf24">
              On hold — please wait
            </Text>
          </View>
        ) : null}
        {heldCall ? (
          <View style={[styles.heldBanner, { borderColor: 'rgba(245, 158, 11, 0.45)' }]}>
            <Text variant="caption" color="#fbbf24">
              On hold: {heldCall.peer?.displayName ?? 'Other call'}
            </Text>
            <View style={styles.heldActions}>
              <Pressable
                onPress={() => void mergeHeld()}
                style={[styles.heldBtn, { backgroundColor: c.success }]}
              >
                <Text variant="tiny" color="#fff">
                  Merge
                </Text>
              </Pressable>
              <Pressable
                onPress={() => void endHeldOnly()}
                style={[styles.heldBtn, { backgroundColor: 'rgba(255,255,255,0.18)' }]}
              >
                <Text variant="tiny" color="#fff">
                  End held
                </Text>
              </Pressable>
              <Pressable
                onPress={() => void endAllCalls()}
                style={[styles.heldBtn, { backgroundColor: c.danger }]}
              >
                <Text variant="tiny" color="#fff">
                  End all
                </Text>
              </Pressable>
            </View>
          </View>
        ) : null}
        {nativeOk === false ? (
          <Text muted style={{ textAlign: 'center', paddingHorizontal: 24, marginTop: 8 }}>
            LiveKit native modules unavailable in Expo Go. Use a dev client / EAS build for media.
          </Text>
        ) : null}
        <View style={{ marginTop: 12, flexDirection: 'row', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
          {!heldCall && !parked ? (
            <AddCallParticipant callId={active.session.id} type={active.session.type} mode="consult" />
          ) : null}
          {!heldCall ? (
            <AddCallParticipant callId={active.session.id} type={active.session.type} mode="invite" />
          ) : null}
        </View>
        {active.peer?.id ? (
          <Pressable
            onPress={() => kickPeer(active.peer!.id!, active.peer?.displayName)}
            style={{ marginTop: 8, paddingHorizontal: 12, paddingVertical: 6 }}
          >
            <Text variant="caption" color={c.danger}>
              End call for {active.peer.displayName ?? 'peer'}
            </Text>
          </Pressable>
        ) : null}
      </View>

      {incoming ? (
        <View style={[styles.waitingBanner, { backgroundColor: 'rgba(0,0,0,0.82)', borderColor: c.border }]}>
          <Text variant="bodyBold">
            {incoming.caller?.displayName ?? 'Someone'} is calling
            {incoming.interrupt ? ' (waiting)' : ''}
          </Text>
          <Text muted variant="caption" style={{ marginBottom: 8 }}>
            {incoming.type === CallType.Video ? 'Video' : 'Audio'} — Accept to merge into this call
          </Text>
          <View style={{ flexDirection: 'row', gap: 16, justifyContent: 'center' }}>
            <Pressable
              onPress={rejectIncoming}
              style={[styles.roundSm, { backgroundColor: c.danger }]}
              accessibilityLabel="Decline"
            >
              <Ionicons name="close" size={22} color="#fff" />
            </Pressable>
            <Pressable
              onPress={acceptIncoming}
              style={[styles.roundSm, { backgroundColor: c.success }]}
              accessibilityLabel="Accept"
            >
              <Ionicons name="call" size={20} color="#fff" />
            </Pressable>
          </View>
          <View style={{ flexDirection: 'row', gap: 28, marginTop: 6 }}>
            <Text variant="tiny" color={c.danger}>
              Decline
            </Text>
            <Text variant="tiny" color={c.success}>
              Accept
            </Text>
          </View>
        </View>
      ) : null}

      {isVideo ? (
        <View style={styles.filterBar}>
          <FaceFilterPublisher room={room} />
          <FilterSelector />
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
        <Ctrl
          icon="call"
          label={heldCall ? 'End & resume' : 'End'}
          onPress={endCall}
          color={c.danger}
          rotate
        />
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
  holdChip: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  heldBanner: {
    marginTop: 10,
    marginHorizontal: 16,
    alignSelf: 'stretch',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    padding: 10,
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    gap: 8,
  },
  heldActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'center',
  },
  heldBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  filterBar: {
    position: 'absolute',
    bottom: 120,
    left: 0,
    right: 0,
  },
  waitingBanner: {
    position: 'absolute',
    top: 120,
    left: 16,
    right: 16,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 16,
    alignItems: 'center',
    zIndex: 20,
  },
  actions: {
    flexDirection: 'row',
    gap: 48,
    marginTop: 40,
    alignItems: 'flex-start',
  },
  actionCol: {
    alignItems: 'center',
    gap: 10,
    minWidth: 88,
  },
  round: {
    width: 72,
    height: 72,
    borderRadius: 36,
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
