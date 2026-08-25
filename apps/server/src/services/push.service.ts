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
  categoryId?: string;
  priority?: 'default' | 'normal' | 'high';
  interruptionLevel?: 'passive' | 'active' | 'timeSensitive' | 'critical';
  badge?: number;
  ttl?: number;
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

async function dropInvalidToken(token: string) {
  await User.updateMany(
    { $or: [{ expoPushToken: token }, { 'expoPushDevices.token': token }] },
    {
      $unset: { expoPushToken: 1 },
      $pull: { expoPushDevices: { token } },
    },
  );
}

function collectTokens(user: {
  expoPushToken?: string;
  expoPushDevices?: Array<{ token?: string }>;
}): string[] {
  const tokens = new Set<string>();
  const latest = user.expoPushToken?.trim();
  if (latest?.startsWith('ExponentPushToken')) tokens.add(latest);
  for (const device of user.expoPushDevices ?? []) {
    const t = device.token?.trim();
    if (t?.startsWith('ExponentPushToken')) tokens.add(t);
  }
  return [...tokens];
}

/** Send an Expo push to every stored device token. Never throws. */
export async function sendExpoPush(params: {
  userId: string;
  type: NotificationType;
  title: string;
  body?: string;
  data?: Record<string, unknown>;
}): Promise<void> {
  try {
    const user = await User.findById(params.userId).select('+expoPushToken +expoPushDevices');
    const tokens = user ? collectTokens(user) : [];
    if (!tokens.length) return;

    const call = isCallNotification(params.type, params.data);
    const message = params.type === NotificationType.Message;
    const payload: Omit<ExpoPushMessage, 'to'> = {
      title: params.title,
      body: params.body,
      data: flattenData(params.data),
      sound: call ? 'default' : 'default',
      channelId: call ? 'incoming_calls_sys' : message ? 'messages' : 'default',
      categoryId: call ? 'incoming_call' : undefined,
      priority: 'high',
      interruptionLevel: call ? 'timeSensitive' : 'active',
      ttl: call ? 60 : 3600,
    };

    const res = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Accept-Encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(tokens.map((to) => ({ ...payload, to }))),
    });
    const body = (await res.json().catch(() => null)) as
      | { data?: Array<{ status?: string; message?: string; details?: { error?: string } }> }
      | null;
    if (!res.ok) {
      logger.warn({ status: res.status }, 'Expo push HTTP error');
      return;
    }
    for (let i = 0; i < (body?.data?.length ?? 0); i++) {
      const ticket = body!.data![i];
      if (ticket?.status === 'error') {
        logger.warn({ message: ticket.message }, 'Expo push ticket error');
        if (ticket.details?.error === 'DeviceNotRegistered' && tokens[i]) {
          await dropInvalidToken(tokens[i]);
        }
      }
    }
  } catch (err) {
    logger.warn(
      { err: err instanceof Error ? err.message : String(err) },
      'Expo push send failed',
    );
  }
}
