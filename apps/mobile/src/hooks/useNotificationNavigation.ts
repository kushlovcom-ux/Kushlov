import { useEffect } from 'react';
import * as Notifications from 'expo-notifications';
import { navigationRef } from '@/navigation/navigationRef';
import { addNotificationResponseListener } from '@/services/notifications';

function openChat(conversationId: string, title?: string) {
  if (!navigationRef.isReady()) return;
  navigationRef.navigate('App', {
    screen: 'Chat',
    params: { conversationId, title },
  });
}

/** Open chat when a message notification is tapped (including cold start). */
export function useNotificationNavigation() {
  useEffect(() => {
    const go = (response: Notifications.NotificationResponse | null) => {
      const data = response?.notification.request.content.data as {
        kind?: string;
        conversationId?: string;
        callerName?: string;
      };
      if (data?.kind !== 'message' || !data.conversationId) return;
      openChat(String(data.conversationId), data.callerName);
    };

    void Notifications.getLastNotificationResponseAsync().then(go);
    const sub = addNotificationResponseListener(go);
    return () => sub.remove();
  }, []);
}
