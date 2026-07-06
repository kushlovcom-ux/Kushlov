import { env } from '../../config/env';
import { logger } from '../../config/logger';
import { MockPaymentProvider } from './mock.provider';
import { PaymentProvider } from './provider.interface';

/**
 * Payment provider factory. Add new providers (Stripe, Razorpay, PayPal…) by
 * implementing PaymentProvider and registering them here — the rest of the app
 * only depends on the interface, never a concrete provider.
 */
let provider: PaymentProvider | null = null;

export function getPaymentProvider(): PaymentProvider {
  if (provider) return provider;

  switch (env.PAYMENT_PROVIDER) {
    // case 'stripe':
    //   provider = new StripePaymentProvider();
    //   break;
    case 'mock':
    default:
      if (env.PAYMENT_PROVIDER !== 'mock') {
        logger.warn(`Unknown PAYMENT_PROVIDER "${env.PAYMENT_PROVIDER}", falling back to mock`);
      }
      provider = new MockPaymentProvider();
  }
  return provider;
}

export * from './provider.interface';
