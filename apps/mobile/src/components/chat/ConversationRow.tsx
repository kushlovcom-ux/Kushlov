import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Avatar } from '@/components/ui/Avatar';
import { Text } from '@/components/ui/Text';
import { PressableScale } from '@/design-system';
import { OnlineStatus } from '@/components/common/OnlineStatus';
import { useThemeColors } from '@/hooks/useThemeColors';
import { radius, spacing } from '@/theme';
import type { Conversation, PublicUser } from '@/types';
import { formatRelative } from '@/utils/format';

type Props = {
  conversation: Conversation;
  meId?: string;
  onPress: () => void;
};

export function ConversationRow({ conversation, meId, onPress }: Props) {
  const c = useThemeColors();
  const peer =
    conversation.participants?.find((p: PublicUser) => p.id !== meId) ??
    conversation.participants?.[0];
  const unread = conversation.unreadCount ?? 0;

  return (
    <PressableScale
      onPress={onPress}
      style={[
        styles.row,
        {
          backgroundColor: unread > 0 ? c.primaryMuted : c.card,
          borderColor: c.border,
        },
      ]}
    >
      <View>
        <Avatar uri={peer?.avatarUrl} name={peer?.displayName} size={56} />
        <OnlineStatus online={peer?.isOnline} absolute />
      </View>
      <View style={{ flex: 1 }}>
        <View style={styles.top}>
          <Text variant="bodyBold" numberOfLines={1} style={{ flex: 1 }}>
            {peer?.displayName ?? 'Chat'}
          </Text>
          <Text variant="caption" muted>
            {formatRelative(conversation.lastMessage?.createdAt ?? conversation.updatedAt)}
          </Text>
        </View>
        <View style={styles.top}>
          <Text variant="caption" muted numberOfLines={1} style={{ flex: 1 }}>
            {conversation.lastMessage?.text ?? 'Say hello'}
          </Text>
          {unread > 0 ? (
            <View style={[styles.badge, { backgroundColor: c.primary }]}>
              <Text variant="tiny" color="#fff" style={{ textTransform: 'none' }}>
                {unread > 99 ? '99+' : unread}
              </Text>
            </View>
          ) : null}
        </View>
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  top: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  badge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
});
