import type { AuthUser } from '../lib/auth/session';

declare global {
  namespace Express {
    interface Request {
      auth?: AuthUser;
    }
  }
}

export {};
