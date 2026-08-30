import React, { useEffect, useRef, useState } from 'react';
import { Alert, Modal, Pressable, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import {
  AudioModule,
  RecordingPresets,
  setAudioModeAsync,
  useAudioRecorder,
} from 'expo-audio';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Input } from '@/components/ui/Input';
import { Text } from '@/components/ui/Text';
import { useKeyboard } from '@/hooks/useKeyboard';
import { useThemeColors } from '@/hooks/useThemeColors';
import { haptics } from '@/utils/haptics';
import { radius, spacing } from '@/theme';

export type AttachKind = 'photo' | 'video' | 'document';

export type VoiceNote = {
  uri: string;
  mimeType: string;
  fileName: string;
  durationSec: number;
};

type Props = {
  onSend: (text: string) => void;
  onAttach?: (kind: AttachKind) => void;
  onVoice?: (note: VoiceNote) => void;
  disabled?: boolean;
  onTyping?: (typing: boolean) => void;
};

const ATTACH_OPTIONS: { kind: AttachKind; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { kind: 'photo', label: 'Photo', icon: 'image-outline' },
  { kind: 'video', label: 'Video', icon: 'videocam-outline' },
  { kind: 'document', label: 'Document', icon: 'document-text-outline' },
];

/** Below this a tap on the mic reads as a mis-tap, not a voice note. */
const MIN_VOICE_MS = 800;

function clock(ms: number) {
  const total = Math.floor(ms / 1000);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

export function ChatInput({ onSend, onAttach, onVoice, disabled, onTyping }: Props) {
  const c = useThemeColors();
  const insets = useSafeAreaInsets();
  const keyboard = useKeyboard();
  // Edge-to-edge draws under the gesture bar, so the row needs its own bottom
  // inset — but only while the keyboard is down, since the keyboard covers
  // that area and KeyboardAvoidingView already pads for its full height.
  const rowStyle = {
    borderTopColor: c.border,
    backgroundColor: c.bgElevated,
    paddingBottom: spacing.sm + (keyboard.visible ? 0 : insets.bottom),
  };
  const [text, setText] = useState('');
  const [sheet, setSheet] = useState(false);
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const startedAt = useRef(0);
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);

  useEffect(() => {
    if (!recording) return;
    const timer = setInterval(() => setElapsed(Date.now() - startedAt.current), 250);
    return () => clearInterval(timer);
  }, [recording]);

  const submit = () => {
    const t = text.trim();
    if (!t || disabled) return;
    onSend(t);
    setText('');
    onTyping?.(false);
  };

  const startRecording = async () => {
    if (disabled) return;
    try {
      const perm = await AudioModule.requestRecordingPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Microphone needed', 'Allow microphone access to record a voice note.');
        return;
      }
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
      startedAt.current = Date.now();
      setElapsed(0);
      setRecording(true);
      void haptics.medium();
    } catch {
      Alert.alert('Recording failed', 'Could not start the recorder. Try again.');
    }
  };

  const stopRecording = async (keep: boolean) => {
    if (!recording) return;
    // Measured on the JS side: the recorder's own duration lags the poll interval.
    const ms = Date.now() - startedAt.current;
    setRecording(false);
    let uri: string | null = null;
    try {
      await recorder.stop();
      uri = recorder.uri;
    } catch {
      /* recorder already torn down */
    }
    // Releases the audio session so playback is not forced through the earpiece.
    await setAudioModeAsync({ allowsRecording: false }).catch(() => undefined);
    if (!keep) return;
    if (!uri) {
      Alert.alert('Voice note', 'Nothing was recorded.');
      return;
    }
    if (ms < MIN_VOICE_MS) {
      Alert.alert('Too short', 'Hold the mic a little longer to record a voice note.');
      return;
    }
    void haptics.success();
    onVoice?.({
      uri,
      mimeType: 'audio/m4a',
      fileName: `voice-${Date.now()}.m4a`,
      durationSec: Math.round(ms / 1000),
    });
  };

  const canSend = Boolean(text.trim()) && !disabled;

  if (recording) {
    return (
      <View style={[styles.row, rowStyle]}>
        <Pressable
          onPress={() => void stopRecording(false)}
          style={[styles.icon, { backgroundColor: c.elevated }]}
          accessibilityLabel="Cancel recording"
        >
          <Ionicons name="trash-outline" size={20} color={c.danger} />
        </Pressable>
        <View style={styles.recording}>
          <View style={[styles.recDot, { backgroundColor: c.danger }]} />
          <Text variant="bodyBold">{clock(elapsed)}</Text>
          <Text muted variant="caption">
            Recording…
          </Text>
        </View>
        <Pressable onPress={() => void stopRecording(true)} accessibilityLabel="Send voice note">
          <LinearGradient colors={[...c.gradientSoft]} style={styles.send}>
            <Ionicons name="send" size={18} color="#fff" />
          </LinearGradient>
        </Pressable>
      </View>
    );
  }

  return (
    <>
      <View style={[styles.row, rowStyle]}>
        {onAttach ? (
          <Pressable
            onPress={() => setSheet(true)}
            style={[styles.icon, { backgroundColor: c.elevated }]}
            accessibilityLabel="Add attachment"
          >
            <Ionicons name="add" size={24} color={c.textSecondary} />
          </Pressable>
        ) : null}
        <View style={{ flex: 1 }}>
          <Input
            value={text}
            onChangeText={(v) => {
              setText(v);
              onTyping?.(v.trim().length > 0);
            }}
            placeholder="Message…"
            editable={!disabled}
            onSubmitEditing={submit}
            returnKeyType="send"
          />
        </View>
        {canSend || !onVoice ? (
          <Pressable
            onPress={submit}
            disabled={!canSend}
            accessibilityLabel="Send"
            style={{ opacity: canSend ? 1 : 0.45 }}
          >
            <LinearGradient colors={[...c.gradientSoft]} style={styles.send}>
              <Ionicons name="send" size={18} color="#fff" />
            </LinearGradient>
          </Pressable>
        ) : (
          <Pressable
            onPress={() => void startRecording()}
            accessibilityLabel="Record voice note"
            style={[styles.icon, { backgroundColor: c.elevated }]}
          >
            <Ionicons name="mic" size={22} color={c.primary} />
          </Pressable>
        )}
      </View>

      <Modal visible={sheet} transparent animationType="fade" onRequestClose={() => setSheet(false)}>
        <Pressable style={styles.backdrop} onPress={() => setSheet(false)}>
          <Pressable
            style={[styles.sheet, { backgroundColor: c.card, borderColor: c.border }]}
            onPress={() => undefined}
          >
            {ATTACH_OPTIONS.map((option) => (
              <Pressable
                key={option.kind}
                style={styles.sheetRow}
                onPress={() => {
                  setSheet(false);
                  onAttach?.(option.kind);
                }}
              >
                <View style={[styles.sheetIcon, { backgroundColor: c.elevated }]}>
                  <Ionicons name={option.icon} size={20} color={c.primary} />
                </View>
                <Text variant="bodyBold">{option.label}</Text>
              </Pressable>
            ))}
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  icon: {
    width: 44,
    height: 44,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  send: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recording: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: spacing.sm,
  },
  recDot: { width: 10, height: 10, borderRadius: 5 },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
    padding: spacing.lg,
  },
  sheet: {
    borderRadius: radius['2xl'],
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing.md,
    gap: 4,
    marginBottom: spacing.xl,
  },
  sheetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.lg,
  },
  sheetIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
