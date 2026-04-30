import { Types } from 'mongoose';
import { Document } from 'mongoose';

export enum InviteStatus {
  PENDING = 'pending',
  ACCEPTED = 'accepted',
  EXPIRED = 'expired',
  REVOKED = 'revoked',
}

export interface IInvite extends Document {
  _id: Types.ObjectId;

  email: string;

  tenantId: Types.ObjectId; // company reference

  invitedBy: Types.ObjectId; // admin/user who sent invite

  role: string; // agent/admin/etc.

  code: string; // unique invite code

  status: InviteStatus;

  expiresAt: Date;

  createdAt: Date;
  updatedAt: Date;
}
