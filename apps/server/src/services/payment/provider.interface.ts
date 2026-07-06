import { PaymentStatus } from '@kushlov/types';

export interface CreateChargeInput {
  paymentId: string;
  userId: string;
  amount: number;
  currency: string;
  description: string;
  metadata?: Record<string, string>;
}

export interface CreateChargeResult {
  providerRef: string;
  /** For redirect-based providers (e.g. Stripe Checkout). */
  checkoutUrl?: string;
  /** For client-confirmed flows (e.g. Stripe PaymentIntents). */
  clientSecret?: string;
  status: PaymentStatus;
}

export interface VerifyResult {
  status: PaymentStatus;
  providerRef: string;
  amount?: number;
}

/** Contract every payment provider must implement. */
export interface PaymentProvider {
  readonly name: string;
  createCharge(input: CreateChargeInput): Promise<CreateChargeResult>;
  verify(providerRef: string): Promise<VerifyResult>;
  refund(providerRef: string, amount?: number): Promise<VerifyResult>;
  /** Parse & verify a provider webhook, returning a normalized event. */
  handleWebhook(rawBody: Buffer, signature?: string): Promise<{
    providerRef: string;
    status: PaymentStatus;
  } | null>;
}
