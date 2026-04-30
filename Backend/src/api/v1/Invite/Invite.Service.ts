import crypto from 'crypto';

import { InviteModel } from './Invite.Schema';

import { authService } from '../Auth/Auth.Service';
import { InviteStatus } from './Invite.type';
import { UserRole } from '../Auth/Auth.types';

class InviteService {
  async createInvite(data: { email: string; tenantId: string; invitedBy: string; role: string }) {
    const code = crypto.randomBytes(32).toString('hex');

    const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 min

    return await InviteModel.create({
      email: data.email.toLowerCase(),
      tenantId: data.tenantId,
      invitedBy: data.invitedBy,
      role: data.role,
      code,
      expiresAt,
    });
  }

  async acceptInvite(data: { code: string; name: string; password: string; mobileNumber: string }) {
    const invite = await InviteModel.findOne({ code: data.code });

    if (!invite) throw new Error('Invalid invite');

    if (invite.status !== InviteStatus.PENDING) throw new Error('Invite already used');

    if (invite.expiresAt < new Date()) throw new Error('Invite expired');

    // create user
    const user = await authService.createUser({
      name: data.name,
      email: invite.email,
      password: data.password,
      mobileNumber: data.mobileNumber,
      role: UserRole.CUSTOMER_CARE,
    });

    // mark used
    invite.status = InviteStatus.ACCEPTED;
    await invite.save();

    return user;
  }

  async getInvites(tenantId: string) {
    return InviteModel.find({ tenantId }).sort({ createdAt: -1 });
  }

  async revokeInvite(id: string) {
    return InviteModel.findByIdAndUpdate(id, {
      status: InviteStatus.REVOKED,
    });
  }
}

export const inviteService = new InviteService();
