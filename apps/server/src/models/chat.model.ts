import { Schema, model, Document, Types } from 'mongoose';
import { MessageType } from '@kushlov/types';

export interface IConversation extends Document {
  participants: Types.ObjectId[];
  isGroup: boolean;
  lastMessage?: Types.ObjectId;
  lastMessageAt?: Date;
  unread: Map<string, number>;
  createdAt: Date;
  updatedAt: Date;
}

const conversationSchema = new Schema<IConversation>(
  {
    participants: {
      type: [{ type: Schema.Types.ObjectId, ref: 'User' }],
      required: true,
      index: true,
    },
    isGroup: { type: Boolean, default: false },
    lastMessage: { type: Schema.Types.ObjectId, ref: 'Message' },
    lastMessageAt: Date,
    unread: { type: Map, of: Number, default: {} },
  },
  { timestamps: true },
);
conversationSchema.index({ participants: 1, lastMessageAt: -1 });
export const Conversation = model<IConversation>(
  'Conversation',
  conversationSchema,
  'conversations',
);

export interface IMessage extends Document {
  conversation: Types.ObjectId;
  sender: Types.ObjectId;
  type: MessageType;
  text?: string;
  media?: {
    url: string;
    publicId: string;
    durationSec?: number;
    width?: number;
    height?: number;
    bytes?: number;
    fileName?: string;
    mimeType?: string;
  };
  replyTo?: Types.ObjectId;
  forwardedFrom?: Types.ObjectId;
  readBy: Types.ObjectId[];
  deletedFor: Types.ObjectId[];
  deletedForEveryone: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const messageSchema = new Schema<IMessage>(
  {
    conversation: {
      type: Schema.Types.ObjectId,
      ref: 'Conversation',
      required: true,
      index: true,
    },
    sender: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    type: { type: String, enum: Object.values(MessageType), default: MessageType.Text },
    text: { type: String, maxlength: 5000 },
    media: {
      url: String,
      publicId: String,
      durationSec: Number,
      width: Number,
      height: Number,
      bytes: Number,
      fileName: String,
      mimeType: String,
    },
    replyTo: { type: Schema.Types.ObjectId, ref: 'Message' },
    forwardedFrom: { type: Schema.Types.ObjectId, ref: 'Message' },
    readBy: { type: [{ type: Schema.Types.ObjectId, ref: 'User' }], default: [] },
    deletedFor: { type: [{ type: Schema.Types.ObjectId, ref: 'User' }], default: [] },
    deletedForEveryone: { type: Boolean, default: false },
  },
  { timestamps: true },
);
messageSchema.index({ conversation: 1, createdAt: -1 });
export const Message = model<IMessage>('Message', messageSchema, 'messages');
