import React from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
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
  /** Portrait grid card (website-style). Default row for lists. */
  variant?: 'portrait' | 'row';
  onLike?: () => void;
  onMessage?: () => void;
};

export function UserCard({ user, onPress, variant = 'row', onLike, onMessage }: Props) {
  const c = useThemeColors();
  const age = ageFromDob(user.dob);
  const isHost = user.role === 'host' && user.isHostApproved;

  if (variant === 'portrait') {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          styles.portrait,
          {
            backgroundColor: c.card,
            borderColor: c.border,
            opacity: pressed ? 0.94 : 1,
          },
        ]}
      >
        <View style={styles.media}>
          {user.avatarUrl ? (
            <Image source={{ uri: user.avatarUrl }} style={styles.cover} />
          ) : (
            <LinearGradient colors={[c.purple + '55', c.pink + '44']} style={styles.cover}>
              <Avatar uri={undefined} name={user.displayName} size={56} />
            </LinearGradient>
          )}
          {isHost ? (
            <View style={styles.hostBadge}>
              <Badge label="Host" tone="pink" />
            </View>
          ) : null}
          <View style={styles.onlineDot}>
            <OnlineStatus online={user.isOnline} size={10} />
          </View>
        </View>

        <View style={styles.portraitBody}>
          <View style={styles.nameRow}>
            <Text variant="bodyBold" numberOfLines={1} style={{ flexShrink: 1 }}>
              {user.displayName}
              {age != null ? `, ${age}` : ''}
            </Text>
            {isHost ? <VerifiedBadge /> : null}
          </View>
          <Text variant="caption" muted numberOfLines={1}>
            @{user.username}
          </Text>
          {isHost && user.averageRating ? (
            <StarRating rating={user.averageRating} count={user.totalReviews} />
          ) : null}
          {user.distanceKm != null ? (
            <Text variant="tiny" color={c.pink} style={{ marginTop: 2 }}>
              {formatDistance(user.distanceKm)}
            </Text>
          ) : null}
          {user.isBusy ? <Badge label="Busy" tone="orange" /> : null}

          {(onLike || onMessage) && (
            <View style={styles.actions}>
              {onLike ? (
                <Pressable
                  onPress={onLike}
                  style={[styles.actionBtn, { backgroundColor: c.primaryMuted }]}
                  hitSlop={6}
                >
                  <Ionicons name="heart" size={16} color={c.pink} />
                </Pressable>
              ) : null}
              {onMessage ? (
                <Pressable
                  onPress={onMessage}
                  style={[styles.actionBtn, { backgroundColor: c.elevated, borderColor: c.border, borderWidth: 1 }]}
                  hitSlop={6}
                >
                  <Ionicons name="chatbubble" size={15} color={c.text} />
                </Pressable>
              ) : null}
            </View>
          )}
        </View>
      </Pressable>
    );
  }

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
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
          {isHost ? <VerifiedBadge /> : null}
        </View>
        <Text variant="caption" muted numberOfLines={1}>
          @{user.username}
          {user.distanceKm != null ? ` · ${formatDistance(user.distanceKm)}` : ''}
        </Text>
        {user.averageRating ? (
          <StarRating rating={user.averageRating} count={user.totalReviews} />
        ) : null}
        <View style={styles.badges}>
          {isHost ? <Badge label="Host" tone="purple" /> : null}
          {user.isBusy ? <Badge label="Busy" tone="orange" /> : null}
          {user.isPopularHost ? <Badge label="Popular" tone="pink" /> : null}
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  portrait: {
    flex: 1,
    borderRadius: radius.xl ?? 20,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  media: {
    aspectRatio: 4 / 3,
    backgroundColor: '#1a1220',
  },
  cover: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  hostBadge: { position: 'absolute', left: 8, top: 8 },
  onlineDot: {
    position: 'absolute',
    right: 8,
    bottom: 8,
    padding: 2,
    borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  portraitBody: {
    padding: spacing.sm,
    gap: 2,
    flex: 1,
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: spacing.sm,
  },
  actionBtn: {
    flex: 1,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: {
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
