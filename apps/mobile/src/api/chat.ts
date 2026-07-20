import { api, apiDelete, apiGet, apiPatch, apiPost } from './client';
import type { ChatMessage, Conversation, Paginated } from '@/types';

export const chatApi = {
  listConversations: (params?: { page?: number; limit?: number }) =>
    apiGet<Paginated<Conversation>>('/chat/conversations', { params }),
  conversations: (params?: { page?: number; limit?: number }) =>
    apiGet<Paginated<Conversation>>('/chat/conversations', { params }),
  openConversation: (userId: string) =>
    apiPost<Conversation>('/chat/conversations', { userId }),
  getMessages: (conversationId: string, params?: { page?: number; limit?: number }) =>
    apiGet<Paginated<ChatMessage>>(`/chat/conversations/${conversationId}/messages`, {
      params,
    }),
  messages: (conversationId: string, params?: { page?: number; limit?: number }) =>
    apiGet<Paginated<ChatMessage>>(`/chat/conversations/${conversationId}/messages`, {
      params,
    }),
  sendMessage: async (
    conversationId: string,
    payload: { text?: string; type?: string; fileUri?: string; mimeType?: string; fileName?: string },
  ) => {
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
      return res.data.data as ChatMessage;
    }
    return apiPost<ChatMessage>(`/chat/conversations/${conversationId}/messages`, {
      text: payload.text,
      type: payload.type ?? 'text',
    });
  },
  markRead: (conversationId: string) =>
    apiPatch<{ ok: boolean }>(`/chat/conversations/${conversationId}/read`),
  deleteMessage: (messageId: string) =>
    apiDelete<{ ok: boolean }>(`/chat/messages/${messageId}`),
  forwardMessage: (messageId: string, toUserId: string) =>
    apiPost<ChatMessage>(`/chat/messages/${messageId}/forward`, { toUserId }),
};
