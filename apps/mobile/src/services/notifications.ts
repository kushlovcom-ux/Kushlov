import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { AppState, Platform } from 'react-native';
import { env } from '@/config/env';
import { getActiveConversationId } from './chatFocus';

export const CALL_NOTIFICATION_CATEGORY = 'incoming_call';
export const CALL_ACTION_ACCEPT = 'accept';
export const CALL_ACTION_DECLINE = 'decline';
/** New channel id — Android 8+ channel sound is immutable. Uses the OS default ringtone. */
export const CALLS_CHANNEL_ID = 'incoming_calls_sys';
export const MESSAGES_CHANNEL_ID = 'messages';
export const LIKES_CHANNEL_ID = 'likes';
export const DEFAULT_CHANNEL_ID = 'default';

const seenPushIds = new Set<string>();

function pushDedupeKey(data?: Record<string, unknown>): string | null {
  if (!data) return null;
  const id =
    data.notificationId ?? data.messageId ?? (data.kind === 'incoming_call' ? data.callId : null);
  return id ? String(id) : null;
}

function isCallCancelled(data?: Record<string, unknown>): boolean {
  const kind = String(data?.kind ?? '');
  const type = String(data?.type ?? '');
  return kind === 'call_cancelled' || type === 'CALL_CANCELLED';
}

function isIncomingCall(data?: Record<string, unknown>): boolean {
  const kind = String(data?.kind ?? '');
  const type = String(data?.type ?? '');
  return kind === 'incoming_call' || type === 'AUDIO_CALL' || type === 'VIDEO_CALL';
}

Notifications.setNotificationHandler({
  handleNotification: async (notification) => {
    const data = notification.request.content.data as Record<string, unknown> | undefined;
    const appActive = AppState.currentState === 'active';
    const key = pushDedupeKey(data);
    if (key) {
      if (seenPushIds.has(key)) {
        return {
          shouldShowAlert: false,
          shouldPlaySound: false,
          shouldSetBadge: false,
          shouldShowBanner: false,
          shouldShowList: false,
        };
      }
      seenPushIds.add(key);
      if (seenPushIds.size > 200) {
        const first = seenPushIds.values().next().value;
        if (first) seenPushIds.delete(first);
      }
    }

    if (isCallCancelled(data)) {
      const callId = data?.callId ? String(data.callId) : undefined;
      void dismissIncomingCallNotification(callId);
      return {
        shouldShowAlert: false,
        shouldPlaySound: false,
        shouldSetBadge: true,
        shouldShowBanner: false,
        shouldShowList: false,
      };
    }

    const inThisChat =
      String(data?.kind ?? '') === 'message' &&
      appActive &&
      Boolean(data?.conversationId) &&
      String(data?.conversationId) === getActiveConversationId();

    // App foreground: Socket.IO already delivers messages/likes/calls.
    if (appActive && (inThisChat || String(data?.kind ?? '') === 'message' || String(data?.kind ?? '') === 'like')) {
      return {
        shouldShowAlert: false,
        shouldPlaySound: false,
        shouldSetBadge: true,
        shouldShowBanner: false,
        shouldShowList: false,
      };
    }

    const callHandledInApp = isIncomingCall(data) && appActive;
    if (callHandledInApp) {
      return {
        shouldShowAlert: false,
        shouldPlaySound: false,
        shouldSetBadge: true,
        shouldShowBanner: false,
        shouldShowList: false,
      };
    }

    const isCall = isIncomingCall(data);
    return {
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
      shouldShowBanner: true,
      shouldShowList: true,
      priority: isCall
        ? Notifications.AndroidNotificationPriority.MAX
        : Notifications.AndroidNotificationPriority.HIGH,
    };
  },
});

let categoriesReady = false;

/** Android call/message channels + Accept/Decline actions. */
export async function setupCallNotifications(): Promise<void> {
  if (categoriesReady) return;
  try {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync(CALLS_CHANNEL_ID, {
        name: 'Incoming calls',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 400, 200, 400, 200, 400],
        lightColor: '#22c55e',
        sound: 'default',
        enableVibrate: true,
        lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
        bypassDnd: true,
        audioAttributes: {
          usage: Notifications.AndroidAudioUsage.NOTIFICATION_RINGTONE,
          contentType: Notifications.AndroidAudioContentType.SONIFICATION,
        },
      });
      await Notifications.setNotificationChannelAsync(MESSAGES_CHANNEL_ID, {
        name: 'Messages',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 180, 80, 180],
        lightColor: '#ec4899',
        sound: 'default',
        enableVibrate: true,
      });
      await Notifications.setNotificationChannelAsync(LIKES_CHANNEL_ID, {
        name: 'Likes & matches',
        importance: Notifications.AndroidImportance.DEFAULT,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#ec4899',
        sound: 'default',
      });
      await Notifications.setNotificationChannelAsync(DEFAULT_CHANNEL_ID, {
        name: 'Activity',
        importance: Notifications.AndroidImportance.DEFAULT,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#ec4899',
        sound: 'default',
      });
    }

    await Notifications.setNotificationCategoryAsync(CALL_NOTIFICATION_CATEGORY, [
      {
        identifier: CALL_ACTION_DECLINE,
        buttonTitle: 'Decline',
        options: { isDestructive: true, opensAppToForeground: false },
      },
      {
        identifier: CALL_ACTION_ACCEPT,
        buttonTitle: 'Accept',
        options: { opensAppToForeground: true },
      },
    ]);
    categoriesReady = true;
  } catch {
    // soft fail — overlay still works
  }
}

