import { Request, Response } from 'express';
import { MessageType, SocketEvents } from '@kushlov/types';
import { buildPaginated, parsePagination } from '@kushlov/utils';
import { Conversation, Message } from '../../models';
import { ApiError } from '../../utils/ApiError';
import { asyncHandler } from '../../utils/asyncHandler';
import { ok, created } from '../../utils/response';
import { uploadBuffer } from '../../services/media.service';
import { emitToUser } from '../../socket/io';
import { createMessage, getOrCreateDirectConversation } from './chat.service';

/** GET /chat/conversations — my conversations, most recent first. */
export const listConversations = asyncHandler(async (req: Request, res: Response) => {
  const { page, limit, skip } = parsePagination(req.query);
  const filter = { participants: req.user!.id };
  const [items, total] = await Promise.all([
    Conversation.find(filter)
      .sort({ lastMessageAt: -1, updatedAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('participants', 'displayName username avatarUrl isOnline lastSeenAt')
      .populate('lastMessage'),
    Conversation.countDocuments(filter),
  ]);
  const withUnread = items.map((c) => ({
    ...c.toObject(),
    unreadCount: c.unread.get(req.user!.id) ?? 0,
  }));
  return ok(res, buildPaginated(withUnread, page, limit, total));
});

/** POST /chat/conversations — open (or fetch) a direct conversation. */
export const openConversation = asyncHandler(async (req: Request, res: Response) => {
  const conversation = await getOrCreateDirectConversation(req.user!.id, req.body.userId);
  const populated = await conversation.populate(
    'participants',
    'displayName username avatarUrl isOnline',
  );
  return created(res, populated);
});

/** GET /chat/conversations/:id/messages — paginated message history. */
export const getMessages = asyncHandler(async (req: Request, res: Response) => {
  const { page, limit, skip } = parsePagination(req.query, { defaultLimit: 30 });
  const conversation = await Conversation.findById(req.params.id);
  if (!conversation || !conversation.participants.some((p) => p.toString() === req.user!.id)) {
    throw ApiError.forbidden('Not allowed');
  }
  const filter = { conversation: conversation._id, deletedFor: { $ne: req.user!.id } };
  const [items, total] = await Promise.all([
    Message.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('sender', 'displayName username avatarUrl')
      .populate('replyTo'),
    Message.countDocuments(filter),
  ]);
  return ok(res, buildPaginated(items.reverse(), page, limit, total));
});

/** POST /chat/conversations/:id/messages — send a text or media message. */
export const sendMessage = asyncHandler(async (req: Request, res: Response) => {
  let media;
  let type: MessageType = (req.body.type as MessageType) ?? MessageType.Text;
  if (req.file) {
    const uploaded = await uploadBuffer(req.file, `chat/${req.params.id}`);
    media = {
      url: uploaded.url,
      publicId: uploaded.publicId,
      durationSec: uploaded.durationSec,
      width: uploaded.width,
      height: uploaded.height,
      bytes: uploaded.bytes,
      fileName: uploaded.fileName,
      mimeType: uploaded.mimeType,
    };
    type =
      uploaded.type === 'video'
        ? MessageType.Video
        : uploaded.type === 'audio'
          ? MessageType.Voice
          : uploaded.type === 'image'
            ? MessageType.Image
            : MessageType.File;
  }

  const message = await createMessage({
    conversationId: req.params.id,
    senderId: req.user!.id,
    type,
    text: req.body.text,
    media,
    replyTo: req.body.replyTo,
  });
  return created(res, message);
});

/** PATCH /chat/conversations/:id/read — mark a conversation read. */
export const markRead = asyncHandler(async (req: Request, res: Response) => {
  const conversation = await Conversation.findById(req.params.id);
  if (!conversation || !conversation.participants.some((p) => p.toString() === req.user!.id)) {
    throw ApiError.forbidden('Not allowed');
  }
  conversation.unread.set(req.user!.id, 0);
  await conversation.save();
  await Message.updateMany(
    { conversation: conversation._id, readBy: { $ne: req.user!.id } },
    { $addToSet: { readBy: req.user!.id } },
  );
  conversation.participants
    .filter((p) => p.toString() !== req.user!.id)
    .forEach((p) =>
      emitToUser(p.toString(), SocketEvents.MessageRead, {
        conversationId: conversation._id.toString(),
        by: req.user!.id,
      }),
    );
  return ok(res, null, 'Marked as read');
});

/** DELETE /chat/messages/:id — delete for me, or for everyone if I'm the sender. */
export const deleteMessage = asyncHandler(async (req: Request, res: Response) => {
  const message = await Message.findById(req.params.id);
  if (!message) throw ApiError.notFound('Message not found');

  const forEveryone = req.query.forEveryone === 'true' && message.sender.toString() === req.user!.id;
  if (forEveryone) {
    message.deletedForEveryone = true;
    message.text = undefined;
    message.media = undefined;
  } else {
    message.deletedFor.push(req.user!.id as any);
  }
  await message.save();

  if (forEveryone) {
    const conversation = await Conversation.findById(message.conversation);
    conversation?.participants.forEach((p) =>
      emitToUser(p.toString(), SocketEvents.MessageDelete, { messageId: message._id.toString() }),
    );
  }
  return ok(res, null, 'Message deleted');
});

/** POST /chat/messages/:id/forward — forward a message to another conversation. */
export const forwardMessage = asyncHandler(async (req: Request, res: Response) => {
  const original = await Message.findById(req.params.id);
  if (!original) throw ApiError.notFound('Message not found');

  const conversation = await getOrCreateDirectConversation(req.user!.id, req.body.toUserId);
  const message = await createMessage({
    conversationId: conversation._id.toString(),
    senderId: req.user!.id,
    type: original.type,
    text: original.text,
    media: original.media,
    forwardedFrom: original._id.toString(),
  });
  return created(res, message);
});
