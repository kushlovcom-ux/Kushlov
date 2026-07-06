import { Types } from 'mongoose';
import { MessageType, NotificationType, SocketEvents } from '@kushlov/types';
import { Block, Conversation, Message } from '../../models';
import { ApiError } from '../../utils/ApiError';
import { emitToUser } from '../../socket/io';
import { notify } from '../../services/notification.service';
import { assertUsersWithinRange } from '../../services/location.service';

/** Find or create a 1:1 conversation between two users. */
export async function getOrCreateDirectConversation(a: string, b: string) {
  if (a === b) throw ApiError.badRequest('Cannot start a conversation with yourself');

  const blocked = await Block.exists({
    $or: [
      { blocker: a, blocked: b },
      { blocker: b, blocked: a },
    ],
  });
  if (blocked) throw ApiError.forbidden('Conversation not allowed (blocked)');

  await assertUsersWithinRange(a, b);

  const participants = [new Types.ObjectId(a), new Types.ObjectId(b)];
  let conversation = await Conversation.findOne({
    isGroup: false,
    participants: { $all: participants, $size: 2 },
  });
  if (!conversation) {
    conversation = await Conversation.create({ participants, isGroup: false });
  }
  return conversation;
}

interface CreateMessageInput {
  conversationId: string;
  senderId: string;
  type?: MessageType;
  text?: string;
  media?: { url: string; publicId: string; durationSec?: number; width?: number; height?: number };
  replyTo?: string;
  forwardedFrom?: string;
}

/**
 * Persist a message, update conversation metadata + unread counters, and push
 * realtime events to the other participants. Used by both REST and Socket.io.
 */
export async function createMessage(input: CreateMessageInput) {
  const conversation = await Conversation.findById(input.conversationId);
  if (!conversation) throw ApiError.notFound('Conversation not found');
  if (!conversation.participants.some((p) => p.toString() === input.senderId)) {
    throw ApiError.forbidden('Not a participant of this conversation');
  }

  const message = await Message.create({
    conversation: conversation._id,
    sender: input.senderId,
    type: input.type ?? MessageType.Text,
    text: input.text,
    media: input.media,
    replyTo: input.replyTo,
    forwardedFrom: input.forwardedFrom,
    readBy: [input.senderId],
  });

  conversation.lastMessage = message._id;
  conversation.lastMessageAt = new Date();
  for (const participant of conversation.participants) {
    const id = participant.toString();
    if (id !== input.senderId) {
      conversation.unread.set(id, (conversation.unread.get(id) ?? 0) + 1);
    }
  }
  await conversation.save();

  const populated = await message.populate('sender', 'displayName username avatarUrl');

  for (const participant of conversation.participants) {
    const id = participant.toString();
    if (id !== input.senderId) {
      emitToUser(id, SocketEvents.MessageNew, populated);
      await notify({
        userId: id,
        actor: input.senderId,
        type: NotificationType.Message,
        title: 'New message',
        body: input.text?.slice(0, 80) ?? 'Sent you an attachment',
        data: { conversationId: conversation._id.toString() },
      });
    }
  }

  return populated;
}
