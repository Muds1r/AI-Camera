import { NextFunction, Request, Response, Router } from 'express';
import { Permission } from '../lib/auth/permissions';
import { HttpError, routeParam } from '../lib/http';
import { requireAnyPermission, requireAuth, requirePermission } from '../middleware/auth';
import {
  allAttendance,
  benefitBalances,
  clockIn,
  clockOut,
  dashboardFor,
  deleteHoliday,
  leaveBalances,
  listBenefits,
  listHolidays,
  listLeave,
  listProfileRequests,
  ownAttendance,
  reviewBenefit,
  reviewLeave,
  reviewProfileRequest,
  salaryView,
  saveHoliday,
  submitBenefit,
  submitLeave,
  submitProfileRequest,
  updateLeaveDefaults,
} from '../services/workforce.service';
import { prisma } from '../lib/prisma';
import { uploadDocument } from '../lib/auth/documents';

const router = Router();

function asyncHandler(fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction) => {
    fn(req, res, next).catch(next);
  };
}

router.use(requireAuth);

router.get(
  '/dashboard',
  asyncHandler(async (req, res) => {
    res.json(await dashboardFor(req.auth!));
  }),
);

router.post(
  '/attendance/clock-in',
  requirePermission(Permission.AttendanceClockOwn),
  asyncHandler(async (req, res) => {
    res.status(201).json({ attendance: await clockIn(req.auth!.id) });
  }),
);

router.post(
  '/attendance/clock-out',
  requirePermission(Permission.AttendanceClockOwn),
  asyncHandler(async (req, res) => {
    res.json({ attendance: await clockOut(req.auth!.id) });
  }),
);

router.get(
  '/attendance/me',
  requirePermission(Permission.AttendanceReadOwn),
  asyncHandler(async (req, res) => {
    res.json(await ownAttendance(req.auth!.id, req.query.month));
  }),
);

router.get(
  '/attendance',
  requirePermission(Permission.AttendanceReadAll),
  asyncHandler(async (req, res) => {
    const q = typeof req.query.q === 'string' ? req.query.q : undefined;
    res.json(await allAttendance(req.query.month, q));
  }),
);

router.get(
  '/holidays',
  requirePermission(Permission.AttendanceSettings),
  asyncHandler(async (_req, res) => {
    res.json({ holidays: await listHolidays() });
  }),
);

router.post(
  '/holidays',
  requirePermission(Permission.AttendanceSettings),
  asyncHandler(async (req, res) => {
    res.status(201).json({ holiday: await saveHoliday(req.auth!.id, req.body ?? {}) });
  }),
);

router.delete(
  '/holidays/:id',
  requirePermission(Permission.AttendanceSettings),
  asyncHandler(async (req, res) => {
    await deleteHoliday(req.auth!.id, routeParam(req.params.id));
    res.status(204).end();
  }),
);

router.get(
  '/benefits/balances',
  requirePermission(Permission.MedicalReadOwn),
  asyncHandler(async (req, res) => {
    res.json(await benefitBalances(req.auth!.id));
  }),
);

router.get(
  '/benefits',
  requireAnyPermission(Permission.MedicalReadOwn, Permission.MedicalReview),
  asyncHandler(async (req, res) => {
    res.json({
      requests: await listBenefits(req.auth!, req.query.scope, req.query.kind, req.query),
    });
  }),
);

router.post(
  '/benefits/document',
  requirePermission(Permission.MedicalSubmitOwn),
  uploadDocument,
  asyncHandler(async (req, res) => {
    if (!req.file) throw new HttpError(400, 'Choose a document to upload');
    res.status(201).json({ document_url: `/api/uploads/documents/${req.file.filename}` });
  }),
);

router.post(
  '/benefits',
  requirePermission(Permission.MedicalSubmitOwn),
  asyncHandler(async (req, res) => {
    res.status(201).json({ request: await submitBenefit(req.auth!.id, req.body ?? {}) });
  }),
);

router.patch(
  '/benefits/:id',
  requirePermission(Permission.MedicalReview),
  asyncHandler(async (req, res) => {
    res.json({
      request: await reviewBenefit(
        req.auth!,
        routeParam(req.params.id),
        req.body?.status,
        req.body?.review_note,
      ),
    });
  }),
);

router.get(
  '/leave/balances',
  requirePermission(Permission.LeaveReadOwn),
  asyncHandler(async (req, res) => {
    res.json({ balances: await leaveBalances(req.auth!.id) });
  }),
);

router.get(
  '/leave/types',
  asyncHandler(async (_req, res) => {
    res.json({
      types: await prisma.leaveType.findMany({
        where: { is_active: true },
        orderBy: { name: 'asc' },
      }),
    });
  }),
);

router.patch(
  '/leave/types',
  requirePermission(Permission.CompanyManage),
  asyncHandler(async (req, res) => {
    const defaults =
      req.body?.defaults && typeof req.body.defaults === 'object' ? req.body.defaults : req.body;
    res.json({ types: await updateLeaveDefaults(req.auth!, defaults as Record<string, unknown>) });
  }),
);

router.get(
  '/leave',
  requireAnyPermission(Permission.LeaveReadOwn, Permission.LeaveReview),
  asyncHandler(async (req, res) => {
    res.json({ requests: await listLeave(req.auth!, req.query.scope, req.query) });
  }),
);

router.post(
  '/leave',
  requirePermission(Permission.LeaveSubmitOwn),
  asyncHandler(async (req, res) => {
    res.status(201).json({ request: await submitLeave(req.auth!.id, req.body ?? {}) });
  }),
);

router.patch(
  '/leave/:id',
  requirePermission(Permission.LeaveReview),
  asyncHandler(async (req, res) => {
    res.json({
      request: await reviewLeave(
        req.auth!,
        routeParam(req.params.id),
        req.body?.status,
        req.body?.review_note,
      ),
    });
  }),
);

router.get(
  '/salary/me',
  requirePermission(Permission.SalaryReadOwn),
  asyncHandler(async (req, res) => {
    res.json({ salary: await salaryView(req.auth!.id) });
  }),
);

router.get(
  '/profile-requests',
  requireAnyPermission(Permission.ProfileRequest, Permission.UsersManage),
  asyncHandler(async (req, res) => {
    res.json({ requests: await listProfileRequests(req.auth!, req.query.scope, req.query) });
  }),
);

router.post(
  '/profile-requests',
  requirePermission(Permission.ProfileRequest),
  asyncHandler(async (req, res) => {
    res.status(201).json({ request: await submitProfileRequest(req.auth!.id, req.body?.changes) });
  }),
);

router.patch(
  '/profile-requests/:id',
  requirePermission(Permission.UsersManage),
  asyncHandler(async (req, res) => {
    res.json({
      request: await reviewProfileRequest(
        req.auth!,
        routeParam(req.params.id),
        req.body?.status,
        req.body?.review_note,
      ),
    });
  }),
);

router.get(
  '/audit',
  requirePermission(Permission.AuditRead),
  asyncHandler(async (req, res) => {
    const page = Math.max(1, Number(req.query.page) || 1);
    const pageSize = 20;
    const [total, logs] = await Promise.all([
      prisma.auditLog.count(),
      prisma.auditLog.findMany({
        orderBy: { created_at: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { actor: { select: { full_name: true, role: true, email: true } } },
      }),
    ]);
    res.json({ logs, total, page, pageSize });
  }),
);

export default router;
