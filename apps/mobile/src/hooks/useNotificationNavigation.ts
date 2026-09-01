import { useEffect } from 'react';
import * as Linking from 'expo-linking';
import * as Notifications from 'expo-notifications';
import { navigationRef } from '@/navigation/navigationRef';
import { addNotificationResponseListener } from '@/services/notifications';
import { setPendingCallLink } from '@/services/pendingCallLink';
import { callsApi } from '@/api/calls';
import { useCallStore } from '@/store/call';

function whenReady(fn: () => void) {
  if (navigationRef.isReady()) {
    fn();
    return;
  }
  const t = setInterval(() => {
    if (navigationRef.isReady()) {
      clearInterval(t);
      fn();
    }
  }, 80);
  setTimeout(() => clearInterval(t), 8000);
}

function openChat(conversationId: string, title?: string) {
  whenReady(() => {
    navigationRef.navigate('App', {
      screen: 'Chat',
      params: { conversationId, title },
    });
  });
}

function openProfile(userId: string) {
  whenReady(() => {
    navigationRef.navigate('App', {
      screen: 'PublicProfile',
      params: { userId },
    });
  });
}

function openLikes() {
  whenReady(() => {
    navigationRef.navigate('App', {
      screen: 'MainTabs',
      params: { screen: 'Matches' },
    });
  });
}

function openCallHistory() {
  whenReady(() => {
    navigationRef.navigate('App', {
      screen: 'CallHistory',
    });
  });
}

export function parseKushlovUrl(url: string | null | undefined): void {
  if (!url) return;
  try {
    const parsed = Linking.parse(url);
    const path = (parsed.path ?? '').replace(/^\//, '');
    const query = parsed.queryParams ?? {};
    if (path.startsWith('chat/')) {
      openChat(path.slice('chat/'.length).split('/')[0] ?? '', String(query.title ?? ''));
      return;
    }
    if (path.startsWith('profile/')) {
      openProfile(path.slice('profile/'.length).split('/')[0] ?? '');
      return;
    }
    if (path.startsWith('u/')) {
      openProfile(path.slice('u/'.length).split('/')[0] ?? '');
      return;
    }
    if (path === 'likes' || path === 'matches') {
      openLikes();
      return;
    }
    if (path.startsWith('call/')) {
      const callId = path.slice('call/'.length).split('/')[0]?.split('?')[0] ?? '';
      const type = String(query.type ?? 'audio');
      if (callId) setPendingCallLink({ callId, callType: type });
    }
  } catch {
    // ignore malformed urls
  }
}

async function applyCallDeepLink(callId: string) {
  try {
    const { items } = await callsApi.incoming();
    const match = items.find((i) => i.id === callId) ?? items[0];
    if (match) useCallStore.getState().setIncoming(match);
  } catch {
    openCallHistory();
  }
}

type PushData = {
  kind?: string;
  type?: string;
  conversationId?: string;
  senderId?: string;
  callerId?: string;
  callerName?: string;
  senderName?: string;
  callId?: string;
  deepLink?: string;
};

function handlePushData(data: PushData | undefined) {
  if (!data) return;
  if (data.deepLink) {
    parseKushlovUrl(String(data.deepLink));
    return;
  }
  const kind = String(data.kind ?? '');
  const type = String(data.type ?? '');

  if (kind === 'message' || type === 'MESSAGE') {
    if (data.conversationId) openChat(String(data.conversationId), data.callerName || data.senderName);
    return;
  }
  if (kind === 'like' || type === 'LIKE' || type === 'MATCH') {
    openLikes();
    return;
  }
  if (kind === 'missed_call' || type === 'MISSED_AUDIO_CALL' || type === 'MISSED_VIDEO_CALL') {
    const userId = data.callerId || data.senderId;
    if (userId) openProfile(String(userId));
    else openCallHistory();
    return;
  }
  if (kind === 'incoming_call' || type === 'AUDIO_CALL' || type === 'VIDEO_CALL') {
    if (data.callId) void applyCallDeepLink(String(data.callId));
  }
}

/** Open the right screen when a notification is tapped (including cold start). */
export function useNotificationNavigation() {
  useEffect(() => {
    const go = (response: Notifications.NotificationResponse | null) => {
      if (!response) return;
      const action = response.actionIdentifier;
      const data = response.notification.request.content.data as PushData | undefined;
      if (
        (data?.kind === 'incoming_call' || data?.type === 'AUDIO_CALL' || data?.type === 'VIDEO_CALL') &&
        action &&
        action !== Notifications.DEFAULT_ACTION_IDENTIFIER
      ) {
        return;
      }
      handlePushData(data);
    };

    void Notifications.getLastNotificationResponseAsync().then(go);
    const sub = addNotificationResponseListener(go);

    void Linking.getInitialURL().then((url) => parseKushlovUrl(url));
    const linkSub = Linking.addEventListener('url', ({ url }) => parseKushlovUrl(url));

    return () => {
      sub.remove();
      linkSub.remove();
    };
  }, []);
}
