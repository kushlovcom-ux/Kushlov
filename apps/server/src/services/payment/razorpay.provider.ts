import crypto from 'node:crypto';
import Razorpay from 'razorpay';
import { PaymentStatus } from '@kushlov/types';
import { env } from '../../config/env';
import { ApiError } from '../../utils/ApiError';
import {
  CreateChargeInput,
  CreateChargeResult,
  PaymentProvider,
  VerifyPayload,
  VerifyResult,
} from './provider.interface';

/** Convert major currency units to Razorpay smallest unit (paise / cents). */
function toMinorUnits(amount: number): number {
  return Math.round(Number(amount) * 100);
}

export class RazorpayPaymentProvider implements PaymentProvider {
  readonly name = 'razorpay';
  private client: Razorpay;

  constructor() {
    if (!env.RAZORPAY_KEY_ID || !env.RAZORPAY_KEY_SECRET) {
      throw new Error('RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET are required for Razorpay');
    }
    this.client = new Razorpay({
      key_id: env.RAZORPAY_KEY_ID,
      key_secret: env.RAZORPAY_KEY_SECRET,
    });
  }

  async createCharge(input: CreateChargeInput): Promise<CreateChargeResult> {
    const currency = (input.currency || 'INR').toUpperCase();
    const amountMinor = toMinorUnits(input.amount);
    if (amountMinor < 100) {
      throw ApiError.badRequest('Payment amount is too low for Razorpay (minimum 1.00)');
    }

    const order = await this.client.orders.create({
      amount: amountMinor,
      currency,
      receipt: input.paymentId.slice(0, 40),
      notes: {
        paymentId: input.paymentId,
        userId: input.userId,
        description: input.description,
        ...(input.metadata ?? {}),
      },
    });

    return {
      providerRef: order.id,
      keyId: env.RAZORPAY_KEY_ID,
      amount: input.amount,
      currency,
      status: PaymentStatus.Pending,
    };
  }

  async verify(providerRef: string, payload?: VerifyPayload): Promise<VerifyResult> {
    const orderId = payload?.razorpayOrderId || providerRef;
    const paymentId = payload?.razorpayPaymentId;
    const signature = payload?.razorpaySignature;

    if (!paymentId || !signature) {
      return { status: PaymentStatus.Pending, providerRef: orderId };
    }

    if (orderId !== providerRef) {
      return { status: PaymentStatus.Failed, providerRef };
    }

    const expected = crypto
      .createHmac('sha256', env.RAZORPAY_KEY_SECRET!)
      .update(`${orderId}|${paymentId}`)
      .digest('hex');

    const valid =
      expected.length === signature.length &&
      crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));

    if (!valid) {
      return { status: PaymentStatus.Failed, providerRef };
    }

    return {
      status: PaymentStatus.Succeeded,
      providerRef: orderId,
      meta: { razorpayPaymentId: paymentId, razorpaySignature: signature },
    };
  }

  async refund(providerRef: string, amount?: number): Promise<VerifyResult> {
    // providerRef is order id; refunds need a payment id — look up latest payment on the order.
    const payments = await this.client.orders.fetchPayments(providerRef);
    const paid = (payments.items ?? []).find((p: { status?: string }) => p.status === 'captured');
    if (!paid?.id) {
      throw ApiError.badRequest('No captured Razorpay payment found to refund');
    }
    const refund = await this.client.payments.refund(paid.id, {
      ...(amount != null ? { amount: toMinorUnits(amount) } : {}),
    });
    return {
      status: PaymentStatus.Refunded,
      providerRef,
      amount: refund.amount != null ? Number(refund.amount) / 100 : amount,
      meta: { razorpayRefundId: refund.id, razorpayPaymentId: paid.id },
    };
  }

  async handleWebhook(
    rawBody: Buffer,
    signature?: string,
  ): Promise<{ providerRef: string; status: PaymentStatus } | null> {
    if (!env.RAZORPAY_WEBHOOK_SECRET || !signature) return null;

    const expected = crypto
      .createHmac('sha256', env.RAZORPAY_WEBHOOK_SECRET)
      .update(rawBody)
      .digest('hex');

    const valid =
      expected.length === signature.length &&
      crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
    if (!valid) return null;

    try {
      const event = JSON.parse(rawBody.toString('utf8')) as {
        event?: string;
        payload?: {
          payment?: { entity?: { order_id?: string; status?: string } };
          order?: { entity?: { id?: string; status?: string } };
        };
      };

      const orderId =
        event.payload?.payment?.entity?.order_id || event.payload?.order?.entity?.id;
      if (!orderId) return null;

      if (
        event.event === 'payment.captured' ||
        event.event === 'order.paid' ||
        event.payload?.payment?.entity?.status === 'captured'
      ) {
        return { providerRef: orderId, status: PaymentStatus.Succeeded };
      }
      if (event.event === 'payment.failed') {
        return { providerRef: orderId, status: PaymentStatus.Failed };
      }
    } catch {
      return null;
    }
    return null;
  }
}
