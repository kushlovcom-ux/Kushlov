import React from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { Text } from '@/components/ui/Text';
import { PressableScale } from '@/design-system';
import { OnlineStatus } from './OnlineStatus';
import { StarRating } from './StarRating';
import { VerifiedBadge } from './VerifiedBadge';
import { useThemeColors } from '@/hooks/useThemeColors';
import { elevation, radius, spacing } from '@/theme';
import type { PublicUser } from '@/types';
import { formatDistance } from '@/utils/distance';
import { ageFromDob } from '@/utils/age';

type Props = {
  user: PublicUser;
  onPress?: () => void;
  /** Portrait grid card. `compact` is a smaller premium card for home grids. */
  variant?: 'portrait' | 'portraitCompact' | 'row';
  onLike?: () => void;
  onMessage?: () => void;
};

export function UserCard({ user, onPress, variant = 'row', onLike, onMessage }: Props) {
  const c = useThemeColors();
  const age = ageFromDob(user.dob);
  const isHost = user.role === 'host' && user.isHostApproved;
  const compact = variant === 'portraitCompact';

  if (variant === 'portrait' || compact) {
    return (
      <PressableScale
        onPress={onPress}
        style={[
          styles.portrait,
          compact && styles.portraitCompact,
          {
            backgroundColor: c.card,
            borderColor: compact ? 'transparent' : c.border,
            shadowColor: c.primary,
          },
          compact ? elevation.md : elevation.sm,
        ]}
      >
        {compact ? (
          <LinearGradient
            colors={[c.pink + '66', c.purple + '44', c.accent + '33']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.compactRing}
          >
            <View style={[styles.compactInner, { backgroundColor: c.card }]}>
              <PortraitMedia
                user={user}
                isHost={isHost}
                compact
                age={age}
                onLike={onLike}
                onMessage={onMessage}
              />
            </View>
          </LinearGradient>
        ) : (
          <PortraitMedia
            user={user}
            isHost={isHost}
            compact={false}
            age={age}
            onLike={onLike}
            onMessage={onMessage}
          />
        )}
      </PressableScale>
    );
  }

  return (
    <PressableScale
      onPress={onPress}
      style={[
        styles.row,
        {
          backgroundColor: c.card,
          borderColor: c.border,
        },
        elevation.sm,
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
    </PressableScale>
  );
}

function PortraitMedia({
  user,
  isHost,
  compact,
  age,
  onLike,
  onMessage,
}: {
  user: PublicUser;
  isHost: boolean;
  compact: boolean;
  age: number | null;
  onLike?: () => void;
  onMessage?: () => void;
}) {
  const c = useThemeColors();

  return (
    <>
      <View style={[styles.media, compact && styles.mediaCompact]}>
        {user.avatarUrl ? (
          <Image source={{ uri: user.avatarUrl }} style={styles.cover} />
        ) : (
          <LinearGradient colors={[c.purple + '55', c.pink + '44']} style={styles.cover}>
            <Avatar uri={undefined} name={user.displayName} size={compact ? 40 : 56} />
          </LinearGradient>
        )}
        <LinearGradient
          colors={['transparent', 'rgba(5,5,16,0.72)']}
          style={styles.mediaFade}
        />
        {isHost ? (
          <View style={[styles.hostBadge, compact && { left: 6, top: 6 }]}>
            <Badge label="Host" tone="pink" />
          </View>
        ) : null}
        <View style={[styles.onlineDot, compact && { right: 6, bottom: 6 }]}>
          <OnlineStatus online={user.isOnline} size={compact ? 8 : 10} />
        </View>
        {compact ? (
          <View style={styles.compactOverlay}>
            <View style={styles.nameRow}>
              <Text variant="captionBold" color="#fff" numberOfLines={1} style={{ flexShrink: 1 }}>
                {user.displayName}
                {age != null ? `, ${age}` : ''}
              </Text>
              {isHost ? <VerifiedBadge size={12} /> : null}
            </View>
            {user.distanceKm != null ? (
              <Text variant="tiny" color="rgba(255,255,255,0.85)" numberOfLines={1}>
                {formatDistance(user.distanceKm)}
              </Text>
            ) : (
              <Text variant="tiny" color="rgba(255,255,255,0.7)" numberOfLines={1}>
                @{user.username}
              </Text>
            )}
          </View>
        ) : null}
      </View>

      {!compact ? (
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
            <Text variant="caption" color={c.pink} style={{ marginTop: 2 }}>
              {formatDistance(user.distanceKm)}
            </Text>
          ) : null}
          {user.isBusy ? <Badge label="Busy" tone="orange" /> : null}

          {(onLike || onMessage) && (
            <View style={styles.actions}>
              {onLike ? (
                <PressableScale
                  onPress={onLike}
                  style={[styles.actionBtn, { backgroundColor: c.primaryMuted }]}
                  accessibilityLabel="Like"
                >
                  <Ionicons name="heart" size={16} color={c.pink} />
                </PressableScale>
              ) : null}
              {onMessage ? (
                <PressableScale
                  onPress={onMessage}
                  style={[
                    styles.actionBtn,
                    {
                      backgroundColor: c.elevated,
                      borderColor: c.border,
                      borderWidth: StyleSheet.hairlineWidth,
                    },
                  ]}
                  accessibilityLabel="Message"
                >
                  <Ionicons name="chatbubble" size={15} color={c.text} />
                </PressableScale>
              ) : null}
            </View>
          )}
        </View>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  portrait: {
    flex: 1,
    borderRadius: radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  portraitCompact: {
    borderWidth: 0,
    borderRadius: radius.lg,
  },
  compactRing: {
    borderRadius: radius.lg,
    padding: 1.5,
  },
  compactInner: {
    borderRadius: radius.lg - 1,
    overflow: 'hidden',
  },
  media: {
    aspectRatio: 3 / 4,
    backgroundColor: '#1a1220',
  },
  mediaCompact: {
    aspectRatio: 1,
  },
  cover: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mediaFade: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    top: '40%',
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
  compactOverlay: {
    position: 'absolute',
    left: 8,
    right: 8,
    bottom: 8,
    gap: 2,
  },
  portraitBody: {
    padding: spacing.md,
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
    height: 36,
    borderRadius: radius.md,
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
