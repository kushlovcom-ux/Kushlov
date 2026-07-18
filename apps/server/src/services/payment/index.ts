import { env } from '../../config/env';
import { logger } from '../../config/logger';
import { MockPaymentProvider } from './mock.provider';
import { RazorpayPaymentProvider } from './razorpay.provider';
import { PaymentProvider } from './provider.interface';

/**
 * Payment provider factory. Add new providers (Stripe, Razorpay, PayPal…) by
 * implementing PaymentProvider and registering them here — the rest of the app
 * only depends on the interface, never a concrete provider.
 */
let provider: PaymentProvider | null = null;

function resolveProviderName(): string {
  const configured = (env.PAYMENT_PROVIDER || 'mock').toLowerCase().trim();
  const hasRazorpayKeys = Boolean(env.RAZORPAY_KEY_ID && env.RAZORPAY_KEY_SECRET);

  if (configured === 'razorpay') {
    if (!hasRazorpayKeys) {
      throw new Error(
        'PAYMENT_PROVIDER=razorpay but RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET are missing',
      );
    }
    return 'razorpay';
  }

  // Production often sets keys but forgets PAYMENT_PROVIDER — prefer Razorpay then.
  if (
    hasRazorpayKeys &&
    configured === 'mock' &&
    (env.NODE_ENV === 'production' || Boolean(process.env.VERCEL))
  ) {
    logger.warn(
      'Razorpay keys found in production with PAYMENT_PROVIDER=mock — using razorpay',
    );
    return 'razorpay';
  }

  return configured;
}

export function getPaymentProvider(): PaymentProvider {
  if (provider) return provider;

  const name = resolveProviderName();
  switch (name) {
    case 'razorpay':
      provider = new RazorpayPaymentProvider();
      logger.info('Using Razorpay payment provider');
      break;
    case 'mock':
      provider = new MockPaymentProvider();
      break;
    default:
      logger.warn(`Unknown PAYMENT_PROVIDER "${name}", falling back to mock`);
      provider = new MockPaymentProvider();
  }
  return provider;
}

/** Reset cached provider (tests / hot reload). */
export function resetPaymentProvider() {
  provider = null;
}

export * from './provider.interface';
