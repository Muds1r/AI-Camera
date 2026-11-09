import { Router, Request, Response, NextFunction } from 'express';
import { Permission } from '../lib/auth/permissions';
import { setAuthCookies } from '../lib/auth/cookies';
import { ACCESS_TTL_SECONDS } from '../lib/auth/tokens';
import { HttpError, routeParam } from '../lib/http';
import { requireAnyPermission, requireAuth, requirePermission } from '../middleware/auth';
import { assignRole, createAccount, publicUserSelect, updateOwnProfile } from '../lib/auth/users';
import { prisma } from '../lib/prisma';
import { replaceSessionAfterPasswordChange } from '../services/auth.service';
import {
  employmentProfile,
  ensureLeaveBalances,
  listPeople,
  updateEmployment,
} from '../services/workforce.service';
import { Role } from '@prisma/client';
import { isRole } from '../lib/auth/permissions';
import {
  assertCanSetAvatar,
  clearUserAvatar,
  saveUserAvatar,
  uploadPicture,
} from '../lib/auth/avatars';

const router = Router();

function asyncHandler(fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction) => {
    fn(req, res, next).catch(next);
  };
}

router.use(requireAuth);

router.get(
  '/me',
  requirePermission(Permission.ProfileReadOwn),
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findUnique({
      where: { id: req.auth!.id },
      select: publicUserSelect,
    });
    if (!user) throw new HttpError(401, 'Unauthorized');
    res.json({ user });
  }),
);

router.patch(
  '/me',
  asyncHandler(async (req, res) => {
    const { user, passwordChanged } = await updateOwnProfile(req.auth!, req.body ?? {});

    if (passwordChanged) {
      const session = await replaceSessionAfterPasswordChange(req.auth!.id);
      if (!session.ok) throw new HttpError(401, 'Unauthorized');
      setAuthCookies(res, session.accessToken, session.refreshToken);
      res.json({
        user: session.user,
        accessToken: session.accessToken,
        expiresIn: ACCESS_TTL_SECONDS,
      });
      return;
    }

    res.json({ user });
  }),
);

router.post(
  '/me/avatar',
  uploadPicture,
  asyncHandler(async (req, res) => {
    if (!req.file) throw new HttpError(400, 'Choose an image to upload');
    if (req.auth!.role === Role.super_admin) {
      const user = await saveUserAvatar(req.auth!.id, req.file);
      res.json({ user });
      return;
    }
    res.json({ avatar_url: `/api/uploads/avatars/${req.file.filename}` });
  }),
);

router.delete(
  '/me/avatar',
  requirePermission(Permission.ProfileUpdateOwn),
  asyncHandler(async (req, res) => {
    const user = await clearUserAvatar(req.auth!.id);
    res.json({ user });
  }),
);

router.post(
  '/:id/avatar',
  requireAnyPermission(Permission.UsersCreateEmployee, Permission.UsersCreateAny),
  uploadPicture,
  asyncHandler(async (req, res) => {
    if (!req.file) throw new HttpError(400, 'Choose an image to upload');
    const userId = routeParam(req.params.id);
    await assertCanSetAvatar(req.auth!, userId);
    const user = await saveUserAvatar(userId, req.file);
    res.json({ user });
  }),
);

router.get(
  '/',
  requirePermission(Permission.UsersRead),
  asyncHandler(async (req, res) => {
    const requested = isRole(req.query.role) ? req.query.role : undefined;
    const q = typeof req.query.q === 'string' ? req.query.q : undefined;
    const page = Math.max(1, Number(req.query.page) || 1);
    const active =
      req.query.active === 'true' ? true : req.query.active === 'false' ? false : undefined;
    res.json(await listPeople(req.auth!, requested, q, page, active));
  }),
);

router.get(
  '/:id',
  requirePermission(Permission.UsersRead),
  asyncHandler(async (req, res) => {
    res.json(await employmentProfile(req.auth!, routeParam(req.params.id)));
  }),
);

router.patch(
  '/:id',
  requirePermission(Permission.UsersManage),
  asyncHandler(async (req, res) => {
    const user = await updateEmployment(req.auth!, routeParam(req.params.id), req.body ?? {});
    res.json({ user });
  }),
);

router.post(
  '/',
  requireAnyPermission(Permission.UsersCreateEmployee, Permission.UsersCreateAny),
  asyncHandler(async (req, res) => {
    const user = await createAccount(req.auth!, req.body ?? {});
    await ensureLeaveBalances(user.id);
    res.status(201).json({ user });
  }),
);

router.patch(
  '/:id/role',
  requirePermission(Permission.UsersAssignRole),
  asyncHandler(async (req, res) => {
    const user = await assignRole(req.auth!, routeParam(req.params.id), req.body?.role);
    res.json({ user });
  }),
);

export default router;
