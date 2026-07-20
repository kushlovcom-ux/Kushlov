import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from '@/components/ui/Text';
import { useThemeColors } from '@/hooks/useThemeColors';
import { radius, spacing } from '@/theme';
import type { ChatMessage } from '@/types';
import { formatRelative } from '@/utils/format';

type Props = {
  message: ChatMessage;
  isMine?: boolean;
  mine?: boolean;
  onLongPress?: () => void;
};

export function MessageBubble({ message, isMine, mine, onLongPress }: Props) {
  const c = useThemeColors();
  const mineSide = isMine ?? mine ?? false;
  if (message.deletedAt) {
    return (
      <View style={[styles.row, mineSide && styles.mine]}>
        <Text muted variant="caption" style={styles.deleted}>
          Message deleted
        </Text>
      </View>
    );
  }

  return (
    <Pressable
      onLongPress={onLongPress}
      style={[styles.row, mineSide && styles.mine]}
    >
      <View
        style={[
          styles.bubble,
          {
            backgroundColor: mineSide ? c.primary : c.elevated,
            borderBottomRightRadius: mineSide ? 4 : radius.lg,
            borderBottomLeftRadius: mineSide ? radius.lg : 4,
          },
        ]}
      >
        <Text color={isMine ? '#fff' : c.text}>{message.text || '[media]'}</Text>
        <Text
          variant="tiny"
          style={{ marginTop: 4, color: isMine ? 'rgba(255,255,255,0.7)' : c.textMuted }}
        >
          {formatRelative(message.createdAt)}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { marginVertical: 4, alignItems: 'flex-start' },
  mine: { alignItems: 'flex-end' },
  bubble: {
    maxWidth: '80%',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.lg,
  },
  deleted: { fontStyle: 'italic', paddingHorizontal: 8 },
});
