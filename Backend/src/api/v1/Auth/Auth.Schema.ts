// src/modules/auth/user.model.ts

import { Schema, model, Types, Document } from 'mongoose';
import { IUser, UserRole, UserStatus } from './Auth.types';

/* =========================
   3. Schema
========================= */

const UserSchema = new Schema<IUser>(
  {
    tenantId: {
      type: Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },

    name: {
      type: String,
      required: true,
      trim: true,
    },

    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      index: true,
    },

    mobileNumber: {
      type: String,
      required: true,
    },

    password: {
      type: String,
      required: true,
      select: false,
    },

    role: {
      type: String,
      enum: Object.values(UserRole),
       required: true,
      default: UserRole.CUSTOMER,
    },

    status: {
      type: String,
      enum: Object.values(UserStatus),
      default: UserStatus.ACTIVE,
    },

    avatar: {
      type: String,
    },

    lastSeen: {
      type: Date,
    },

    isEmailVerified: {
      type: Boolean,
      default: false,
    },

    metadata: {
      type: Object,
      default: {},
    },

    token: {
      type: String,
      required: true,
      trim: true,
    },
  },
  { timestamps: true },
);

/* =========================
   4. Indexes (CRITICAL)
========================= */

// Unique per tenant
UserSchema.index({ tenantId: 1, email: 1 }, { unique: true });

// Optional performance indexes
UserSchema.index({ tenantId: 1, role: 1 });
UserSchema.index({ tenantId: 1, status: 1 });

/* =========================
   5. Model
========================= */

export const UserModel = model<IUser>('User', UserSchema);
