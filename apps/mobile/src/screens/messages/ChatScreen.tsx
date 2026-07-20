import React, { useEffect, useMemo, useState } from 'react';
import { Alert, FlatList, KeyboardAvoidingView, Platform, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Header } from '@/components/common/Header';
import { Screen } from '@/components/common/Screen';
import { ChatInput } from '@/components/chat/ChatInput';
import { MessageBubble } from '@/components/chat/MessageBubble';
import { TypingIndicator } from '@/components/chat/TypingIndicator';
import { ErrorView } from '@/components/ui/ErrorView';
import { SkeletonRow } from '@/components/ui/Skeleton';
import { chatApi, getErrorMessage } from '@/api';
import { useAuth } from '@/hooks/useAuth';
import { useMessages } from '@/hooks/useMessages';
import { emitTyping, getSocket } from '@/services/socket';
import { SocketEvents } from '@/types';
import type { AppStackScreenProps } from '@/navigation/types';

type Props = AppStackScreenProps<'Chat'>;

export function ChatScreen({ navigation, route }: Props) {
  const { conversationId, title } = route.params;
  const { user } = useAuth();
  const { data, isLoading, isError, refetch, send, markRead, fetchNextPage, hasNextPage } =
    useMessages(conversationId);
  const [peerTyping, setPeerTyping] = useState(false);

  const messages = useMemo(() => {
    const items = data?.pages.flatMap((p) => p.items) ?? [];
    return [...items].reverse();
  }, [data]);

  useEffect(() => {
    markRead.mutate();
  }, [conversationId]);

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;
    const onTyping = (payload: { conversationId: string; userId: string }) => {
      if (payload.conversationId === conversationId && payload.userId !== user?.id) {
        setPeerTyping(true);
        setTimeout(() => setPeerTyping(false), 2000);
      }
    };
    socket.on(SocketEvents.TypingStart, onTyping);
    return () => {
      socket.off(SocketEvents.TypingStart, onTyping);
    };
  }, [conversationId, user?.id]);

  const onSend = async (text: string) => {
    emitTyping(conversationId, false);
    try {
      await send.mutateAsync({ text, type: 'text' });
    } catch (err) {
      Alert.alert('Send failed', getErrorMessage(err));
    }
  };

  const onAttach = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
    });
    if (res.canceled || !res.assets[0]) return;
    try {
      await send.mutateAsync({
        fileUri: res.assets[0].uri,
        mimeType: res.assets[0].mimeType ?? 'image/jpeg',
        fileName: res.assets[0].fileName ?? 'image.jpg',
        type: 'image',
      });
    } catch (err) {
      Alert.alert('Upload failed', getErrorMessage(err));
    }
  };

  return (
    <Screen padded={false} edges={['top', 'left', 'right']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={8}
      >
        <View style={{ paddingHorizontal: 16 }}>
          <Header title={title ?? 'Chat'} onBack={() => navigation.goBack()} />
        </View>
        {isLoading ? (
          <View style={{ padding: 16 }}>
            <SkeletonRow />
            <SkeletonRow />
          </View>
        ) : isError ? (
          <ErrorView message="Could not load messages" onRetry={() => refetch()} />
        ) : (
          <FlatList
            data={messages}
            inverted
            keyExtractor={(m) => m.id}
            contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 8 }}
            onEndReached={() => {
              if (hasNextPage) fetchNextPage();
            }}
            ListHeaderComponent={<TypingIndicator visible={peerTyping} />}
            renderItem={({ item }) => (
              <MessageBubble
                message={item}
                isMine={item.senderId === user?.id}
                onLongPress={() => {
                  Alert.alert('Delete message?', undefined, [
                    { text: 'Cancel', style: 'cancel' },
                    {
                      text: 'Delete',
                      style: 'destructive',
                      onPress: async () => {
                        try {
                          await chatApi.deleteMessage(item.id);
                          refetch();
                        } catch (err) {
                          Alert.alert('Error', getErrorMessage(err));
                        }
                      },
                    },
                  ]);
                }}
              />
            )}
          />
        )}
        <ChatInput onSend={onSend} onAttach={onAttach} disabled={send.isPending} />
      </KeyboardAvoidingView>
    </Screen>
  );
}
