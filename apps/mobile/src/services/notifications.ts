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
export const DEFAULT_CHANNEL_ID = 'default';

Notifications.setNotificationHandler({
  handleNotification: async (notification) => {
    const data = notification.request.content.data as {
      kind?: string;
      conversationId?: string;
    };
    const appActive = AppState.currentState === 'active';
    const inThisChat =
      data?.kind === 'message' &&
      appActive &&
      Boolean(data.conversationId) &&
      data.conversationId === getActiveConversationId();
    const callHandledInApp = data?.kind === 'incoming_call' && appActive;

    if (inThisChat || callHandledInApp) {
      return {
        shouldShowAlert: false,
        shouldPlaySound: false,
        shouldSetBadge: true,
        shouldShowBanner: false,
        shouldShowList: false,
      };
    }

    const isCall = data?.kind === 'incoming_call';
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

export async function ensureNotificationPermissions(): Promise<boolean> {
  if (!Device.isDevice) return false;
  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === 'granted') return true;
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
          callId: payload.callId,
          callType: payload.callType,
          callerName: payload.callerName,
          callerAvatar: payload.callerAvatar,
          interrupt: payload.interrupt === true,
        },
        categoryIdentifier: CALL_NOTIFICATION_CATEGORY,
        sound: Platform.OS === 'ios' ? 'defaultRingtone' : 'default',
        ...(Platform.OS === 'android'
          ? {
              channelId: CALLS_CHANNEL_ID,
              priority: Notifications.AndroidNotificationPriority.MAX,
              sticky: true,
              autoDismiss: false,
            }
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
      const data = n.request.content.data as { kind?: string; callId?: string } | undefined;
      if (data?.kind === 'incoming_call' && (!callId || data.callId === callId)) {
        await Notifications.dismissNotificationAsync(n.request.identifier);
      }
    }
  } catch {
    // ignore
  }
}
