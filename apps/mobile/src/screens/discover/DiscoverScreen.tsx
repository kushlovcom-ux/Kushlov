import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { FlashList } from '@shopify/flash-list';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '@/components/ui/Button';
import { Text } from '@/components/ui/Text';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorView } from '@/components/ui/ErrorView';
import { SkeletonRow } from '@/components/ui/Skeleton';
import { Screen, useScreenRefresh } from '@/components/common/Screen';
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
import type { PublicUser } from '@/types';

export function DiscoverScreen() {
  const c = useThemeColors();
  const { width } = useWindowDimensions();
  const nav = useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const qc = useQueryClient();
  const [q, setQ] = useState('');
  const [focused, setFocused] = useState(true);
  const debounced = useDebounce(q, 350);
  const isSearching = debounced.trim().length >= 2;
  const gap = spacing.md;
  const cardWidth = (width - spacing.screen * 2 - gap) / 2;

  const location = useQuery({
    queryKey: queryKeys.location,
    queryFn: () => usersApi.getLocation(),
  });

  const hasLocation = Boolean(location.data?.hasLocation);

  const browse = useDiscover(
    { limit: 20 },
    {
      enabled: hasLocation && !isSearching,
      refetchInterval: focused && hasLocation && !isSearching ? 30_000 : false,
    },
  );

  const search = useQuery({
    queryKey: ['users', 'search-contacts', debounced.trim()],
    queryFn: () => usersApi.searchContacts(debounced.trim()),
    enabled: isSearching,
    staleTime: 10_000,
  });

  const items: PublicUser[] = useMemo(() => {
    if (isSearching) {
      return (search.data?.items ?? []).filter((u) => Boolean(u.id));
    }
    return (browse.data?.pages.flatMap((p) => p.items) ?? []).filter((u) => Boolean(u.id));
  }, [browse.data, isSearching, search.data]);

  const listLoading = isSearching ? search.isLoading : browse.isLoading;
  const listError = isSearching
    ? search.isError && items.length === 0
    : browse.isError && items.length === 0;
  const refetchList = () => (isSearching ? search.refetch() : browse.refetch());

  const onRefresh = useCallback(async () => {
    await Promise.all([
      location.refetch(),
      isSearching ? search.refetch() : browse.refetch(),
    ]);
  }, [location, isSearching, search, browse]);
  const { refreshControl } = useScreenRefresh(onRefresh);

  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      if (hasLocation && !isSearching) {
        void qc.invalidateQueries({ queryKey: ['users', 'discover'] });
      }
      return () => setFocused(false);
    }, [hasLocation, isSearching, qc]),
  );

  const like = useMutation({
    mutationFn: (userId: string) => socialApi.like(userId),
    onSuccess: (res) => {
      Alert.alert(res.matched ? "It's a match!" : 'Liked', res.matched ? 'You can start chatting.' : undefined);
      qc.invalidateQueries({ queryKey: ['discover'] });
      qc.invalidateQueries({ queryKey: ['users', 'search-contacts'] });
      if (res.matched) qc.invalidateQueries({ queryKey: queryKeys.matches });
    },
    onError: (e) => Alert.alert('Could not like', getErrorMessage(e)),
  });

  const openChat = async (userId: string, title?: string) => {
    try {
      const conv = await chatApi.openConversation(userId);
      if (!conv.id) {
        Alert.alert('Chat', 'Could not open conversation. Please try again.');
        return;
      }
      nav.navigate('Chat', { conversationId: conv.id, title, peerId: userId });
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
              Browse nearby online people, or search anyone by name.
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
                : 'Needed for browse. Search by name works without it.'}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={c.textMuted} />
        </Pressable>

        <SearchBar
          value={q}
          onChangeText={setQ}
          placeholder="Search users or hosts by name…"
        />
        <View style={styles.filters}>
          <Chip label="Nearby" selected={!isSearching} onPress={() => setQ('')} />
          <Chip
            label={isSearching ? 'Searching' : 'Browse'}
            selected={isSearching}
            tone="info"
          />
        </View>

        {!hasLocation && !isSearching ? (
          <EmptyState
            title="Share your location"
            description="Set your location to browse people outside your local 10 km zone — or search anyone by name above."
            actionLabel="Set location"
            onAction={() => nav.navigate('LocationSetup')}
          />
        ) : listLoading ? (
          <>
            <SkeletonRow />
            <SkeletonRow />
          </>
        ) : listError ? (
          <ErrorView message="Could not load people" onRetry={() => void refetchList()} />
        ) : (
          <FlashList
            data={items}
            numColumns={2}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ paddingBottom: 110 }}
            refreshControl={refreshControl}
            ListEmptyComponent={
              <EmptyState
                title={isSearching ? 'No matches' : 'No one online nearby'}
                description={
                  isSearching
                    ? debounced.trim().length < 2
                      ? 'Type at least 2 characters to search.'
                      : 'No users or hosts match that name.'
                    : 'People within 10 km are hidden on browse — search by name to find them.'
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
              if (!isSearching && browse.hasNextPage && !browse.isFetchingNextPage) {
                browse.fetchNextPage();
              }
            }}
            ListFooterComponent={
              !isSearching && browse.isFetchingNextPage ? (
                <ActivityIndicator style={{ marginVertical: 16 }} color={c.pink} />
              ) : null
            }
          />
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
