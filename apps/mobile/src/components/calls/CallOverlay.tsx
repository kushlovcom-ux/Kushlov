import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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
import {
  flipCameraFacing,
  getPreferredCameraFacing,
  getLiveKitRn,
  isLiveKitNativeReady,
  preloadLiveKitNative,
} from '@/services/livekit';
import { dismissIncomingCallNotification } from '@/services/notifications';
import { useCallStore } from '@/store/call';
import { CallStatus, CallType } from '@/types';
import { formatDuration } from '@/utils/format';
import { useCallRingtone } from '@/hooks/useCallRingtone';
import { haptics } from '@/utils/haptics';
import { spacing } from '@/theme';
import type { Room } from 'livekit-client';

export function CallOverlay() {
  const c = useThemeColors();
  const insets = useSafeAreaInsets();
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
  const [nativeOk, setNativeOk] = useState<boolean | null>(() =>
    isLiveKitNativeReady() ? true : null,
  );
  const [room, setRoom] = useState<Room | null>(null);
  const endingRef = useRef(false);
  const mergingRef = useRef(false);
  /** Timestamp of the last room/token swap — guards LiveKit disconnect races. */
  const sessionSwapRef = useRef(0);
  useCallRingtone(Boolean(incoming));

  const onRoom = useCallback((r: Room | null) => {
    setRoom(r);
  }, []);

  useEffect(() => {
    if (!active && !incoming) return;
    setNativeOk(preloadLiveKitNative());
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

  // Only start the call timer after the peer accepts (Ongoing) — not while ringing.
  useEffect(() => {
    if (!active?.session.token || !active.session.livekitUrl) return;
    if (active.session.status !== CallStatus.Ongoing) return;
    if (!active.connectedAt) markConnected();
  }, [
    active?.session.id,
    active?.session.token,
    active?.session.livekitUrl,
    active?.session.status,
    active?.connectedAt,
    markConnected,
  ]);

  const leaveBecauseRemoteEnded = useCallback(async () => {
    if (endingRef.current) return;
    endingRef.current = true;
    try {
      try {
        await room?.disconnect();
      } catch {
        /* ignore */
      }
      setRoom(null);
      const held = useCallStore.getState().heldCall;
      if (held) {
        useCallStore.setState({ active: null, incoming: null, parked: false });
        try {
          const resumed = await callsApi.unhold(held.type, held.callId);
          useCallStore.getState().setHeldCall(null);
          startCall(resumed, 'caller', held.peer);
        } catch {
          useCallStore.getState().setHeldCall(null);
        }
        return;
      }
      clear();
    } finally {
      endingRef.current = false;
    }
  }, [clear, room, startCall]);

  // HTTP fallback while ringing — sockets often miss `call:accept` / `call:reject`.
  useEffect(() => {
    if (!active?.session.id || !active.session.type) return;
    if (active.session.status !== CallStatus.Ringing) return;
    let cancelled = false;
    const tick = async () => {
      try {
        const latest = await callsApi.get(active.session.type, active.session.id);
        if (cancelled) return;
        const status = String(latest.status ?? '');
        if (
          status === CallStatus.Rejected ||
          status === CallStatus.Ended ||
          status === CallStatus.Missed ||
          status === CallStatus.Failed
        ) {
          await leaveBecauseRemoteEnded();
          return;
        }
        if (status === CallStatus.Ongoing || status === 'ongoing') {
          useCallStore.getState().updateSession({
            status: CallStatus.Ongoing,
            token: latest.token || active.session.token,
            livekitUrl: latest.livekitUrl || active.session.livekitUrl,
            roomName: latest.roomName || active.session.roomName,
          });
          const roster = (latest.participants ?? [])
            .filter((p) => p.id)
            .map((p) => ({ id: p.id, name: p.displayName || p.name || 'Peer' }));
          if (roster.length) useCallStore.getState().setParticipants(roster);
          // Peer accepted — stop treating this as outbound ringing.
          useCallStore.getState().markConnected();
        }
      } catch {
        /* still ringing / network */
      }
    };
    const timer = setInterval(() => void tick(), 1500);
    void tick();
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [active?.session.id, active?.session.status, active?.session.type, leaveBecauseRemoteEnded]);

  // Hold / merge / call-waiting hand us a new room + token. The old LiveKitRoom
  // unmounts and reports a disconnect that must not be read as "peer hung up".
  useEffect(() => {
    sessionSwapRef.current = Date.now();
  }, [active?.session.id, active?.session.token, active?.session.roomName]);

  // Apply mute/camera-off without restarting an already-correct capturer.
  // Calling setCameraEnabled(true) again while LiveKitRoom is already
  // publishing was racing and killing the host process on some devices.
  useEffect(() => {
    if (!room || !active) return;
    const participant = room.localParticipant;
    const wantMic = !active.muted;
    const wantCam =
      active.session.type === CallType.Video && !active.cameraOff;
    void (async () => {
      try {
        if (participant.isMicrophoneEnabled !== wantMic) {
          await participant.setMicrophoneEnabled(wantMic);
        }
        if (active.session.type === CallType.Video && participant.isCameraEnabled !== wantCam) {
          await participant.setCameraEnabled(
            wantCam,
            wantCam ? { facingMode: getPreferredCameraFacing() } : undefined,
          );
        }
      } catch {
        // Permission / device issues — audio may still work
      }
    })();
  }, [room, active?.session.id, active?.session.type, active?.muted, active?.cameraOff]);

  const endCall = async () => {
    if (endingRef.current) return;
    endingRef.current = true;
    haptics.medium();
    const held = useCallStore.getState().heldCall;
    const session = active?.session ?? useCallStore.getState().active?.session;
    // Consult switch still in flight: the held leg is also the active session.
    // Ending it here would hang up the person we are trying to keep.
    if (held && session?.id && String(session.id) === String(held.callId)) {
      endingRef.current = false;
      return;
    }
    // Drop local media immediately so the other side is not left waiting on us.
    try {
      await room?.disconnect();
    } catch {
      /* ignore */
    }
    setRoom(null);

    try {
      if (held) {
        setHeldCall(null);
        useCallStore.setState({ active: null, incoming: null, parked: false });
        try {
          if (session?.id) await callsApi.end(session.type, session.id);
        } catch {
          /* ignore */
        }
        try {
          const resumed = await callsApi.unhold(held.type, held.callId);
          startCall(resumed, 'caller', held.peer);
        } catch (err) {
          Alert.alert('Resume failed', getErrorMessage(err));
        }
        return;
      }

      // Clear UI first so we never look "still on the call", then notify the server.
      clear();
      try {
        if (session?.id) await callsApi.end(session.type, session.id);
      } catch {
        /* ignore */
      }
    } finally {
      endingRef.current = false;
    }
  };

  const endHeldOnly = async () => {
    if (!heldCall) return;
    const held = heldCall;
    try {
      await callsApi.end(held.type, held.callId);
    } catch {
      // ignore
    }
    setHeldCall(null);
    const activeNow = useCallStore.getState().active;
    if (activeNow && held.peer?.id) {
      const participants = (activeNow.participants ?? []).filter((p) => p.id !== held.peer!.id);
      useCallStore.getState().setParticipants(participants);
    }
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

  const mergeHeld = async (opts?: { silent?: boolean }) => {
    const state = useCallStore.getState();
    const current = state.active;
    const held = state.heldCall;
    if (!current || !held) return;
    // Consult switch not finished yet — both ids still point at the held leg.
    if (String(current.session.id) === String(held.callId)) return;
    if (mergingRef.current) return;
    mergingRef.current = true;
    try {
      const session = await callsApi.merge(
        current.session.type,
        current.session.id,
        held.callId,
      );
      // Remotes may have joined while the merge was in flight.
      const latest = useCallStore.getState().active ?? current;
      const fromServer = (session.participants ?? [])
        .filter((p) => p.id)
        .map((p) => ({ id: p.id, name: p.displayName || p.name || 'Peer' }));
      const participants = fromServer.length ? [...fromServer] : [...(latest.participants ?? [])];
      if (held.peer?.id && !participants.some((p) => p.id === held.peer!.id)) {
        participants.push({
          id: held.peer.id,
          name: held.peer.displayName ?? 'Peer',
        });
      }
      const sameRoom =
        !session.roomName || session.roomName === latest.session.roomName;
      useCallStore.getState().updateSession({
        id: session.id || latest.session.id,
        // Keeping the current token when the room is unchanged avoids tearing
        // down and re-joining LiveKit (which drops audio for a few seconds).
        token: sameRoom
          ? latest.session.token
          : (session.token ?? latest.session.token),
        livekitUrl: session.livekitUrl ?? latest.session.livekitUrl,
        roomName: session.roomName ?? latest.session.roomName,
        status: CallStatus.Ongoing,
      });
      useCallStore.getState().setParticipants(participants);
      setHeldCall(null);
      if (!opts?.silent) Alert.alert('Merged', 'Calls merged into one room');
    } catch (err) {
      if (!opts?.silent) Alert.alert('Merge failed', getErrorMessage(err));
    } finally {
      mergingRef.current = false;
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
        const prev = active;
        setHeldCall({
          callId: session.heldCallId || prev.session.id,
          type: session.heldType ?? prev.session.type,
          peer: prev.peer,
        });
        startCall(
          { ...session, status: CallStatus.Ongoing },
          'callee',
          incoming.caller,
        );
        setIncoming(null);
      } else {
        startCall(
          { ...session, status: CallStatus.Ongoing },
          'callee',
          incoming.caller,
        );
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
                return;
              }
              const next = (active.participants ?? []).filter((p) => p.id !== userId);
              useCallStore.getState().setParticipants(next);
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
      const enable = !next;
      await room?.localParticipant.setCameraEnabled(
        enable,
        enable ? { facingMode: getPreferredCameraFacing() } : undefined,
      );
    } catch {
      // soft fail
    }
  };

  const flipCamera = async () => {
    if (!active || active.session.type !== CallType.Video || active.cameraOff) return;
    haptics.medium();
    try {
      await flipCameraFacing(room);
    } catch {
      // soft fail — device may only have one camera
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
        <Avatar uri={peer?.avatarUrl} name={peer?.displayName} size={120} />
        <Text variant="h2">{peer?.displayName ?? 'Someone'}</Text>
        <Text muted style={{ textAlign: 'center', marginBottom: spacing.sm }}>
          {isVideo ? 'Video call' : 'Audio call'}
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
  const isOngoing = active.session.status === CallStatus.Ongoing;
  const isRinging = active.session.status === CallStatus.Ringing;
  // Caller joins LiveKit while ringing so the room is ready when the peer accepts.
  // Callee joins only after accept (Ongoing).
  const canJoinMedia = Boolean(
    token &&
      url &&
      !parked &&
      (isOngoing || (active.role === 'caller' && isRinging)),
  );

  return (
    <View style={[styles.overlay, { backgroundColor: '#050506' }]}>
      {parked ? (
        <View style={styles.centerMeta}>
          <Ionicons name="pause" size={48} color="#fbbf24" />
          <Text variant="h2" color="#fbbf24">
            On hold
          </Text>
          <Text muted style={{ textAlign: 'center', paddingHorizontal: 32 }}>
            Please wait — you will be reconnected shortly.
          </Text>
        </View>
      ) : canJoinMedia ? (
        <View style={StyleSheet.absoluteFill}>
          <LiveKitStage
            token={token!}
            serverUrl={url!}
            publish
            audioOnly={!isVideo}
            layout="speaker"
            // Fills the screen; pinch to zoom and double-tap swaps to contain.
            videoFit="cover"
            onDisconnected={() => {
              if (endingRef.current) return;
              const state = useCallStore.getState();
              if (state.parked) return;
              const current = state.active;
              if (!current) return;
              // Server pulled us out of the old room (hold / merge / call-waiting)
              // while we were switching. The store already points somewhere else.
              if (current.session.token !== token) return;
              if (
                state.heldCall &&
                String(state.heldCall.callId) === String(current.session.id)
              ) {
                return;
              }
              // Still ringing — LiveKit teardown is not a hangup.
              if (current.session.status === CallStatus.Ringing) return;
              // Merge / hold room swaps need a longer grace — B often reconnects
              // into the conference a few seconds after unhold.
              if (Date.now() - sessionSwapRef.current < 8000) return;
              void endCall();
            }}
            onRoom={onRoom}
            style={{ flex: 1, borderRadius: 0 }}
          />
        </View>
      ) : (
        <View style={styles.centerMeta}>
          <Avatar uri={peer?.avatarUrl} name={peer?.displayName} size={88} />
          <Text variant="h2">{peer?.displayName ?? 'Call'}</Text>
          <Text muted style={{ marginTop: 8 }}>
            {isRinging ? 'Ringing…' : 'Connecting…'}
          </Text>
          <ActivityIndicator color={c.primary} style={{ marginTop: 12 }} />
        </View>
      )}

      <View style={styles.topMeta} pointerEvents="box-none">
        <Text variant="caption" muted>
          {active.session.status === CallStatus.Ringing ? 'Ringing…' : formatDuration(elapsed)}
        </Text>
        <Text variant="bodyBold">
          {(active.participants?.length
            ? active.participants.map((p) =>
                p.name && !/^[a-f0-9]{24}$/i.test(p.name) ? p.name : peer?.displayName || 'Peer',
              )
            : peer?.displayName && !/^[a-f0-9]{24}$/i.test(peer.displayName)
              ? [peer.displayName]
              : []
          ).join(' · ') || 'Call'}
        </Text>
        {active.participants.length > 1 ? (
          <Text variant="caption" color="#a5b4fc" style={{ marginTop: 4 }}>
            Conference · {active.participants.length + 1} people
          </Text>
        ) : null}
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
          {isOngoing && !heldCall && !parked ? (
            <AddCallParticipant callId={active.session.id} type={active.session.type} mode="invite" />
          ) : null}
          {isOngoing && !heldCall && !parked ? (
            <AddCallParticipant callId={active.session.id} type={active.session.type} mode="consult" />
          ) : null}
        </View>
        {isOngoing && !parked
          ? (active.participants?.length
              ? active.participants
              : active.peer?.id
                ? [{ id: active.peer.id, name: active.peer.displayName ?? 'peer' }]
                : []
            ).map((p) => (
              <View
                key={p.id}
                style={{
                  marginTop: 8,
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                  borderRadius: 999,
                  backgroundColor: 'rgba(255,255,255,0.12)',
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <Text variant="caption" color="#fff">
                  {p.name}
                </Text>
                <Pressable onPress={() => kickPeer(p.id, p.name)} hitSlop={8}>
                  <Text variant="tiny" color={c.danger}>
                    Remove
                  </Text>
                </Pressable>
              </View>
            ))
          : null}
      </View>

      {incoming ? (
        <View style={[styles.waitingBanner, { backgroundColor: 'rgba(0,0,0,0.82)', borderColor: c.border }]}>
          <Text variant="bodyBold">
            {incoming.caller?.displayName ?? 'Someone'} is calling
            {incoming.interrupt ? ' (waiting)' : ''}
          </Text>
          <Text muted variant="caption" style={{ marginBottom: 8 }}>
            {incoming.type === CallType.Video ? 'Video' : 'Audio'} — Accept puts your current call on hold
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

      {isVideo && isOngoing ? (
        <View style={styles.filterBar}>
          <FaceFilterPublisher room={room} />
          <FilterSelector compact />
        </View>
      ) : null}

      {/* Edge-to-edge is mandatory on Expo SDK 57, so a fixed offset can leave
          the row under the Android navigation bar. */}
      <View style={[styles.controls, { bottom: insets.bottom + 28 }]}>
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
        {isVideo && !active.cameraOff ? (
          <Ctrl
            icon="camera-reverse"
            label="Flip"
            onPress={() => void flipCamera()}
            color={c.elevated}
          />
        ) : null}
        <Ctrl
          icon="call"
          label={
            heldCall
              ? 'End all'
              : (active.participants?.length ?? 0) >= 2
                ? 'Leave'
                : 'End'
          }
          onPress={heldCall ? endAllCalls : endCall}
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
    bottom: 132,
    left: 0,
    right: 0,
    zIndex: 50,
    elevation: 50,
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
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    paddingHorizontal: 16,
    // Above the video tiles, the self-view and the filter carousel — the
    // end-call button must never be covered.
    zIndex: 60,
    elevation: 60,
  },
  ctrl: { alignItems: 'center', gap: 6 },
});
