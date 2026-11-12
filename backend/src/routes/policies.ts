import { NextFunction, Request, Response, Router } from 'express';
import { prisma } from '../lib/prisma';
import { writeAudit } from '../lib/audit';
import { HttpError, routeParam } from '../lib/http';
import { Permission } from '../lib/auth/permissions';
import { requireAuth, requirePermission } from '../middleware/auth';

const router = Router();

function asyncHandler(fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction) => {
    fn(req, res, next).catch(next);
  };
}

const policyInclude = {
  author: { select: { id: true, full_name: true } },
} as const;

function policyText(title: unknown, body: unknown) {
  if (typeof title !== 'string' || title.trim().length < 3 || title.trim().length > 160) {
    throw new HttpError(400, 'Title must be between 3 and 160 characters');
  }
  if (typeof body !== 'string' || body.trim().length < 3 || body.trim().length > 20000) {
    throw new HttpError(400, 'Policy text must be between 3 and 20000 characters');
  }
  return { title: title.trim(), body: body.trim() };
}

router.use(requireAuth);

router.get(
  '/',
  asyncHandler(async (_req, res) => {
    const policies = await prisma.policy.findMany({
      include: policyInclude,
      orderBy: { updated_at: 'desc' },
      take: 100,
    });
    res.json({ policies });
  }),
);

router.post(
  '/',
  requirePermission(Permission.CompanyManage),
  asyncHandler(async (req, res) => {
    const text = policyText(req.body?.title, req.body?.body);
    const policy = await prisma.policy.create({
      data: { ...text, created_by: req.auth!.id },
      include: policyInclude,
    });
    await writeAudit(req.auth!.id, 'policy.create', 'policy', policy.id, policy.title);
    res.status(201).json({ policy });
  }),
);

router.patch(
  '/:id',
  requirePermission(Permission.CompanyManage),
  asyncHandler(async (req, res) => {
    const id = routeParam(req.params.id);
    const existing = await prisma.policy.findUnique({ where: { id } });
    if (!existing) throw new HttpError(404, 'Policy not found');
    const text = policyText(req.body?.title ?? existing.title, req.body?.body ?? existing.body);
    const policy = await prisma.policy.update({
      where: { id },
      data: text,
      include: policyInclude,
    });
    await writeAudit(req.auth!.id, 'policy.update', 'policy', policy.id, policy.title);
    res.json({ policy });
  }),
);

router.delete(
  '/:id',
  requirePermission(Permission.CompanyManage),
  asyncHandler(async (req, res) => {
    const id = routeParam(req.params.id);
    const existing = await prisma.policy.findUnique({ where: { id } });
    if (!existing) throw new HttpError(404, 'Policy not found');
    await prisma.policy.delete({ where: { id } });
    await writeAudit(req.auth!.id, 'policy.delete', 'policy', id, existing.title);
    res.status(204).end();
  }),
);

export default router;
