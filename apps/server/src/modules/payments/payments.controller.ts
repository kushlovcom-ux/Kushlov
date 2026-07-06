import { Request, Response } from 'express';
import { DiamondTxnReason, NotificationType, PaymentStatus } from '@kushlov/types';
import { buildPaginated, parsePagination } from '@kushlov/utils';
import { Payment } from '../../models';
import { ApiError } from '../../utils/ApiError';
import { asyncHandler } from '../../utils/asyncHandler';
import { ok, created } from '../../utils/response';
import { getSettings } from '../../services/settings.service';
import { creditDiamonds } from '../../services/wallet.service';
import { getPaymentProvider } from '../../services/payment';
import { notify } from '../../services/notification.service';
import { logger } from '../../config/logger';

/** GET /payments/packages — purchasable diamond packages (public). */
export const listPackages = asyncHandler(async (_req: Request, res: Response) => {
  const settings = await getSettings();
  return ok(res, settings.diamondPackages.filter((p) => p.isActive));
});

/** POST /payments/purchase — start a diamond purchase for a package. */
export const purchaseDiamonds = asyncHandler(async (req: Request, res: Response) => {
  const { packageId } = req.body;
  const settings = await getSettings();
  const pkg = settings.diamondPackages.find((p) => p.id === packageId && p.isActive);
  if (!pkg) throw ApiError.badRequest('Invalid package');

  const diamonds = pkg.diamonds + pkg.bonus;
  const provider = getPaymentProvider();

  const payment = await Payment.create({
    user: req.user!.id,
    provider: provider.name,
    packageId: pkg.id,
    amount: pkg.price,
    currency: pkg.currency,
    diamonds,
    status: PaymentStatus.Created,
  });

  const charge = await provider.createCharge({
    paymentId: payment._id.toString(),
    userId: req.user!.id,
    amount: pkg.price,
    currency: pkg.currency,
    description: `${pkg.label} — ${diamonds} diamonds`,
    metadata: { paymentId: payment._id.toString() },
  });

  payment.providerRef = charge.providerRef;
  payment.status = charge.status;
  await payment.save();

  return created(
    res,
    {
      paymentId: payment._id,
      providerRef: charge.providerRef,
      checkoutUrl: charge.checkoutUrl,
      clientSecret: charge.clientSecret,
      status: payment.status,
    },
    'Payment created',
  );
});

/** POST /payments/:paymentId/verify — verify & settle a payment, crediting diamonds. */
export const verifyPayment = asyncHandler(async (req: Request, res: Response) => {
  const payment = await Payment.findOne({ _id: req.params.paymentId, user: req.user!.id });
  if (!payment) throw ApiError.notFound('Payment not found');
  if (payment.status === PaymentStatus.Succeeded) {
    return ok(res, payment, 'Payment already settled');
  }

  const provider = getPaymentProvider();
  const result = await provider.verify(payment.providerRef!);

  if (result.status === PaymentStatus.Succeeded) {
    await settlePayment(payment._id.toString());
    const fresh = await Payment.findById(payment._id);
    return ok(res, fresh, 'Payment successful, diamonds credited');
  }

  payment.status = result.status;
  if (result.status === PaymentStatus.Failed) payment.failureReason = 'Verification failed';
  await payment.save();
  return ok(res, payment, 'Payment not completed');
});

/** Idempotently mark a payment succeeded and credit diamonds once. */
async function settlePayment(paymentId: string): Promise<void> {
  // Atomic transition Created/Pending -> Succeeded prevents double crediting.
  const payment = await Payment.findOneAndUpdate(
    { _id: paymentId, status: { $in: [PaymentStatus.Created, PaymentStatus.Pending] } },
    { $set: { status: PaymentStatus.Succeeded } },
    { new: true },
  );
  if (!payment) return; // already settled or not settleable

  await creditDiamonds({
    userId: payment.user,
    amount: payment.diamonds,
    reason: DiamondTxnReason.Purchase,
    reference: payment._id,
    referenceModel: 'Payment',
  });
  await notify({
    userId: payment.user,
    type: NotificationType.Payment,
    title: 'Diamonds added 💎',
    body: `${payment.diamonds} diamonds have been added to your wallet`,
  });
}

/** GET /payments — payment history for the current user. */
export const listMyPayments = asyncHandler(async (req: Request, res: Response) => {
  const { page, limit, skip } = parsePagination(req.query);
  const filter = { user: req.user!.id };
  const [items, total] = await Promise.all([
    Payment.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
    Payment.countDocuments(filter),
  ]);
  return ok(res, buildPaginated(items, page, limit, total));
});

/** POST /payments/webhook — provider callbacks (raw body). */
export const webhook = asyncHandler(async (req: Request, res: Response) => {
  const provider = getPaymentProvider();
  const signature = req.headers['stripe-signature'] as string | undefined;
  const event = await provider.handleWebhook(req.body as Buffer, signature);
  if (!event) return res.status(400).json({ received: false });

  const payment = await Payment.findOne({ providerRef: event.providerRef });
  if (payment) {
    if (event.status === PaymentStatus.Succeeded) {
      await settlePayment(payment._id.toString());
    } else {
      payment.status = event.status;
      await payment.save();
    }
  }
  logger.info({ providerRef: event.providerRef, status: event.status }, 'Payment webhook processed');
  return res.json({ received: true });
});
