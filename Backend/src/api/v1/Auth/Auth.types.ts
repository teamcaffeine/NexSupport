// src/modules/auth/auth.types.ts

import { Types } from 'mongoose';
import { Document } from 'mongoose';

export enum UserRole {
  CUSTOMER = 'customer',
  CUSTOMER_CARE = 'customer_care',
  COMPANY = 'company',
}

export enum UserStatus {
  ACTIVE = 'active',
  BLOCKED = 'blocked',
  PENDING = 'pending',
}

export enum TokenType {
  ACCESS = 'access',
  REFRESH = 'refresh',
}

export interface IUser extends Document {
  _id: Types.ObjectId;

  tenantId: Types.ObjectId;

  name: string;
  email: string;
  mobileNumber: string;
  password: string;

  role: UserRole | undefined;
  status: UserStatus;

  avatar?: string;
  lastSeen?: Date;

  isEmailVerified: boolean;

  metadata?: Record<string, any>;

  token: string;

  createdAt: Date;
  updatedAt: Date;
}

export type CreateUserInput = {
  name: string;
  email: string;
  password: string;
  mobileNumber: string;
  role: UserRole | undefined;
};
