import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Avatar } from '@/components/ui/Avatar';
import { Text } from '@/components/ui/Text';
import { OnlineStatus } from '@/components/common/OnlineStatus';
import { useThemeColors } from '@/hooks/useThemeColors';
import { spacing } from '@/theme';
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
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        { borderBottomColor: c.border, opacity: pressed ? 0.85 : 1 },
      ]}
    >
      <View>
        <Avatar uri={peer?.avatarUrl} name={peer?.displayName} size={52} />
        <OnlineStatus online={peer?.isOnline} absolute />
      </View>
      <View style={{ flex: 1 }}>
        <View style={styles.top}>
          <Text variant="bodyBold" numberOfLines={1} style={{ flex: 1 }}>
            {peer?.displayName ?? 'Chat'}
          </Text>
          <Text variant="tiny" muted>
            {formatRelative(conversation.lastMessage?.createdAt ?? conversation.updatedAt)}
          </Text>
        </View>
        <View style={styles.top}>
          <Text variant="caption" muted numberOfLines={1} style={{ flex: 1 }}>
            {conversation.lastMessage?.text ?? 'Say hello'}
          </Text>
          {unread > 0 ? (
            <View style={[styles.badge, { backgroundColor: c.primary }]}>
              <Text variant="tiny" color="#fff">
                {unread > 99 ? '99+' : unread}
              </Text>
            </View>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
  },
  top: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  badge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
});
