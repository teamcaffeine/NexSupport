import { Schema, model, Types, Document } from 'mongoose';
import { ITenant, TenantPlan, TenantStatus } from './Tenant.type';

/* =========================
   SCHEMA
========================= */

const TenantSchema = new Schema<ITenant>(
  {
    /* =========================
       COMPANY INFO
    ========================= */

    name: {
      type: String,
      required: true,
      trim: true,
    },

    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },

    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      index: true,
    },

    phone: {
      type: String,
      required: true,
    },

    website: {
      type: String,
      trim: true,
    },

    address: {
      type: String,
    },

    /* =========================
       OWNERSHIP
    ========================= */

    ownerId: {
      type: Types.ObjectId,
      ref: 'User',
      index: true,
    },

    /* =========================
       SAAS CONFIG
    ========================= */

    plan: {
      type: String,
      enum: Object.values(TenantPlan),
      default: TenantPlan.FREE,
    },

    status: {
      type: String,
      enum: Object.values(TenantStatus),
      default: TenantStatus.ACTIVE,
    },

    /* =========================
       SDK
    ========================= */

    apiKey: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },

    domain: {
      type: String,
      trim: true,
    },

    /* =========================
       BRANDING
    ========================= */

    logo: String,

    primaryColor: {
      type: String,
      default: '#6366f1',
    },

    paymentStatus: {
      type: String,
      enum: Object.values(TenantStatus),
      default: TenantPlan.FREE,
    },

    /* =========================
       SETTINGS
    ========================= */

    settings: {
      aiEnabled: {
        type: Boolean,
        default: true,
      },

      escalationThreshold: {
        type: Number,
        default: 0.5,
      },

      maxAgents: {
        type: Number,
        default: 5,
      },
    },
  },

  { timestamps: true },
);

/* =========================
   INDEXES
========================= */

TenantSchema.index({ slug: 1 }, { unique: true });
TenantSchema.index({ apiKey: 1 });
TenantSchema.index({ email: 1 });

/* =========================
   MODEL
========================= */

export const TenantModel = model<ITenant>('Tenant', TenantSchema);
