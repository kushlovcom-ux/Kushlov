import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '@/components/ui/Text';
import type { Room } from 'livekit-client';

type Props = {
  room: Room | null;
  audioOnly?: boolean;
};

/** Mic / camera toggles for the live host, rendered above LiveKit (not under SurfaceView). */
export function HostMediaBar({ room, audioOnly = false }: Props) {
  const [mic, setMic] = useState(true);
  const [cam, setCam] = useState(true);

  useEffect(() => {
    const p = room?.localParticipant;
    if (!p) return;
    setMic(p.isMicrophoneEnabled);
    setCam(p.isCameraEnabled);
  }, [room]);

  if (!room) return null;

  return (
    <View style={styles.row}>
      <Pressable
        accessibilityLabel={mic ? 'Mute microphone' : 'Unmute microphone'}
        onPress={() => {
          const next = !mic;
          setMic(next);
          void room.localParticipant.setMicrophoneEnabled(next);
        }}
        style={[styles.btn, !mic && styles.btnOff]}
      >
        <Ionicons name={mic ? 'mic' : 'mic-off'} size={20} color="#fff" />
        <Text style={styles.label}>{mic ? 'Mute' : 'Unmute'}</Text>
      </Pressable>
      {!audioOnly ? (
        <Pressable
          accessibilityLabel={cam ? 'Turn camera off' : 'Turn camera on'}
          onPress={() => {
            const next = !cam;
            setCam(next);
            void room.localParticipant.setCameraEnabled(next);
          }}
          style={[styles.btn, !cam && styles.btnOff]}
        >
          <Ionicons name={cam ? 'videocam' : 'videocam-off'} size={20} color="#fff" />
          <Text style={styles.label}>{cam ? 'Camera' : 'Cam off'}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 12,
    marginBottom: 8,
  },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: 'rgba(8,8,12,0.72)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.22)',
  },
  btnOff: {
    backgroundColor: 'rgba(239,68,68,0.88)',
    borderColor: 'rgba(255,255,255,0.2)',
  },
  label: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
});
