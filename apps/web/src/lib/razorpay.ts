export type RazorpaySuccessResponse = {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
};

type RazorpayOptions = {
  key: string;
  amount: number;
  currency: string;
  name?: string;
  description?: string;
  order_id: string;
  prefill?: { name?: string; email?: string; contact?: string };
  theme?: { color?: string };
  handler: (response: RazorpaySuccessResponse) => void;
  modal?: { ondismiss?: () => void };
};

declare global {
  interface Window {
    Razorpay?: new (options: RazorpayOptions) => { open: () => void };
  }
}

/** Load Razorpay Checkout.js once. */
export function loadRazorpayScript(): Promise<boolean> {
  if (typeof window === 'undefined') return Promise.resolve(false);
  if (window.Razorpay) return Promise.resolve(true);

  return new Promise((resolve) => {
    const existing = document.querySelector<HTMLScriptElement>('script[data-razorpay="1"]');
    if (existing) {
      existing.addEventListener('load', () => resolve(true));
      existing.addEventListener('error', () => resolve(false));
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.dataset.razorpay = '1';
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

/** Open Razorpay Checkout and resolve with payment details (or null if dismissed). */
export async function openRazorpayCheckout(options: {
  key: string;
  orderId: string;
  amount: number;
  currency: string;
  name?: string;
  description?: string;
  prefill?: { name?: string; email?: string };
}): Promise<RazorpaySuccessResponse | null> {
  const ok = await loadRazorpayScript();
  if (!ok || !window.Razorpay) {
    throw new Error('Unable to load Razorpay checkout');
  }

  return new Promise((resolve, reject) => {
    try {
      const rzp = new window.Razorpay!({
        key: options.key,
        amount: Math.round(options.amount * 100),
        currency: options.currency,
        name: options.name ?? 'Kushlov',
        description: options.description ?? 'Diamond purchase',
        order_id: options.orderId,
        prefill: options.prefill,
        theme: { color: '#ec4899' },
        handler: (response) => resolve(response),
        modal: {
          ondismiss: () => resolve(null),
        },
      });
      rzp.open();
    } catch (err) {
      reject(err);
    }
  });
}
