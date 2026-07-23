import React, { useEffect, useState } from 'react';
import {
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';
import { Button } from '@/components/ui/Button';
import { Text } from '@/components/ui/Text';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorView } from '@/components/ui/ErrorView';
import { Skeleton } from '@/components/ui/Skeleton';
import { Avatar } from '@/components/ui/Avatar';
import { Header } from '@/components/common/Header';
import { Screen } from '@/components/common/Screen';
import { StarRating } from '@/components/common/StarRating';
import { VerifiedBadge } from '@/components/common/VerifiedBadge';
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
import { spacing } from '@/theme';
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
      navigation.navigate('Chat', {
        conversationId: conv.id,
        title: userQ.data?.displayName,
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
      startCall(session, 'caller', userQ.data ?? undefined);
    } catch (err) {
      Alert.alert('Call failed', getErrorMessage(err));
    }
  };

  if (userQ.isLoading) {
    return (
      <Screen>
        <Header title="Profile" onBack={() => navigation.goBack()} />
        <Skeleton height={180} />
      </Screen>
    );
  }

  if (userQ.isError || !userQ.data) {
    return (
      <Screen>
        <Header title="Profile" onBack={() => navigation.goBack()} />
        <ErrorView message={getErrorMessage(userQ.error)} onRetry={() => userQ.refetch()} />
      </Screen>
    );
  }

  const u = userQ.data;
  const age = ageFromDob(u.dob);
  const gallery = u.gallery ?? [];
  const isHostProfile = u.role === Role.Host && !!u.isHostApproved;
  const canReview = me?.role === Role.User && isHostProfile && me.id !== userId;
  const avatarUri = u.avatarUrl || gallery[0]?.url;

  return (
    <Screen padded={false}>
      <ScrollView contentContainerStyle={styles.pad}>
        <Header title={u.displayName} onBack={() => navigation.goBack()} />
        {u.coverUrl ? (
          <Image source={{ uri: u.coverUrl }} style={styles.cover} />
        ) : (
          <View style={[styles.cover, { backgroundColor: c.elevated }]} />
        )}
        <View style={styles.avatarWrap}>
          <Avatar uri={avatarUri} name={u.displayName} size={96} />
        </View>
        <View style={styles.nameRow}>
          <Text variant="h2">
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
        {u.bio ? <Text style={{ marginTop: spacing.md }}>{u.bio}</Text> : null}

        <View style={styles.actions}>
          <Button
            title="Like"
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
            style={{ flex: 1 }}
          />
          <Button title="Message" variant="secondary" onPress={message} style={{ flex: 1 }} />
        </View>
        <View style={styles.actions}>
          <Button title="Audio" variant="outline" onPress={() => call(CallType.Audio)} style={{ flex: 1 }} />
          <Button title="Video" variant="outline" onPress={() => call(CallType.Video)} style={{ flex: 1 }} />
        </View>

        <Text variant="h3" style={{ marginTop: spacing.xl, marginBottom: spacing.md }}>
          Gallery
        </Text>
        {gallery.length === 0 ? (
          <EmptyState title="No photos yet" />
        ) : (
          <View style={styles.gallery}>
            {gallery.map((g) => (
              <Image key={g.publicId || g.url} source={{ uri: g.url }} style={styles.gImg} />
            ))}
          </View>
        )}

        <Text variant="h3" style={{ marginTop: spacing.xl, marginBottom: spacing.md }}>
          Reviews
        </Text>

        {canReview ? (
          <View style={[styles.reviewBox, { backgroundColor: c.card, borderColor: c.border }]}>
            <Text variant="bodyBold" style={{ marginBottom: spacing.sm }}>
              {myReview.data ? 'Update your review' : 'Leave a review'}
            </Text>
            <View style={styles.starsRow}>
              {[1, 2, 3, 4, 5].map((n) => (
                <Pressable key={n} onPress={() => setRating(n)} hitSlop={6}>
                  <Text style={{ fontSize: 28, color: n <= rating ? c.orange : c.borderStrong }}>
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
              onPress={() => saveReview.mutate()}
              loading={saveReview.isPending}
              fullWidth
              style={{ marginTop: spacing.md }}
            />
          </View>
        ) : null}

        {(reviewsQ.data?.items ?? []).length === 0 ? (
          <EmptyState title="No reviews yet" />
        ) : (
          (reviewsQ.data?.items ?? []).map((r) => (
            <View key={r.id} style={styles.review}>
              <Text variant="bodyBold">{r.reviewer.displayName}</Text>
              <StarRating rating={r.rating} />
              {r.text ? (
                <Text muted style={{ marginTop: 4 }}>
                  {r.text}
                </Text>
              ) : null}
            </View>
          ))
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  pad: { padding: spacing.lg, paddingBottom: 48 },
  cover: { height: 140, borderRadius: 16, width: '100%' },
  avatarWrap: { marginTop: -48, marginBottom: spacing.sm, alignSelf: 'flex-start' },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  actions: { flexDirection: 'row', gap: 10, marginTop: spacing.md },
  gallery: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  gImg: { width: '31%', aspectRatio: 1, borderRadius: 12 },
  review: { marginBottom: spacing.md },
  reviewBox: {
    borderWidth: 1,
    borderRadius: 16,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  starsRow: { flexDirection: 'row', gap: 6, marginBottom: spacing.sm },
  reviewInput: {
    minHeight: 88,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    textAlignVertical: 'top',
  },
});
