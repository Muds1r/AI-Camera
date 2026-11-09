import { Router, Request, Response, NextFunction } from 'express';
import { Permission } from '../lib/auth/permissions';
import { requireAuth, requirePermission } from '../middleware/auth';
import { listOwnAttendance, submitOwnAttendance } from '../services/attendance.service';

const router = Router();

function asyncHandler(fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction) => {
    fn(req, res, next).catch(next);
  };
}

router.use(requireAuth);

router.get(
  '/',
  requirePermission(Permission.AttendanceReadOwn),
  asyncHandler(async (req, res) => {
    const attendance = await listOwnAttendance(req.auth!.id);
    res.json({ attendance });
  }),
);

router.post(
  '/',
  requirePermission(Permission.AttendanceClockOwn),
  asyncHandler(async (req, res) => {
    const attendance = await submitOwnAttendance(req.auth!.id, req.body?.note);
    res.status(201).json({ attendance });
  }),
);

export default router;