/**
 * Request notification permission once. After a user denial, do not prompt again;
 * they must enable notifications from system Settings.
 */
export async function ensureNotificationPermissions(): Promise<boolean> {
  if (!Device.isDevice) return false;
  const existing = await Notifications.getPermissionsAsync();
  if (existing.granted || existing.status === 'granted') return true;
  if (existing.status === 'denied' && existing.canAskAgain === false) return false;
  const { status } = await Notifications.requestPermissionsAsync({
    ios: {
      allowAlert: true,
      allowBadge: true,
      allowSound: true,
    },
  });
  return status === 'granted';
}

export async function getExpoPushToken(): Promise<string | null> {
  try {
    const granted = await ensureNotificationPermissions();
    if (!granted) return null;
    await setupCallNotifications();

    const projectId = env.easProjectId || undefined;
    const token = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined,
    );
    return token.data;
  } catch {
    return null;
  }
}

/** Alias: ensure permissions + fetch Expo push token */
export const registerForPushNotifications = getExpoPushToken;

export function addNotificationReceivedListener(
  listener: (n: Notifications.Notification) => void,
) {
  return Notifications.addNotificationReceivedListener(listener);
}

export function addNotificationResponseListener(
  listener: (r: Notifications.NotificationResponse) => void,
) {
  return Notifications.addNotificationResponseReceivedListener(listener);
}

export async function setAppBadgeCount(count: number): Promise<void> {
  try {
    await Notifications.setBadgeCountAsync(Math.max(0, Math.min(99, Math.floor(count))));
  } catch {
    // iOS simulator / web
  }
}

export type IncomingCallNotifyPayload = {
  callId: string;
  callType: string;
  callerName?: string;
  callerAvatar?: string;
  interrupt?: boolean;
};

/** Local ringing notification with Accept / Decline — used when the app is backgrounded. */
export async function presentIncomingCallNotification(
  payload: IncomingCallNotifyPayload,
): Promise<string | null> {
  try {
    await setupCallNotifications();
    const granted = await ensureNotificationPermissions();
    if (!granted) return null;

    const kind = payload.callType === 'video' ? 'Video' : 'Audio';
    const androidExtras =
      Platform.OS === 'android'
        ? {
            channelId: CALLS_CHANNEL_ID,
            priority: Notifications.AndroidNotificationPriority.MAX,
            sticky: true,
            autoDismiss: false,
            // Heads-up / lock-screen incoming-call UI where the OS allows it.
            fullScreenIntent: true,
          }
        : {};
    const id = await Notifications.scheduleNotificationAsync({
      identifier: `call-${payload.callId}`,
      content: {
        title: payload.interrupt
          ? `Call waiting · ${kind.toLowerCase()}`
          : `Incoming ${kind.toLowerCase()} call`,
        subtitle: payload.callerName,
        body: payload.interrupt
          ? `${payload.callerName ?? 'Someone'} is calling (waiting)`
          : `${payload.callerName ?? 'Someone'} is calling you`,
        data: {
          kind: 'incoming_call',
          type: payload.callType === 'video' ? 'VIDEO_CALL' : 'AUDIO_CALL',
          callId: payload.callId,
          callType: payload.callType,
          callerName: payload.callerName,
          callerAvatar: payload.callerAvatar,
          interrupt: payload.interrupt === true,
          deepLink: `kushlov://call/${payload.callId}?type=${payload.callType}`,
        },
        categoryIdentifier: CALL_NOTIFICATION_CATEGORY,
        sound: Platform.OS === 'ios' ? 'defaultRingtone' : 'default',
        ...(Platform.OS === 'android'
          ? androidExtras
          : {
              interruptionLevel: 'timeSensitive' as const,
            }),
      },
      trigger: null,
    });
    return id;
  } catch {
    return null;
  }
}

export async function dismissIncomingCallNotification(callId?: string): Promise<void> {
  try {
    if (callId) {
      await Notifications.dismissNotificationAsync(`call-${callId}`);
    }
    const presented = await Notifications.getPresentedNotificationsAsync();
    for (const n of presented) {
      const data = n.request.content.data as { kind?: string; type?: string; callId?: string } | undefined;
      const cancelled =
        data?.kind === 'call_cancelled' || data?.type === 'CALL_CANCELLED';
      const incoming = data?.kind === 'incoming_call';
      if ((incoming || cancelled) && (!callId || data?.callId === callId)) {
        await Notifications.dismissNotificationAsync(n.request.identifier);
      }
    }
  } catch {
    // ignore
  }
}
