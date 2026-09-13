import { Platform } from 'react-native';

export type RazorpayCheckoutOptions = {
  key: string;
  amount: number;
  currency?: string;
  name?: string;
  description?: string;
  order_id: string;
  prefill?: { email?: string; contact?: string; name?: string };
  theme?: { color?: string };
};

export type RazorpaySuccess = {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
};

export class PaymentCancelledError extends Error {
  constructor(message = 'Payment cancelled') {
    super(message);
    this.name = 'PaymentCancelledError';
  }
}

type RazorpayErrorFields = {
  code?: string;
  description?: string;
  source?: string;
  step?: string;
  reason?: string;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : null;
}

function parseMaybeJson(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) return value;
  try {
    return JSON.parse(trimmed);
  } catch {
    return value;
  }
}

function errorFields(err: unknown): RazorpayErrorFields {
  const parsed = parseMaybeJson(err instanceof Error ? err.message : err);
  const root = asRecord(parsed);
  if (!root) return {};
  const inner = asRecord(root.error) ?? root;
  const text = (key: string) => {
    const value = inner[key];
    if (typeof value === 'string') return value;
    if (typeof value === 'number') return String(value);
    return undefined;
  };
  return {
    code: text('code'),
    description: text('description'),
    source: text('source'),
    step: text('step'),
    reason: text('reason'),
  };
}

function isBlank(value?: string): boolean {
  return !value || value === 'undefined' || value === 'null';
}

/** True when the user closed Checkout or backed out of authentication. */
export function isPaymentCancelled(err: unknown): boolean {
  if (err instanceof PaymentCancelledError) return true;
  const fields = errorFields(err);
  if (fields.source === 'customer') return true;
  if (fields.code === '0' || fields.code === '2') return true;
  const haystack = `${fields.reason ?? ''} ${fields.description ?? ''} ${
    err instanceof Error ? err.message : ''
  }`;
  return /cancel|dismiss|back.?press/i.test(haystack);
}

function razorpayFailureMessage(err: unknown): string {
  if (isPaymentCancelled(err)) return 'Payment cancelled';
  const fields = errorFields(err);
  if (!isBlank(fields.description)) return fields.description as string;
  if (err instanceof Error && err.message && !err.message.trim().startsWith('{')) {
    return err.message;
  }
  return 'Payment could not be completed. Please try again.';
}

export async function openCheckout(
  options: RazorpayCheckoutOptions,
): Promise<RazorpaySuccess> {
  if (Platform.OS === 'web') {
    throw new Error('Razorpay checkout is only available on Android/iOS builds.');
  }

  let RazorpayCheckout: { open: (opts: RazorpayCheckoutOptions) => Promise<RazorpaySuccess> };
  try {
    // Native module — unavailable in Expo Go
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    RazorpayCheckout = require('react-native-razorpay').default;
  } catch {
    throw new Error(
      'Razorpay native module is not available. Use a development build (expo-dev-client) or EAS build.',
    );
  }

  if (!RazorpayCheckout?.open) {
    throw new Error('Razorpay checkout failed to load.');
  }

  try {
    return await RazorpayCheckout.open({
      currency: 'INR',
      name: 'Kushlov',
      theme: { color: '#ec4899' },
      ...options,
    });
  } catch (err: unknown) {
    if (isPaymentCancelled(err)) {
      throw new PaymentCancelledError();
    }
    throw new Error(razorpayFailureMessage(err));
  }
}

/** Alias used by wallet screens */
export const openRazorpayCheckout = openCheckout;
