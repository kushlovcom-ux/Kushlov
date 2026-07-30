import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
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
    <Pressable onLongPress={onLongPress} style={[styles.row, mineSide && styles.mine]}>
      {mineSide ? (
        <LinearGradient
          colors={[...c.gradientSoft]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.bubble, styles.mineBubble]}
        >
          <Text color="#fff">{message.text || '[media]'}</Text>
          <Text variant="tiny" style={{ marginTop: 4, color: 'rgba(255,255,255,0.72)' }}>
            {formatRelative(message.createdAt)}
          </Text>
        </LinearGradient>
      ) : (
        <View
          style={[
            styles.bubble,
            styles.peerBubble,
            { backgroundColor: c.elevated, borderColor: c.border },
          ]}
        >
          <Text color={c.text}>{message.text || '[media]'}</Text>
          <Text variant="tiny" style={{ marginTop: 4, color: c.textMuted }}>
            {formatRelative(message.createdAt)}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { marginVertical: 5, alignItems: 'flex-start' },
  mine: { alignItems: 'flex-end' },
  bubble: {
    maxWidth: '80%',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
  },
  mineBubble: {
    borderRadius: radius.xl,
    borderBottomRightRadius: 6,
  },
  peerBubble: {
    borderRadius: radius.xl,
    borderBottomLeftRadius: 6,
    borderWidth: StyleSheet.hairlineWidth,
  },
  deleted: { fontStyle: 'italic', paddingHorizontal: 8 },
});
