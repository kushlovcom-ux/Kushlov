import { api, apiDelete, apiGet, apiPatch, apiPost } from './client';
import type { ChatMessage, Conversation, Paginated } from '@/types';
import { normalizeChatMessage, normalizeConversation } from '@/utils/normalizeChat';

async function listConversations(params?: { page?: number; limit?: number }) {
  const res = await apiGet<Paginated<unknown>>('/chat/conversations', { params });
  return {
    ...res,
    items: (res.items ?? []).map(normalizeConversation).filter((c) => Boolean(c.id)),
  } as Paginated<Conversation>;
}

async function getMessages(conversationId: string, params?: { page?: number; limit?: number }) {
  const res = await apiGet<Paginated<unknown>>(
    `/chat/conversations/${conversationId}/messages`,
    { params },
  );
  return {
    ...res,
    items: (res.items ?? []).map(normalizeChatMessage).filter((m) => Boolean(m.id)),
  } as Paginated<ChatMessage>;
}

export const chatApi = {
  listConversations,
  conversations: listConversations,
  openConversation: async (userId: string) =>
    normalizeConversation(await apiPost<unknown>('/chat/conversations', { userId })),
  getMessages,
  messages: getMessages,
  sendMessage: async (
    conversationId: string,
    payload: { text?: string; type?: string; fileUri?: string; mimeType?: string; fileName?: string },
  ) => {
    if (!conversationId) {
      throw new Error('Missing conversation id');
    }
    if (payload.fileUri) {
      const form = new FormData();
      if (payload.text) form.append('text', payload.text);
      if (payload.type) form.append('type', payload.type);
      form.append('file', {
        uri: payload.fileUri,
        type: payload.mimeType ?? 'image/jpeg',
        name: payload.fileName ?? 'upload.jpg',
      } as unknown as Blob);
      const res = await api.post(`/chat/conversations/${conversationId}/messages`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return normalizeChatMessage(res.data.data);
    }
    return normalizeChatMessage(
      await apiPost<unknown>(`/chat/conversations/${conversationId}/messages`, {
        text: payload.text,
        type: payload.type ?? 'text',
      }),
    );
  },
  markRead: (conversationId: string) =>
    apiPatch<{ ok: boolean }>(`/chat/conversations/${conversationId}/read`),
  deleteMessage: (messageId: string) =>
    apiDelete<{ ok: boolean }>(`/chat/messages/${messageId}`),
  forwardMessage: async (messageId: string, toUserId: string) =>
    normalizeChatMessage(
      await apiPost<unknown>(`/chat/messages/${messageId}/forward`, { toUserId }),
    ),
};
