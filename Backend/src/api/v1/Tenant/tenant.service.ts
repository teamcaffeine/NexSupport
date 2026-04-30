import { TenantModel } from './Tenant.model';
import { ITenant } from './Tenant.type';
import { TenantUtils } from './Tenant.utils';

class TenantService {
  async createTenant(data: ITenant) {
    const slug = TenantUtils.generateSlug(data.name);
    const apiKey = TenantUtils.generateApiKey({
      email: data.email,
    });

    const exists = await TenantModel.findOne({ slug });
    if (exists) {
      throw new Error('Tenant name already taken');
    }

    const tenant = await TenantModel.create({
      ...data,
      slug,
      apiKey,
    });

    return tenant;
  }

  async getTenantById(id: string) {
    return TenantModel.findById(id);
  }

  async updateTenant(id: string, data: any) {
    return TenantModel.findByIdAndUpdate(id, data, { new: true });
  }

  async deleteTenant(id: string) {
    return TenantModel.findByIdAndUpdate(id, {
      status: 'deleted',
    });
  }

  async listTenants() {
    return TenantModel.find().sort({ createdAt: -1 });
  }
}

export const tenantService = new TenantService();
