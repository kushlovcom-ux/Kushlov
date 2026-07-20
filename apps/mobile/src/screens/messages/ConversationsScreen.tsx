import React from 'react';
import { RefreshControl, ScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorView } from '@/components/ui/ErrorView';
import { SkeletonRow } from '@/components/ui/Skeleton';
import { Header } from '@/components/common/Header';
import { Screen } from '@/components/common/Screen';
import { ConversationRow } from '@/components/chat/ConversationRow';
import { useAuth } from '@/hooks/useAuth';
import { useConversations } from '@/hooks/useConversations';
import type { AppStackParamList } from '@/navigation/types';

export function ConversationsScreen() {
  const nav = useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const { user } = useAuth();
  const { data, isLoading, isError, refetch, isRefetching } = useConversations();
  const items = data?.items ?? [];

  return (
    <Screen>
      <Header title="Messages" />
      <ScrollView
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
          items.map((c) => (
            <ConversationRow
              key={c.id}
              conversation={c}
              meId={user?.id}
              onPress={() =>
                nav.navigate('Chat', {
                  conversationId: c.id,
                  title: c.participants?.find((p) => p.id !== user?.id)?.displayName,
                  peerId: c.participants?.find((p) => p.id !== user?.id)?.id,
                })
              }
            />
          ))
        )}
      </ScrollView>
    </Screen>
  );
}
