import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { Text } from '@/components/ui/Text';
import { OnlineStatus } from './OnlineStatus';
import { StarRating } from './StarRating';
import { VerifiedBadge } from './VerifiedBadge';
import { useThemeColors } from '@/hooks/useThemeColors';
import { radius, spacing } from '@/theme';
import type { PublicUser } from '@/types';
import { formatDistance } from '@/utils/distance';
import { ageFromDob } from '@/utils/age';

type Props = {
  user: PublicUser;
  onPress?: () => void;
};

export function UserCard({ user, onPress }: Props) {
  const c = useThemeColors();
  const age = ageFromDob(user.dob);

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: c.card,
          borderColor: c.border,
          opacity: pressed ? 0.9 : 1,
        },
      ]}
    >
      <View>
        <Avatar uri={user.avatarUrl} name={user.displayName} size={64} />
        <OnlineStatus online={user.isOnline} absolute />
      </View>
      <View style={{ flex: 1, gap: 4 }}>
        <View style={styles.nameRow}>
          <Text variant="bodyBold" numberOfLines={1} style={{ flexShrink: 1 }}>
            {user.displayName}
            {age != null ? `, ${age}` : ''}
          </Text>
          {user.isHostApproved ? <VerifiedBadge /> : null}
        </View>
        <Text variant="caption" muted numberOfLines={1}>
          @{user.username}
          {user.distanceKm != null ? ` · ${formatDistance(user.distanceKm)}` : ''}
        </Text>
        {user.averageRating ? (
          <StarRating rating={user.averageRating} count={user.totalReviews} />
        ) : null}
        <View style={styles.badges}>
          {user.role === 'host' ? <Badge label="Host" tone="purple" /> : null}
          {user.isBusy ? <Badge label="Busy" tone="orange" /> : null}
          {user.isPopularHost ? <Badge label="Popular" tone="pink" /> : null}
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
  },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 2 },
});
