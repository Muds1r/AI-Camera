import { Router, Request, Response, NextFunction } from 'express';
import { REFRESH_COOKIE, ACCESS_TTL_SECONDS } from '../lib/auth/tokens';
import { clearAuthCookies, parseRememberMe, readCookie, setAuthCookies } from '../lib/auth/cookies';
import { publicUserSelect } from '../lib/auth/users';
import { prisma } from '../lib/prisma';
import { HttpError } from '../lib/http';
import { requireAuth } from '../middleware/auth';
import {
  isForgotPasswordRateLimited,
  FORGOT_PASSWORD_SUCCESS_MESSAGE,
} from '../lib/auth/forgot-password-rate-limit';
import {
  forgotPassword,
  hrContactEmail,
  login,
  logout,
  refreshSession,
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
  '/login',
  asyncHandler(async (req, res) => {
    const rememberMe = parseRememberMe(req.body?.rememberMe ?? req.body?.remember_me);
    const result = await login(req.body?.email, req.body?.password, rememberMe);
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
