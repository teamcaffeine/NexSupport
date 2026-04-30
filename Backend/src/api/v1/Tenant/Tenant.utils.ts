import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { env } from '../../../Validator/env.validator';

export class TenantUtils {
  static generateSlug(name: string) {
    return name
      .toLowerCase()
      .trim()
      .replace(/\s+/g, '-')
      .replace(/[^\w-]/g, '');
  }

  static generateApiKey(payload: { email: string }) {
    return jwt.sign(payload, env.JWT_SECRET, {
      expiresIn: '5hr',
    });

    crypto.randomBytes(24).toString('hex');
  }
}

export const tenantUtils = new TenantUtils();
