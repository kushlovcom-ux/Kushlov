import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '@/components/ui/Button';
import { Text } from '@/components/ui/Text';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorView } from '@/components/ui/ErrorView';
import { Skeleton } from '@/components/ui/Skeleton';
import { Avatar } from '@/components/ui/Avatar';
import { Header } from '@/components/common/Header';
import { Screen, useScreenRefresh } from '@/components/common/Screen';
import { StarRating } from '@/components/common/StarRating';
import { VerifiedBadge } from '@/components/common/VerifiedBadge';
import { GlassCard, PressableScale } from '@/design-system';
import { callsApi } from '@/api/calls';
import { chatApi } from '@/api/chat';
import { getErrorMessage } from '@/api/client';
import { reviewsApi } from '@/api/reviews';
import { socialApi } from '@/api/social';
import { usersApi } from '@/api/users';
import { queryKeys } from '@/constants/queryKeys';
import { useAuthStore } from '@/store/auth';
import { useCallStore } from '@/store/call';
import { useThemeColors } from '@/hooks/useThemeColors';
import { CallType, Role } from '@/types';
import { ageFromDob } from '@/utils/age';
import { radius, spacing } from '@/theme';
import type { AppStackParamList } from '@/navigation/types';

type Props = NativeStackScreenProps<AppStackParamList, 'PublicProfile'>;

