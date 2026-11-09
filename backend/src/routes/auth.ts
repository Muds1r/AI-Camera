import { Router, Request, Response, NextFunction } from 'express';
import { REFRESH_COOKIE, ACCESS_TTL_SECONDS } from '../lib/auth/tokens';
import { clearAuthCookies, readCookie, setAuthCookies } from '../lib/auth/cookies';
import { publicUserSelect } from '../lib/auth/users';
import { prisma } from '../lib/prisma';
import { HttpError } from '../lib/http';
import { requireAuth } from '../middleware/auth';
import { login, logout, refreshSession } from '../services/auth.service';

const router = Router();

function asyncHandler(fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction) => {
    fn(req, res, next).catch(next);
  };
}

router.post(
  '/login',
  asyncHandler(async (req, res) => {
    const result = await login(req.body?.email, req.body?.password);
    if (!result.ok) throw new HttpError(401, 'Invalid email or password');

    setAuthCookies(res, result.accessToken, result.refreshToken);
    res.json({
      user: result.user,
      accessToken: result.accessToken,
      expiresIn: ACCESS_TTL_SECONDS,
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

    setAuthCookies(res, result.accessToken, result.refreshToken);
    res.json({
      user: result.user,
      accessToken: result.accessToken,
      expiresIn: ACCESS_TTL_SECONDS,
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
