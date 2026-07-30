import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { FlashList } from '@shopify/flash-list';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '@/components/ui/Button';
import { Text } from '@/components/ui/Text';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorView } from '@/components/ui/ErrorView';
import { SkeletonRow } from '@/components/ui/Skeleton';
import { Screen } from '@/components/common/Screen';
import { SearchBar } from '@/components/common/SearchBar';
import { UserCard } from '@/components/common/UserCard';
import { Chip } from '@/design-system';
import { socialApi } from '@/api/social';
import { chatApi } from '@/api/chat';
import { usersApi } from '@/api/users';
import { getErrorMessage } from '@/api/client';
import { queryKeys } from '@/constants/queryKeys';
import { useDebounce } from '@/hooks/useDebounce';
import { useDiscover } from '@/hooks/useDiscover';
import { useThemeColors } from '@/hooks/useThemeColors';
import { spacing } from '@/theme';
import type { AppStackParamList } from '@/navigation/types';

export function DiscoverScreen() {
  const c = useThemeColors();
  const { width } = useWindowDimensions();
  const nav = useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const qc = useQueryClient();
  const [q, setQ] = useState('');
  const debounced = useDebounce(q, 350);
  const gap = spacing.md;
  const cardWidth = (width - spacing.screen * 2 - gap) / 2;

  const location = useQuery({
    queryKey: queryKeys.location,
    queryFn: () => usersApi.getLocation(),
  });

  const hasLocation = Boolean(location.data?.hasLocation);

  const params = useMemo(
    () => ({
      q: debounced || undefined,
      limit: 20,
    }),
    [debounced],
  );

  const discover = useDiscover(params, { enabled: hasLocation });
  const items = discover.data?.pages.flatMap((p) => p.items) ?? [];

  const like = useMutation({
    mutationFn: (userId: string) => socialApi.like(userId),
    onSuccess: (res) => {
      Alert.alert(res.matched ? "It's a match!" : 'Liked', res.matched ? 'You can start chatting.' : undefined);
      qc.invalidateQueries({ queryKey: ['discover'] });
    },
    onError: (e) => Alert.alert('Could not like', getErrorMessage(e)),
  });

  const openChat = async (userId: string, title?: string) => {
    try {
      const conv = await chatApi.openConversation(userId);
      nav.navigate('Chat', { conversationId: conv.id, title });
    } catch (e) {
      Alert.alert('Chat', getErrorMessage(e));
    }
  };

  if (location.isLoading) {
    return (
      <Screen padded={false}>
        <LinearGradient colors={[...c.gradientNight]} style={StyleSheet.absoluteFill} />
        <View style={styles.pad}>
          <Text variant="display">Discover</Text>
          <SkeletonRow />
          <SkeletonRow />
        </View>
      </Screen>
    );
  }

  return (
    <Screen padded={false}>
      <LinearGradient colors={[...c.gradientNight]} style={StyleSheet.absoluteFill} />
      <View style={styles.pad}>
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text variant="display">Discover</Text>
            <Text variant="caption" muted style={{ marginTop: 4 }}>
              People outside your local zone — search finds locals too.
            </Text>
          </View>
          <Button
            title="Group"
            size="sm"
            variant="secondary"
            onPress={() => nav.navigate('GroupCall')}
          />
        </View>

        <Pressable
          onPress={() => nav.navigate('LocationSetup')}
          style={[
            styles.locationChip,
            {
              backgroundColor: hasLocation ? c.elevated : c.primaryMuted,
              borderColor: hasLocation ? c.border : c.pink,
            },
          ]}
        >
          <Ionicons name="location" size={16} color={c.pink} />
          <View style={{ flex: 1 }}>
            <Text variant="captionBold">
              {hasLocation ? 'Your location' : 'Set your location'}
            </Text>
            <Text variant="tiny" muted numberOfLines={1}>
              {hasLocation
                ? location.data?.locationLabel ||
                  location.data?.city ||
                  'Tap to update · browse hides people within 10 km'
                : 'Required to discover people. Search by name works worldwide.'}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={c.textMuted} />
        </Pressable>

        {!hasLocation ? (
          <EmptyState
            title="Share your location"
            description="Set your location to browse people outside your local 10 km zone. Searching by name finds anyone."
            actionLabel="Set location"
            onAction={() => nav.navigate('LocationSetup')}
          />
        ) : (
          <>
            <SearchBar
              value={q}
              onChangeText={setQ}
              placeholder="Search locals within 10 km…"
            />
            <View style={styles.filters}>
              <Chip label="Nearby" selected={!debounced} onPress={() => setQ('')} />
              <Chip label={debounced ? 'Searching' : 'Browse'} selected={Boolean(debounced)} tone="info" />
            </View>
            {discover.isLoading ? (
              <>
                <SkeletonRow />
                <SkeletonRow />
              </>
            ) : discover.isError ? (
              <ErrorView message="Could not load people" onRetry={() => discover.refetch()} />
            ) : (
              <FlashList
                data={items}
                numColumns={2}
                keyExtractor={(item) => item.id}
                contentContainerStyle={{ paddingBottom: 110 }}
                ListEmptyComponent={
                  <EmptyState
                    title={debounced ? 'No matches' : 'No one online nearby'}
                    description={
                      debounced
                        ? 'No one within 10 km matches that name.'
                        : 'People within 10 km are hidden on browse — search by name to find and message them.'
                    }
                  />
                }
                renderItem={({ item, index }) => (
                  <View
                    style={{
                      width: cardWidth,
                      marginRight: index % 2 === 0 ? gap : 0,
                      marginBottom: gap,
                    }}
                  >
                    <UserCard
                      user={item}
                      variant="portrait"
                      onPress={() => nav.navigate('PublicProfile', { userId: item.id })}
                      onLike={() => like.mutate(item.id)}
                      onMessage={() => void openChat(item.id, item.displayName)}
                    />
                  </View>
                )}
                onEndReached={() => {
                  if (discover.hasNextPage && !discover.isFetchingNextPage) {
                    discover.fetchNextPage();
                  }
                }}
                ListFooterComponent={
                  discover.isFetchingNextPage ? (
                    <ActivityIndicator style={{ marginVertical: 16 }} color={c.pink} />
                  ) : null
                }
              />
            )}
          </>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  pad: { flex: 1, paddingHorizontal: spacing.screen, paddingTop: spacing.sm },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  locationChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: spacing.md,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: spacing.md,
  },
  filters: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: spacing.md,
    marginTop: spacing.sm,
  },
});