export function PublicProfileScreen({ navigation, route }: Props) {
  const { userId } = route.params;
  const c = useThemeColors();
  const qc = useQueryClient();
  const me = useAuthStore((s) => s.user);
  const startCall = useCallStore((s) => s.startCall);
  const [liking, setLiking] = useState(false);
  const [rating, setRating] = useState(5);
  const [reviewText, setReviewText] = useState('');
  const [prefilled, setPrefilled] = useState(false);

  const userQ = useQuery({
    queryKey: queryKeys.user(userId),
    queryFn: () => usersApi.getById(userId),
  });
  const reviewsQ = useQuery({
    queryKey: queryKeys.reviews(userId),
    queryFn: () => reviewsApi.listForHost(userId, { limit: 20 }),
  });
  const myReview = useQuery({
    queryKey: ['my-review', userId],
    queryFn: () => reviewsApi.mineForHost(userId),
    enabled: me?.role === Role.User && me.id !== userId,
  });

  useEffect(() => {
    if (myReview.data && !prefilled) {
      setRating(myReview.data.rating);
      setReviewText(myReview.data.text ?? '');
      setPrefilled(true);
    }
  }, [myReview.data, prefilled]);

  const like = useMutation({
    mutationFn: () => socialApi.like(userId),
    onSuccess: (data) => {
      if (data.matched) Alert.alert("It's a match!", 'You can now message each other.');
      qc.invalidateQueries({ queryKey: queryKeys.matches });
    },
  });

  const saveReview = useMutation({
    mutationFn: () => reviewsApi.upsert({ hostId: userId, rating, text: reviewText }),
    onSuccess: () => {
      Alert.alert('Thanks!', myReview.data ? 'Review updated.' : 'Review submitted.');
      qc.invalidateQueries({ queryKey: queryKeys.reviews(userId) });
      qc.invalidateQueries({ queryKey: ['my-review', userId] });
      qc.invalidateQueries({ queryKey: queryKeys.user(userId) });
    },
    onError: (err) => Alert.alert('Review', getErrorMessage(err)),
  });

  const message = async () => {
    try {
      const conv = await chatApi.openConversation(userId);
      if (!conv.id) {
        Alert.alert('Chat', 'Could not open conversation. Please try again.');
        return;
      }
      navigation.navigate('Chat', {
        conversationId: conv.id,
        title: userQ.data?.displayName,
        peerId: userId,
      });
    } catch (err) {
      Alert.alert('Chat', getErrorMessage(err));
    }
  };

  const call = async (type: CallType) => {
    try {
      if (type === CallType.Video) {
        const cam = await ImagePicker.requestCameraPermissionsAsync();
        if (!cam.granted) {
          Alert.alert('Camera needed', 'Allow camera access to start a video call.');
          return;
        }
      }
      const session = await callsApi.initiate({ type, calleeId: userId });
      if (session.busy || session.interrupt) {
        Alert.alert(
          'User is busy',
          session.message ??
            'One of the invited users is busy on another call. Waiting if they accept…',
        );
        startCall(session, 'caller', userQ.data ?? undefined);
        return;
      }
      startCall(session, 'caller', userQ.data ?? undefined);
    } catch (err) {
      Alert.alert('Call failed', getErrorMessage(err));
    }
  };

  const onRefresh = useCallback(async () => {
    await Promise.all([userQ.refetch(), reviewsQ.refetch(), myReview.refetch()]);
  }, [userQ, reviewsQ, myReview]);
  const { refreshControl } = useScreenRefresh(onRefresh);

  if (userQ.isLoading) {
    return (
      <Screen>
        <Header title="Profile" showBack />
        <Skeleton height={220} borderRadius={radius.xl} />
      </Screen>
    );
  }

  if (userQ.isError || !userQ.data) {
    return (
      <Screen>
        <Header title="Profile" showBack />
        <ErrorView message={getErrorMessage(userQ.error)} onRetry={() => userQ.refetch()} />
      </Screen>
    );
  }

  const u = userQ.data;
  const age = ageFromDob(u.dob);
  const isHostProfile = u.role === Role.Host || Boolean(u.isHostApproved);
  const myId = me?.id ? String(me.id) : '';
  const canReview =
    me?.role === Role.User && isHostProfile && Boolean(myId) && myId !== String(userId);
  const avatarUri = u.avatarUrl;

  return (
    <Screen padded={false}>
      <LinearGradient colors={[...c.gradientNight]} style={StyleSheet.absoluteFill} />
      <ScrollView
        contentContainerStyle={styles.pad}
        showsVerticalScrollIndicator={false}
        refreshControl={refreshControl}
      >
        <Header title={u.displayName} showBack />

        <View style={styles.hero}>
          {u.coverUrl ? (
            <Image source={{ uri: u.coverUrl }} style={styles.cover} />
          ) : (
            <LinearGradient colors={[...c.gradientBrand]} style={styles.cover} />
          )}
          <LinearGradient
            colors={['transparent', c.bg]}
            style={styles.coverFade}
          />
          <View style={styles.avatarWrap}>
            <LinearGradient colors={[...c.gradientSoft]} style={styles.avatarRing}>
              <View style={[styles.avatarInner, { backgroundColor: c.bg }]}>
                <Avatar uri={avatarUri} name={u.displayName} size={92} />
              </View>
            </LinearGradient>
          </View>
        </View>

        <View style={styles.nameRow}>
          <Text variant="h1">
            {u.displayName}
            {age != null ? `, ${age}` : ''}
          </Text>
          {u.isHostApproved ? <VerifiedBadge size={20} /> : null}
        </View>
        <Text muted>@{u.username}</Text>
        {(u.averageRating || u.totalReviews) ? (
          <View style={{ marginTop: 8 }}>
            <StarRating rating={u.averageRating ?? 0} count={u.totalReviews} />
          </View>
        ) : null}
        {u.bio ? (
          <GlassCard style={{ marginTop: spacing.lg }}>
            <Text variant="captionBold" muted style={{ marginBottom: 6 }}>
              About
            </Text>
            <Text>{u.bio}</Text>
          </GlassCard>
        ) : null}

        <View style={styles.actions}>
          <View style={styles.actionSlot}>
            <Button
              title="Like"
              variant="primary"
              onPress={async () => {
                setLiking(true);
                try {
                  await like.mutateAsync();
                } catch (err) {
                  Alert.alert('Like', getErrorMessage(err));
                } finally {
                  setLiking(false);
                }
              }}
              loading={liking}
              fullWidth
            />
          </View>
          <View style={styles.actionSlot}>
            <Button title="Message" variant="primary" onPress={message} fullWidth />
          </View>
        </View>
        <View style={styles.callRow}>
          <PressableScale
            onPress={() => call(CallType.Audio)}
            style={[styles.callBtn, { backgroundColor: c.elevated, borderColor: c.border }]}
            accessibilityLabel="Audio call"
          >
            <Ionicons name="call" size={20} color={c.text} />
            <Text variant="captionBold">Audio</Text>
          </PressableScale>
          <PressableScale
            onPress={() => call(CallType.Video)}
            style={[styles.callBtn, { backgroundColor: c.primaryMuted, borderColor: c.primary }]}
            accessibilityLabel="Video call"
          >
            <Ionicons name="videocam" size={20} color={c.primary} />
            <Text variant="captionBold" color={c.primary}>
              Video
            </Text>
          </PressableScale>
        </View>

        {isHostProfile ? (
          <>
            <Text variant="h3" style={{ marginTop: spacing.xl, marginBottom: spacing.md }}>
              Reviews
            </Text>

            {canReview ? (
              <GlassCard style={{ marginBottom: spacing.lg }}>
                <Text variant="bodyBold" style={{ marginBottom: spacing.sm }}>
                  {myReview.data ? 'Update your review' : 'Leave a review'}
                </Text>
                <Text muted variant="caption" style={{ marginBottom: spacing.sm }}>
                  Rate your experience with this host.
                </Text>
                <View style={styles.starsRow}>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <Pressable key={n} onPress={() => setRating(n)} hitSlop={6}>
                      <Text
                        style={{
                          fontSize: 28,
                          color: n <= rating ? c.premiumGold : c.borderStrong,
                        }}
                      >
                        ★
                      </Text>
                    </Pressable>
                  ))}
                </View>
                <TextInput
                  value={reviewText}
                  onChangeText={setReviewText}
                  placeholder="Share your experience…"
                  placeholderTextColor={c.textMuted}
                  multiline
                  style={[
                    styles.reviewInput,
                    { color: c.text, borderColor: c.border, backgroundColor: c.elevated },
                  ]}
                />
                <Button
                  title={myReview.data ? 'Update review' : 'Submit review'}
                  variant="primary"
                  onPress={() => saveReview.mutate()}
                  loading={saveReview.isPending}
                  fullWidth
                  style={{ marginTop: spacing.md }}
                />
              </GlassCard>
            ) : me?.role !== Role.User ? (
              <Text muted style={{ marginBottom: spacing.md }}>
                Only normal users can leave host reviews.
              </Text>
            ) : null}

            {(reviewsQ.data?.items ?? []).length === 0 ? (
              <EmptyState title="No reviews yet" />
            ) : (
              (reviewsQ.data?.items ?? []).map((r) => (
                <View
                  key={r.id}
                  style={[styles.review, { backgroundColor: c.card, borderColor: c.border }]}
                >
                  <Text variant="bodyBold">{r.reviewer?.displayName ?? 'User'}</Text>
                  <StarRating rating={r.rating} />
                  {r.text ? (
                    <Text muted style={{ marginTop: 4 }}>
                      {r.text}
                    </Text>
                  ) : null}
                </View>
              ))
            )}
          </>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  pad: { paddingHorizontal: spacing.screen, paddingBottom: 48 },
  hero: { marginBottom: spacing.md },
  cover: { height: 180, borderRadius: radius['2xl'], width: '100%' },
  coverFade: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 80,
    borderBottomLeftRadius: radius['2xl'],
    borderBottomRightRadius: radius['2xl'],
  },
  avatarWrap: { marginTop: -52, marginBottom: spacing.sm, alignSelf: 'flex-start' },
  avatarRing: {
    width: 104,
    height: 104,
    borderRadius: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInner: {
    width: 98,
    height: 98,
    borderRadius: 49,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  actions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: spacing.lg,
    width: '100%',
  },
  actionSlot: {
    flex: 1,
    minWidth: 0,
  },
  callRow: { flexDirection: 'row', gap: 10, marginTop: spacing.md },
  callBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
  review: {
    marginBottom: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
  starsRow: { flexDirection: 'row', gap: 6, marginBottom: spacing.sm },
  reviewInput: {
    minHeight: 88,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    padding: 12,
    textAlignVertical: 'top',
  },
});
