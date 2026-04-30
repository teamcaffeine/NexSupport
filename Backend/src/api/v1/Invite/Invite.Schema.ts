import { Schema, model, Types } from 'mongoose';
import { IInvite, InviteStatus } from './Invite.type';

const InviteSchema = new Schema<IInvite>(
  {
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      index: true,
    },

    tenantId: {
      type: Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },

    invitedBy: {
      type: Types.ObjectId,
      ref: 'User',
      required: true,
    },

    role: {
      type: String,
      required: true,
      default: 'agent',
    },

    code: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },

    status: {
      type: String,
      enum: Object.values(InviteStatus),
      default: InviteStatus.PENDING,
    },

    expiresAt: {
      type: Date,
      required: true,
      index: { expireAfterSeconds: 0 }, // 🔥 AUTO DELETE (TTL)
    },
  },
  { timestamps: true },
);

/* =========================
   3. Indexes
========================= */

// Prevent duplicate active invites for same email + tenant
InviteSchema.index(
  { email: 1, tenantId: 1, status: 1 },
  { unique: true, partialFilterExpression: { status: 'pending' } },
);

/* =========================
   4. Model
========================= */

export const InviteModel = model<IInvite>('Invite', InviteSchema);
