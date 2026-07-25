import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { env } from '@/config/env';

export const CALL_NOTIFICATION_CATEGORY = 'incoming_call';
export const CALL_ACTION_ACCEPT = 'accept';
export const CALL_ACTION_DECLINE = 'decline';
export const CALLS_CHANNEL_ID = 'calls';

Notifications.setNotificationHandler({
  handleNotification: async (notification) => {
    const isCall = notification.request.content.data?.kind === 'incoming_call';
    return {
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
      shouldShowBanner: true,
      shouldShowList: true,
      priority: isCall
        ? Notifications.AndroidNotificationPriority.MAX
        : Notifications.AndroidNotificationPriority.DEFAULT,
    };
  },
});

let categoriesReady = false;

/** Android call channel + Accept/Decline notification actions. */
export async function setupCallNotifications(): Promise<void> {
  if (categoriesReady) return;
  try {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync(CALLS_CHANNEL_ID, {
        name: 'Incoming calls',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 400, 200, 400],
        lightColor: '#22c55e',
        sound: 'default',
        lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      });
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#ec4899',
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
  const { status } = await Notifications.requestPermissionsAsync();
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

/** Local ringing notification with Accept / Decline actions. */
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
        body: payload.interrupt
          ? `${payload.callerName ?? 'Someone'} is calling (waiting)`
          : `${payload.callerName ?? 'Someone'} is calling you`,
        data: {
          kind: 'incoming_call',
          callId: payload.callId,
          callType: payload.callType,
          callerName: payload.callerName,
          interrupt: payload.interrupt === true,
        },
        categoryIdentifier: CALL_NOTIFICATION_CATEGORY,
        sound: true,
        ...(Platform.OS === 'android'
          ? {
              channelId: CALLS_CHANNEL_ID,
              priority: Notifications.AndroidNotificationPriority.MAX,
              sticky: true,
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
