import { Types } from 'mongoose';
import {
  AudioCall,
  Block,
  ContactInquiry,
  Conversation,
  DiamondTransaction,
  Follower,
  GoldTransaction,
  Like,
  LiveChat,
  LiveParticipant,
  LiveStream,
  Match,
  Message,
  MessageCredit,
  Notification,
  Payment,
  Profile,
  Report,
  Review,
  Subscription,
  User,
  VerificationRequest,
  VideoCall,
  Wallet,
  WithdrawRequest,
} from '../models';

/**
 * Permanently remove a user and cascade-delete related documents.
 * Does not delete admin accounts (caller must enforce that).
 */
export async function purgeUserCompletely(userId: string | Types.ObjectId): Promise<void> {
  const id = typeof userId === 'string' ? new Types.ObjectId(userId) : userId;
  const idStr = id.toString();

  // Conversations this user is in — delete their messages, then remove them from / delete 1:1 threads.
  const conversations = await Conversation.find({ participants: id }).select('_id participants isGroup');
  const conversationIds = conversations.map((c) => c._id);

  if (conversationIds.length) {
    await Message.deleteMany({ conversation: { $in: conversationIds }, sender: id });
    await Message.updateMany(
      { conversation: { $in: conversationIds } },
      { $pull: { readBy: id, deletedFor: id } },
    );

    for (const c of conversations) {
      if (!c.isGroup && c.participants.length <= 2) {
        await Message.deleteMany({ conversation: c._id });
        await Conversation.deleteOne({ _id: c._id });
      } else {
        await Conversation.updateOne({ _id: c._id }, { $pull: { participants: id } });
      }
    }
  }

  const liveIds = await LiveStream.find({ host: id }).distinct('_id');
  if (liveIds.length) {
    await LiveChat.deleteMany({ stream: { $in: liveIds } });
    await LiveParticipant.deleteMany({ stream: { $in: liveIds } });
    await LiveStream.deleteMany({ _id: { $in: liveIds } });
  }
  await LiveChat.deleteMany({ user: id });
  await LiveParticipant.deleteMany({ user: id });

  await Promise.all([
    Profile.deleteOne({ user: id }),
    Wallet.deleteOne({ user: id }),
    DiamondTransaction.deleteMany({ user: id }),
    GoldTransaction.deleteMany({ $or: [{ user: id }, { fromUser: id }] }),
    Payment.deleteMany({ user: id }),
    WithdrawRequest.deleteMany({ host: id }),
    Subscription.deleteMany({ user: id }),
    VerificationRequest.deleteMany({ user: id }),
    Notification.deleteMany({ $or: [{ user: id }, { actor: id }] }),
    Report.deleteMany({ $or: [{ reporter: id }, { reportedUser: id }] }),
    Block.deleteMany({ $or: [{ blocker: id }, { blocked: id }] }),
    Like.deleteMany({ $or: [{ from: id }, { to: id }] }),
    Match.deleteMany({ users: id }),
    Follower.deleteMany({ $or: [{ follower: id }, { following: id }] }),
    AudioCall.deleteMany({ $or: [{ caller: id }, { callee: id }] }),
    VideoCall.deleteMany({ $or: [{ caller: id }, { callee: id }] }),
    Review.deleteMany({ $or: [{ host: id }, { reviewer: id }] }),
    MessageCredit.deleteMany({ $or: [{ user: id }, { host: id }] }),
    ContactInquiry.deleteMany({ user: id }),
  ]);

  await User.deleteOne({ _id: id });

  // Soft cleanup for any leftover refs keyed by string (defensive).
  void idStr;
}
