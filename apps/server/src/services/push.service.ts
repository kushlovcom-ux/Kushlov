import { NotificationType } from '@kushlov/types';
import { logger } from '../config/logger';
import { User } from '../models';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

type ExpoPushMessage = {
  to: string;
  title: string;
  body?: string;
  data?: Record<string, string>;
  sound?: string;
  channelId?: string;
  priority?: 'default' | 'normal' | 'high';
  interruptionLevel?: 'passive' | 'active' | 'timeSensitive' | 'critical';
  badge?: number;
};

function flattenData(data?: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {};
  if (!data) return out;
  for (const [key, value] of Object.entries(data)) {
    if (value == null) continue;
    out[key] = typeof value === 'string' ? value : JSON.stringify(value);
  }
  return out;
}

function isCallNotification(type: NotificationType, data?: Record<string, unknown>) {
  return type === NotificationType.Call || data?.kind === 'incoming_call';
}

/** Send an Expo push to a stored device token. Never throws. */
export async function sendExpoPush(params: {
  userId: string;
  type: NotificationType;
  title: string;
  body?: string;
  data?: Record<string, unknown>;
}): Promise<void> {
  try {
    const user = await User.findById(params.userId).select('+expoPushToken');
    const token = user?.expoPushToken?.trim();
    if (!token || !token.startsWith('ExponentPushToken')) return;

    const call = isCallNotification(params.type, params.data);
    const message: ExpoPushMessage = {
      to: token,
      title: params.title,
      body: params.body,
      data: flattenData(params.data),
      sound: call ? 'incoming_call.wav' : 'default',
      channelId: call ? 'incoming_calls' : 'default',
      priority: 'high',
      interruptionLevel: call ? 'timeSensitive' : 'active',
    };

    const res = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Accept-Encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify([message]),
    });
    const payload = (await res.json().catch(() => null)) as
      | { data?: Array<{ status?: string; message?: string }> }
      | null;
    if (!res.ok) {
      logger.warn({ status: res.status }, 'Expo push HTTP error');
      return;
    }
    const ticket = payload?.data?.[0];
    if (ticket?.status === 'error') {
      logger.warn({ message: ticket.message }, 'Expo push ticket error');
    }
  } catch (err) {
    logger.warn(
      { err: err instanceof Error ? err.message : String(err) },
      'Expo push send failed',
    );
  }
}
