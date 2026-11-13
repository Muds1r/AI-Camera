import { Router, Request, Response, NextFunction } from 'express';
import { REFRESH_COOKIE, ACCESS_TTL_SECONDS } from '../lib/auth/tokens';
import { clearAuthCookies, readCookie, setAuthCookies } from '../lib/auth/cookies';
import { publicUserSelect } from '../lib/auth/users';
import { prisma } from '../lib/prisma';
import { HttpError, routeParam } from '../lib/http';
import { requireAuth } from '../middleware/auth';
import {
  FORGOT_PASSWORD_SUCCESS_MESSAGE,
  isForgotPasswordRateLimited,
} from '../lib/auth/forgot-password-rate-limit';
import {
  completePasswordReset,
  forgotPassword,
  hrContactEmail,
  listSessions,
  login,
  logout,
  personActivity,
  refreshSession,
  revokeOtherSessions,
  revokeSession,
  verifyPasswordResetCode,
} from '../services/auth.service';

const router = Router();

function asyncHandler(fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction) => {
    fn(req, res, next).catch(next);
  };
}

router.post(
  '/forgot-password',
  asyncHandler(async (req, res) => {
    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    const clientKey = `${req.ip ?? 'unknown'}:${email || 'blank'}`;
    if (isForgotPasswordRateLimited(clientKey)) {
      res.json({ message: FORGOT_PASSWORD_SUCCESS_MESSAGE });
      return;
    }
    const result = await forgotPassword(req.body?.email);
    res.json(result);
  }),
);

router.post(
  '/forgot-password/verify',
  asyncHandler(async (req, res) => {
    const result = await verifyPasswordResetCode(req.body?.email, req.body?.code);
    res.json(result);
  }),
);

router.post(
  '/forgot-password/complete',
  asyncHandler(async (req, res) => {
    const result = await completePasswordReset(req.body?.resetToken, req.body?.password);
    res.json(result);
  }),
);

router.post(
  '/login',
  asyncHandler(async (req, res) => {
    const result = await login(req.body?.email, req.body?.password, req.body?.rememberMe);
    if (!result.ok) {
      if (result.reason === 'inactive') {
        const hrEmail = await hrContactEmail();
        throw new HttpError(403, 'Your account has been deactivated.', {
          code: 'account_inactive',
          hr_email: hrEmail,
        });
      }
      throw new HttpError(401, 'Invalid email or password');
    }

    setAuthCookies(res, result.accessToken, result.refreshToken, result.rememberMe);
    res.json({
      user: result.user,
      accessToken: result.accessToken,
      expiresIn: ACCESS_TTL_SECONDS,
      rememberMe: result.rememberMe,
    });
  }),
);

router.post(
  '/refresh',
  asyncHandler(async (req, res) => {
    const result = await refreshSession(readCookie(req.headers.cookie, REFRESH_COOKIE));
    if (!result.ok) {
      if (result.reason !== 'rotated') clearAuthCookies(res);
      throw new HttpError(401, 'Invalid session');
    }

    setAuthCookies(res, result.accessToken, result.refreshToken, result.rememberMe);
    res.json({
      user: result.user,
      accessToken: result.accessToken,
      expiresIn: ACCESS_TTL_SECONDS,
      rememberMe: result.rememberMe,
    });
  }),
);

router.post(
  '/logout',
  asyncHandler(async (req, res) => {
    const allDevices = req.body?.all === true;
    await logout(readCookie(req.headers.cookie, REFRESH_COOKIE), allDevices);
    clearAuthCookies(res);
    res.status(204).end();
  }),
);

router.get(
  '/sessions',
  requireAuth,
  asyncHandler(async (req, res) => {
    res.json({
      sessions: await listSessions(req.auth!.id, readCookie(req.headers.cookie, REFRESH_COOKIE)),
    });
  }),
);

router.post(
  '/sessions/others',
  requireAuth,
  asyncHandler(async (req, res) => {
    await revokeOtherSessions(req.auth!.id, readCookie(req.headers.cookie, REFRESH_COOKIE));
    res.status(204).end();
  }),
);

router.delete(
  '/sessions/:id',
  requireAuth,
  asyncHandler(async (req, res) => {
    await revokeSession(req.auth!.id, routeParam(req.params.id));
    res.status(204).end();
  }),
);

router.get(
  '/activity',
  requireAuth,
  asyncHandler(async (req, res) => {
    res.json({ activity: await personActivity(req.auth!.id) });
  }),
);

router.get(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findUnique({
      where: { id: req.auth!.id },
      select: publicUserSelect,
    });
    if (!user) throw new HttpError(401, 'Unauthorized');
    res.json({ user });
  }),
);

export default router;
