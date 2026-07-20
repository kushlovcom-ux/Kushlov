import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Input } from '@/components/ui/Input';
import { useThemeColors } from '@/hooks/useThemeColors';
import { spacing } from '@/theme';

type Props = {
  onSend: (text: string) => void;
  onAttach?: () => void;
  disabled?: boolean;
  onTyping?: (typing: boolean) => void;
};

export function ChatInput({ onSend, onAttach, disabled, onTyping }: Props) {
  const c = useThemeColors();
  const [text, setText] = useState('');

  const submit = () => {
    const t = text.trim();
    if (!t || disabled) return;
    onSend(t);
    setText('');
    onTyping?.(false);
  };

  return (
    <View style={[styles.row, { borderTopColor: c.border, backgroundColor: c.bg }]}>
      {onAttach ? (
        <Pressable onPress={onAttach} style={styles.icon}>
          <Ionicons name="image-outline" size={22} color={c.textSecondary} />
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
      <Pressable
        onPress={submit}
        disabled={disabled || !text.trim()}
        style={[
          styles.send,
          { backgroundColor: c.primary, opacity: !text.trim() || disabled ? 0.5 : 1 },
        ]}
      >
        <Ionicons name="send" size={18} color="#fff" />
      </Pressable>
    </View>
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
  icon: { padding: 8 },
  send: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
