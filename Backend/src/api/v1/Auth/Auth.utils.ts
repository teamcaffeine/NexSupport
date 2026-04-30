// src/modules/auth/auth.utils.ts

import argon2 from 'argon2';
import jwt from 'jsonwebtoken';
import { Types } from 'mongoose';
import { UserModel } from './Auth.Schema';
import { env } from '../../../Validator/env.validator';
import { UserStatus } from './Auth.types';

export class AuthUtils {
  /* =========================
     PASSWORD UTILITIES
  ========================= */

  static async hashPassword(password: string): Promise<string> {
    return await argon2.hash(password);
  }

  static async comparePassword(plain: string, hashed: string): Promise<boolean> {
    return await argon2.verify(hashed, plain);
  }

  /* =========================
     USER QUERIES (SAFE)
  ========================= */

  // Find by email + tenant (IMPORTANT for multi-tenant)
  static async findUserByEmail(email: string) {
    return await UserModel.findOne({
      email: email.toLowerCase(),
    }).select('+password');
  }

  static async findUserById(userId: string) {
    return await UserModel.findById(userId);
  }

  static async findUserByIdAndTenant(userId: string) {
    return await UserModel.findOne({
      _id: userId,
    });
  }

  static async findActiveUserByEmail(email: string) {
    return await UserModel.findOne({
      email: email.toLowerCase(),
      status: UserStatus.ACTIVE,
    }).select('+password');
  }

  /* =========================
     JWT UTILITIES
  ========================= */

  static generateAccessToken(payload: { userId: string; role: string | undefined }) {
    return jwt.sign(payload, env.JWT_SECRET, {
      expiresIn: '15m',
    });
  }

  static generateRefreshToken(payload: { userId: string }) {
    return jwt.sign(payload, env.JWT_SECRET, {
      expiresIn: '7d',
    });
  }

  static verifyToken(token: string) {
    return jwt.verify(token, env.JWT_SECRET);
  }

  /* =========================
     VALIDATION HELPERS
  ========================= */

  static isValidObjectId(id: string) {
    return Types.ObjectId.isValid(id);
  }

  static normalizeEmail(email: string) {
    return email.trim().toLowerCase();
  }

  /* =========================
     SECURITY HELPERS
  ========================= */

  static sanitizeUser(user: any) {
    const obj = user.toObject ? user.toObject() : user;

    delete obj.password;
    delete obj.__v;

    return obj;
  }

  static ensureUserExists(user: any) {
    if (!user) {
      throw new Error('User not found');
    }
    return user;
  }

  static ensureActiveUser(user: any) {
    if (user.status !== 'active') {
      throw new Error('User is not active');
    }
    return user;
  }

  /* =========================
     ROLE CHECK
  ========================= */

  static hasRole(userRole: string, allowedRoles: string[]) {
    return allowedRoles.includes(userRole);
  }

  /* =========================
     UPDATE UTILITIES
  ========================= */

  static async updateLastSeen(userId: string) {
    return await UserModel.findByIdAndUpdate(userId, {
      lastSeen: new Date(),
    });
  }

  static async changePassword(userId: string, newPassword: string) {
    const hashed = await this.hashPassword(newPassword);

    return await UserModel.findByIdAndUpdate(userId, {
      password: hashed,
    });
  }

  static async blockUser(userId: string) {
    return await UserModel.findByIdAndUpdate(userId, {
      status: 'blocked',
    });
  }

  static async activateUser(userId: string) {
    return await UserModel.findByIdAndUpdate(userId, {
      status: 'active',
    });
  }
}
