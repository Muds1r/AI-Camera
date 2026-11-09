import { Router, Request, Response, NextFunction } from 'express';
import { routeParam } from '../lib/http';
import { Permission } from '../lib/auth/permissions';
import { requireAnyPermission, requireAuth, requirePermission } from '../middleware/auth';
import {
  listMedicalRequests,
  reviewMedicalRequest,
  submitMedicalRequest,
} from '../services/medical.service';

const router = Router();

function asyncHandler(fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction) => {
    fn(req, res, next).catch(next);
  };
}

router.use(requireAuth);

router.get(
  '/',
  requireAnyPermission(Permission.MedicalReadOwn, Permission.MedicalReview),
  asyncHandler(async (req, res) => {
    const requests = await listMedicalRequests(req.auth!, req.query.scope);
    res.json({ requests });
  }),
);

router.post(
  '/',
  requirePermission(Permission.MedicalSubmitOwn),
  asyncHandler(async (req, res) => {
    const request = await submitMedicalRequest(req.auth!.id, req.body?.reason);
    res.status(201).json({ request });
  }),
);

router.patch(
  '/:id',
  requirePermission(Permission.MedicalReview),
  asyncHandler(async (req, res) => {
    const request = await reviewMedicalRequest(
      req.auth!,
      routeParam(req.params.id),
      req.body?.status,
      req.body?.review_note,
    );
    res.json({ request });
  }),
);

export default router;
