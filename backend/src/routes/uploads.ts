import { NextFunction, Request, Response, Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { routeParam } from '../lib/http';
import { sendAvatar } from '../lib/auth/avatars';
import { sendDocument } from '../lib/auth/documents';

const router = Router();

function asyncHandler(fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction) => {
    fn(req, res, next).catch(next);
  };
}

router.get(
  '/avatars/:filename',
  asyncHandler(async (req, res) => {
    sendAvatar(routeParam(req.params.filename), res);
  }),
);

router.get(
  '/documents/:filename',
  requireAuth,
  asyncHandler(async (req, res) => {
    sendDocument(routeParam(req.params.filename), res);
  }),
);

export default router;
