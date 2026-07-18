import { nanoid } from 'nanoid';
import { PaymentStatus } from '@kushlov/types';
import {
  CreateChargeInput,
  CreateChargeResult,
  PaymentProvider,
  VerifyPayload,
  VerifyResult,
} from './provider.interface';

/**
 * Mock provider for local development & tests. It "succeeds" immediately so the
 * full purchase → credit flow is exercisable without real payment credentials.
 */
export class MockPaymentProvider implements PaymentProvider {
  readonly name = 'mock';

  async createCharge(input: CreateChargeInput): Promise<CreateChargeResult> {
    return {
      providerRef: `mock_${nanoid(16)}`,
      checkoutUrl: `${process.env.CLIENT_URL ?? ''}/wallet/checkout/${input.paymentId}`,
      status: PaymentStatus.Pending,
    };
  }

  async verify(providerRef: string, _payload?: VerifyPayload): Promise<VerifyResult> {
    // In the mock, verification always resolves as succeeded.
    return { status: PaymentStatus.Succeeded, providerRef };
  }

  async refund(providerRef: string, amount?: number): Promise<VerifyResult> {
    return { status: PaymentStatus.Refunded, providerRef, amount };
  }

  async handleWebhook(rawBody: Buffer): Promise<{ providerRef: string; status: PaymentStatus } | null> {
    try {
      const payload = JSON.parse(rawBody.toString() || '{}');
      if (payload.providerRef && payload.status) {
        return { providerRef: payload.providerRef, status: payload.status };
      }
    } catch {
      /* ignore malformed */
    }
    return null;
  }
}
