import React from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorView } from '@/components/ui/ErrorView';
import { SkeletonRow } from '@/components/ui/Skeleton';
import { Text } from '@/components/ui/Text';
import { Screen } from '@/components/common/Screen';
import { ConversationRow } from '@/components/chat/ConversationRow';
import { useAuth } from '@/hooks/useAuth';
import { useConversations } from '@/hooks/useConversations';
import { useThemeColors } from '@/hooks/useThemeColors';
import { spacing } from '@/theme';
import type { AppStackParamList } from '@/navigation/types';

export function ConversationsScreen() {
  const c = useThemeColors();
  const nav = useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const { user } = useAuth();
  const { data, isLoading, isError, refetch, isRefetching } = useConversations();
  const items = data?.items ?? [];

  return (
    <Screen padded={false}>
      <LinearGradient colors={[...c.gradientNight]} style={StyleSheet.absoluteFill} />
      <View style={styles.header}>
        <Text variant="display">Chat</Text>
        <Text variant="caption" muted style={{ marginTop: 4 }}>
          Your conversations in one place.
        </Text>
      </View>
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: spacing.screen, paddingBottom: 110 }}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => refetch()} />}
      >
        {isLoading ? (
          <>
            <SkeletonRow />
            <SkeletonRow />
            <SkeletonRow />
          </>
        ) : isError ? (
          <ErrorView message="Could not load conversations" onRetry={() => refetch()} />
        ) : items.length === 0 ? (
          <EmptyState
            title="No conversations"
            description="Match with someone or open a profile to start chatting."
            actionLabel="Find people"
            onAction={() => nav.navigate('MainTabs', { screen: 'Discover' })}
          />
        ) : (
          items.map((conv) => (
            <ConversationRow
              key={conv.id}
              conversation={conv}
              meId={user?.id}
              onPress={() =>
                nav.navigate('Chat', {
                  conversationId: conv.id,
                  title: conv.participants?.find((p) => p.id !== user?.id)?.displayName,
                  peerId: conv.participants?.find((p) => p.id !== user?.id)?.id,
                })
              }
            />
          ))
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: spacing.screen,
    paddingTop: spacing.sm,
    paddingBottom: spacing.lg,
  },
});
