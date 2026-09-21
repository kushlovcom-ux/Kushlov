import { DiamondTxnReason, GoldTxnReason } from '@kushlov/types';
import { LiveParticipant } from '../models';
import type { ILiveParticipant, ILiveStream } from '../models/live.model';
import { spendDiamonds } from './wallet.service';
import { computeCallDiamondCost } from './pricing.service';

/** Charge a viewer for watch time (idempotent via `billed` flag). */
export async function billLiveWatchIfNeeded(params: {
  live: Pick<ILiveStream, '_id' | 'host'>;
  participant: ILiveParticipant;
  endedAt?: Date;
}): Promise<{ diamondsSpent: number }> {
  const { live, participant, endedAt } = params;
  if (participant.billed) return { diamondsSpent: participant.diamondsSpent ?? 0 };
  if (participant.role !== 'viewer') {
    participant.billed = true;
    await participant.save();
    return { diamondsSpent: 0 };
  }
  const spd = Number(participant.secondsPerDiamond) || 0;
  if (spd <= 0) {
    participant.billed = true;
    await participant.save();
    return { diamondsSpent: 0 };
  }

  const leftAt = endedAt ?? participant.leftAt ?? new Date();
  const joinedAt = participant.joinedAt ?? leftAt;
  let watchSec = Math.max(0, Math.floor((leftAt.getTime() - joinedAt.getTime()) / 1000));
  if (participant.maxWatchSec > 0 && watchSec > participant.maxWatchSec) {
    watchSec = participant.maxWatchSec;
  }

  const cost = computeCallDiamondCost({
    durationSec: watchSec,
    ratePerMinute: 0,
    secondsPerDiamond: spd,
  });

  if (cost > 0) {
    try {
      await spendDiamonds({
        userId: participant.user,
        hostId: live.host.toString(),
        amount: cost,
        diamondReason: DiamondTxnReason.LiveWatch,
        goldReason: GoldTxnReason.LiveWatch,
        reference: live._id as any,
        referenceModel: 'LiveStream',
        meta: { watchSec, secondsPerDiamond: spd },
      });
      participant.diamondsSpent = cost;
    } catch {
      participant.diamondsSpent = 0;
    }
  }

  participant.billed = true;
  participant.leftAt = leftAt;
  await participant.save();
  return { diamondsSpent: participant.diamondsSpent ?? 0 };
}

/** Bill every still-watching viewer when a stream ends. */
export async function billOpenViewersForLive(live: Pick<ILiveStream, '_id' | 'host'>): Promise<void> {
  const open = await LiveParticipant.find({
    liveStream: live._id,
    role: 'viewer',
    billed: { $ne: true },
    $or: [{ leftAt: { $exists: false } }, { leftAt: null }],
  });
  const endedAt = new Date();
  await Promise.all(
    open.map((p) => billLiveWatchIfNeeded({ live, participant: p, endedAt })),
  );
}
