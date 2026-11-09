import { NextFunction, Request, Response } from 'express';
import { Permission, roleHasAnyPermission, roleHasPermission } from '../lib/auth/permissions';
import { authenticateRequest } from '../lib/auth/session';
import { HttpError } from '../lib/http';

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  authenticateRequest(req)
    .then((user) => {
      req.auth = user;
      next();
    })
    .catch((err: unknown) => {
      if (err instanceof HttpError) {
        res.status(err.status).json({ error: err.message });
        return;
      }
      next(err);
    });
}

function forbid(res: Response): void {
  res.status(403).json({ error: 'Forbidden' });
}

export function requirePermission(...permissions: Permission[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.auth) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const allowed = permissions.every((permission) =>
      roleHasPermission(req.auth!.role, permission),
    );
    if (!allowed) {
      forbid(res);
      return;
    }
    next();
  };
}

export function requireAnyPermission(...permissions: Permission[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.auth) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    if (!roleHasAnyPermission(req.auth.role, permissions)) {
      forbid(res);
      return;
    }
    next();
  };
}
