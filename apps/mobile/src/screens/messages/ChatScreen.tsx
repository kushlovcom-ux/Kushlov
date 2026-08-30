import React, { useEffect, useMemo, useState } from 'react';
import { Alert, AppState, FlatList, Pressable, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { Ionicons } from '@expo/vector-icons';
import { Header } from '@/components/common/Header';
import { Screen } from '@/components/common/Screen';
import { ChatInput, type AttachKind, type VoiceNote } from '@/components/chat/ChatInput';
import { MessageBubble } from '@/components/chat/MessageBubble';
import { TypingIndicator } from '@/components/chat/TypingIndicator';
import { ErrorView } from '@/components/ui/ErrorView';
import { SkeletonRow } from '@/components/ui/Skeleton';
import { Text } from '@/components/ui/Text';
import { callsApi, chatApi, getErrorMessage } from '@/api';
import { useAuth } from '@/hooks/useAuth';
import { useKeyboard } from '@/hooks/useKeyboard';
import { useMessages } from '@/hooks/useMessages';
import { useCallStore } from '@/store/call';
import { useThemeColors } from '@/hooks/useThemeColors';
import { emitTyping, emitChatFocus, getSocket } from '@/services/socket';
import { setActiveConversationId } from '@/services/chatFocus';
import { CallType, SocketEvents } from '@/types';
import type { AppStackScreenProps } from '@/navigation/types';

type Props = AppStackScreenProps<'Chat'>;

const DOCUMENT_MIME: Record<string, string> = {
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ppt: 'application/vnd.ms-powerpoint',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  rtf: 'application/rtf',
  zip: 'application/zip',
  txt: 'text/plain',
  csv: 'text/csv',
};

const DOCUMENT_TYPES = Object.values(DOCUMENT_MIME);

/** Android often hands back no MIME type for files picked from cloud providers. */
function mimeFromName(name?: string) {
  const ext = name?.split('.').pop()?.toLowerCase();
  return (ext && DOCUMENT_MIME[ext]) || 'application/pdf';
}

export function ChatScreen({ navigation, route }: Props) {
  const { conversationId, title, peerId } = route.params;
  const c = useThemeColors();
  const keyboard = useKeyboard();
  const { user } = useAuth();
  const startCall = useCallStore((s) => s.startCall);
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
    setActiveConversationId(conversationId);
    emitChatFocus(conversationId);
    const socket = getSocket();
    const onConnect = () => emitChatFocus(conversationId);
    socket?.on('connect', onConnect);
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        setActiveConversationId(conversationId);
        emitChatFocus(conversationId);
      } else {
        setActiveConversationId(null);
        emitChatFocus(null);
      }
    });
    return () => {
      sub.remove();
      socket?.off('connect', onConnect);
      setActiveConversationId(null);
      emitChatFocus(null);
    };
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

  const upload = async (payload: {
    fileUri: string;
    mimeType: string;
    fileName: string;
    type: string;
  }) => {
    try {
      await send.mutateAsync(payload);
    } catch (err) {
      Alert.alert('Upload failed', getErrorMessage(err));
    }
  };

  const pickMedia = async (kind: 'photo' | 'video') => {
    const photo = kind === 'photo';
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: photo ? ['images'] : ['videos'],
      quality: 0.8,
      // The API caps uploads at 40 MB; a minute of phone video is already close.
      videoMaxDuration: 60,
    });
    const asset = res.canceled ? undefined : res.assets[0];
    if (!asset) return;
    await upload({
      fileUri: asset.uri,
      mimeType: asset.mimeType ?? (photo ? 'image/jpeg' : 'video/mp4'),
      fileName: asset.fileName ?? (photo ? 'photo.jpg' : 'video.mp4'),
      type: photo ? 'image' : 'video',
    });
  };

  const pickDocument = async () => {
    const res = await DocumentPicker.getDocumentAsync({
      // Mirrors the API allowlist so the picker cannot offer a file the upload
      // would reject.
      type: DOCUMENT_TYPES,
      copyToCacheDirectory: true,
    });
    const asset = res.canceled ? undefined : res.assets?.[0];
    if (!asset) return;
    await upload({
      fileUri: asset.uri,
      mimeType: asset.mimeType || mimeFromName(asset.name),
      fileName: asset.name || 'document',
      type: 'file',
    });
  };

  const onAttach = (kind: AttachKind) => {
    if (kind === 'document') void pickDocument();
    else void pickMedia(kind);
  };

  const onVoice = (note: VoiceNote) =>
    upload({
      fileUri: note.uri,
      mimeType: note.mimeType,
      fileName: note.fileName,
      type: 'voice',
    });

  const call = async (type: CallType) => {
    if (!peerId) {
      Alert.alert('Call', 'Unable to start a call from this chat.');
      return;
    }
    try {
      if (type === CallType.Video) {
        const cam = await ImagePicker.requestCameraPermissionsAsync();
        if (!cam.granted) {
          Alert.alert('Camera needed', 'Allow camera access to start a video call.');
          return;
        }
      }
      const session = await callsApi.initiate({ type, calleeId: peerId });
      startCall(session, 'caller');
    } catch (err) {
      Alert.alert('Call failed', getErrorMessage(err));
    }
  };

  return (
    <Screen padded={false} edges={['top', 'left', 'right']}>
      {/* Android has been edge-to-edge since API 35, so `adjustResize` no longer
          shrinks the window and KeyboardAvoidingView's Android branch was a
          plain View — the composer stayed buried under the keyboard. This screen
          reaches the bottom of the display, so the overlap is exactly the
          keyboard height. */}
      <View style={{ flex: 1, paddingBottom: keyboard.height }}>
        <View style={{ paddingHorizontal: 16 }}>
          <Header
            title={title ?? 'Chat'}
            showBack
            right={
              peerId ? (
                <View style={{ flexDirection: 'row', gap: 4 }}>
                  <Pressable
                    onPress={() => void call(CallType.Audio)}
                    hitSlop={10}
                    accessibilityLabel="Audio call"
                    style={{ padding: 8 }}
                  >
                    <Ionicons name="call-outline" size={22} color={c.text} />
                  </Pressable>
                  <Pressable
                    onPress={() => void call(CallType.Video)}
                    hitSlop={10}
                    accessibilityLabel="Video call"
                    style={{ padding: 8 }}
                  >
                    <Ionicons name="videocam-outline" size={22} color={c.primary} />
                  </Pressable>
                </View>
              ) : null
            }
          />
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
            style={{ flex: 1 }}
            data={messages}
            inverted
            keyExtractor={(m) => m.id}
            contentContainerStyle={{
              flexGrow: 1,
              justifyContent: 'flex-end',
              paddingHorizontal: 16,
              paddingBottom: 8,
            }}
            onEndReached={() => {
              if (hasNextPage) fetchNextPage();
            }}
            ListEmptyComponent={
              <View style={{ paddingVertical: 40, transform: [{ scaleY: -1 }] }}>
                <Text muted center>
                  No messages yet. Say hello!
                </Text>
              </View>
            }
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
        <ChatInput
          onSend={onSend}
          onAttach={onAttach}
          onVoice={onVoice}
          disabled={send.isPending}
        />
      </View>
    </Screen>
  );
}
