import { NextFunction, Request, Response, Router } from 'express';
import { prisma } from '../lib/prisma';
import { HttpError } from '../lib/http';
import { Permission } from '../lib/auth/permissions';
import { requireAuth, requirePermission } from '../middleware/auth';
import { uploadPicture } from '../lib/auth/avatars';
import { writeAudit } from '../lib/audit';

const router = Router();
const COMPANY_ID = 'default';

function asyncHandler(fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction) => {
    fn(req, res, next).catch(next);
  };
}

async function loadCompany() {
  return prisma.company.upsert({
    where: { id: COMPANY_ID },
    update: {},
    create: { id: COMPANY_ID, name: 'Camera' },
  });
}

function present(company: {
  name: string;
  logo_url: string | null;
  weekend_days: string;
  work_start: string;
}) {
  return {
    name: company.name,
    logo_url: company.logo_url,
    weekend_days: company.weekend_days,
    work_start: company.work_start,
  };
}

router.get(
  '/branding',
  asyncHandler(async (_req, res) => {
    res.json({ company: present(await loadCompany()) });
  }),
);

router.use(requireAuth);

router.get(
  '/',
  asyncHandler(async (_req, res) => {
    res.json({ company: present(await loadCompany()) });
  }),
);

router.patch(
  '/',
  requirePermission(Permission.CompanyManage),
  asyncHandler(async (req, res) => {
    const data: {
      name?: string;
      weekend_days?: string;
      work_start?: string;
      logo_url?: string | null;
    } = {};
    if (req.body?.name !== undefined) {
      const name = typeof req.body.name === 'string' ? req.body.name.trim() : '';
      if (name.length < 1 || name.length > 80)
        throw new HttpError(400, 'Company name must be between 1 and 80 characters');
      data.name = name;
    }
    if (typeof req.body?.weekend_days === 'string') data.weekend_days = req.body.weekend_days;
    if (typeof req.body?.work_start === 'string') data.work_start = req.body.work_start;
    if (req.body?.logo_url === null) data.logo_url = null;
    const company = await prisma.company.update({ where: { id: COMPANY_ID }, data });
    await writeAudit(req.auth!.id, 'company.update', 'company', COMPANY_ID, company.name);
    res.json({ company: present(company) });
  }),
);

router.post(
  '/logo',
  requirePermission(Permission.CompanyManage),
  uploadPicture,
  asyncHandler(async (req, res) => {
    if (!req.file) throw new HttpError(400, 'Choose an image to upload');
    const company = await prisma.company.update({
      where: { id: COMPANY_ID },
      data: { logo_url: `/api/uploads/avatars/${req.file.filename}` },
    });
    await writeAudit(req.auth!.id, 'company.logo', 'company', COMPANY_ID);
    res.json({ company: present(company) });
  }),
);

export default router;
