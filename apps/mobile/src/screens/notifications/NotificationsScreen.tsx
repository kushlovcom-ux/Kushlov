import React from 'react';
import { Alert, Pressable, RefreshControl, ScrollView } from 'react-native';
import { Text } from '@/components/ui/Text';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorView } from '@/components/ui/ErrorView';
import { SkeletonRow } from '@/components/ui/Skeleton';
import { Header } from '@/components/common/Header';
import { Screen } from '@/components/common/Screen';
import { callsApi } from '@/api/calls';
import { getErrorMessage } from '@/api/client';
import { useNotifications } from '@/hooks/useNotifications';
import { useCallStore } from '@/store/call';
import { NotificationType } from '@/types';
import { formatRelative } from '@/utils/format';
import { spacing } from '@/theme';
import type { AppStackScreenProps } from '@/navigation/types';

type Props = AppStackScreenProps<'Notifications'>;

export function NotificationsScreen({ navigation }: Props) {
  const { list, markRead, markAllRead } = useNotifications();
  const setIncoming = useCallStore((s) => s.setIncoming);
  const items = list.data?.items ?? [];

  const onPress = async (n: (typeof items)[number]) => {
    markRead.mutate(n.id);
    const data = n.data as {
      kind?: string;
      callId?: string;
      callType?: string;
      conversationId?: string;
    } | undefined;
    const isCall =
      n.type === NotificationType.Call ||
      data?.kind === 'incoming_call' ||
      /call/i.test(n.title ?? '');

    if (data?.kind === 'message' && data.conversationId) {
      navigation.navigate('Chat', { conversationId: String(data.conversationId) });
      return;
    }

    if (!isCall) return;

    try {
      const { items: incoming } = await callsApi.incoming();
      const match =
        (data?.callId ? incoming.find((i) => i.id === data.callId) : undefined) ?? incoming[0];
      if (match) {
        setIncoming(match);
        navigation.goBack();
        return;
      }
      Alert.alert('Call ended', 'This call is no longer ringing.');
    } catch (err) {
      Alert.alert('Call', getErrorMessage(err));
    }
  };

  return (
    <Screen>
      <Header
        title="Notifications"
        onBack={() => navigation.goBack()}
        right={
          <Button title="Read all" size="sm" variant="ghost" onPress={() => markAllRead.mutate()} />
        }
      />
      <ScrollView
        refreshControl={
          <RefreshControl refreshing={list.isRefetching} onRefresh={() => list.refetch()} />
        }
      >
        {list.isLoading ? (
          <SkeletonRow />
        ) : list.isError ? (
          <ErrorView message="Could not load notifications" onRetry={() => list.refetch()} />
        ) : items.length === 0 ? (
          <EmptyState title="You're all caught up" />
        ) : (
          items.map((n) => (
            <Pressable
              key={n.id}
              onPress={() => void onPress(n)}
              style={{ marginBottom: spacing.lg, opacity: n.isRead || n.readAt ? 0.6 : 1 }}
            >
              <Text variant="bodyBold">{n.title}</Text>
              <Text muted>{n.body}</Text>
              {(n.type === NotificationType.Call ||
                (n.data as { kind?: string } | undefined)?.kind === 'incoming_call') && (
                <Text variant="caption" color="#22c55e" style={{ marginTop: 6 }}>
                  Tap to Accept or Decline
                </Text>
              )}
              <Text variant="tiny" muted style={{ marginTop: 4 }}>
                {formatRelative(n.createdAt)}
              </Text>
            </Pressable>
          ))
        )}
      </ScrollView>
    </Screen>
  );
}
