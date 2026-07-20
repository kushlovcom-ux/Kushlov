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
    const msg =
      typeof err === 'object' && err && 'description' in err
        ? String((err as { description?: string }).description)
        : err instanceof Error
          ? err.message
          : 'Payment cancelled or failed';
    throw new Error(msg);
  }
}

/** Alias used by wallet screens */
export const openRazorpayCheckout = openCheckout;
