import { NextFunction, Request, Response, Router } from 'express';
import { routeParam } from '../lib/http';
import {
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from '../lib/notifications';
import { requireAuth } from '../middleware/auth';

const router = Router();

function asyncHandler(fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction) => {
    fn(req, res, next).catch(next);
  };
}

router.use(requireAuth);

router.get(
  '/',
  asyncHandler(async (req, res) => {
    res.json(await listNotifications(req.auth!.id));
  }),
);

router.post(
  '/read',
  asyncHandler(async (req, res) => {
    await markAllNotificationsRead(req.auth!.id);
    res.json({ unread: 0 });
  }),
);

router.patch(
  '/:id/read',
  asyncHandler(async (req, res) => {
    await markNotificationRead(req.auth!.id, routeParam(req.params.id));
    res.json({ ok: true });
  }),
);

export default router;
