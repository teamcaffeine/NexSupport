import { Request, Response } from 'express';
import { tenantService } from './tenant.service';
import { createTenantSchema, updateTenantSchema } from './tenant.validation';

class TenantController {
  /* =========================
     CREATE
  ========================= */
  createTenant = async (req: Request, res: Response) => {
    try {
      const parsed = createTenantSchema.safeParse(req.body);

      if (!parsed.success) {
        return res.status(400).json({
          success: false,
          errors: parsed.error.format(),
        });
      }

      const tenant = await tenantService.createTenant(req.body);

      return res.status(201).json({
        success: true,
        data: tenant,
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  };

  /* =========================
     GET
  ========================= */
  getTenant = async (req: Request, res: Response) => {
    let { id } = req.params;

    if (!id) throw new Error('Id is required');
    const tenant = await tenantService.getTenantById(String(id));

    return res.json({ success: true, data: tenant });
  };

  /* =========================
     UPDATE
  ========================= */
  updateTenant = async (req: Request, res: Response) => {
    const parsed = updateTenantSchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        errors: parsed.error.format(),
      });
    }

    let { id } = req.params;

    if (!id) throw new Error('Id is required');

    const tenant = await tenantService.updateTenant(String(id), parsed.data);

    return res.json({ success: true, data: tenant });
  };

  /* =========================
     DELETE
  ========================= */
  deleteTenant = async (req: Request, res: Response) => {
    let { id } = req.params;

    if (!id) throw new Error('Id is required');

    await tenantService.deleteTenant(String(id));

    return res.json({
      success: true,
      message: 'Tenant deleted',
    });
  };

  /* =========================
     LIST
  ========================= */
  listTenants = async (_req: Request, res: Response) => {
    const tenants = await tenantService.listTenants();

    return res.json({
      success: true,
      data: tenants,
    });
  };
}

export const tenantController = new TenantController();
