import { Types } from 'mongoose';

export enum TenantPlan {
  FREE = 'free',
  PRO = 'pro',
  ENTERPRISE = 'enterprise',
}

export enum TenantStatus {
  ACTIVE = 'active',
  SUSPENDED = 'suspended',
}

export enum PaymentStatus {
  PENDING = 'pending',
  SUCCESS = 'success',
  FAILED = 'failed',

  CANCELLED = 'cancelled',
  EXPIRED = 'expired',

  REFUNDED = 'refunded',
  PARTIALLY_REFUNDED = 'partially_refunded',

  DISPUTED = 'disputed',

  PROCESSING = 'processing',
}

export interface ITenant {
  _id?: Types.ObjectId;

  // Company Info
  name: string;
  slug: string;

  email: string;
  phone: string;

  website?: string;
  address?: string;

  // Ownership
  ownerId?: Types.ObjectId;

  // SaaS
  plan: TenantPlan;
  status: TenantStatus;

  // SDK
  apiKey?: string;
  domain?: string;

  // Branding
  logo?: string;
  primaryColor?: string;
  paymentStatus: PaymentStatus | undefined;

  // Settings
  settings: {
    aiEnabled: boolean;
    escalationThreshold: number;
    maxAgents: number;
  };

  createdAt: Date;
  updatedAt: Date;
}
