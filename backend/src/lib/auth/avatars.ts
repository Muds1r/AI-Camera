import { randomUUID } from 'crypto';
import fs from 'fs';
import path from 'path';
import multer from 'multer';
import { Role } from '@prisma/client';
import { NextFunction, Request, Response } from 'express';
import { prisma } from '../prisma';
import { HttpError } from '../http';
import { AuthUser } from './session';
import { publicUserSelect, PublicUser } from './users';

export const AVATAR_DIR = path.join(process.cwd(), 'uploads', 'avatars');

const ALLOWED_TYPES = new Map([
  ['image/jpeg', '.jpg'],
  ['image/png', '.png'],
  ['image/webp', '.webp'],
]);

fs.mkdirSync(AVATAR_DIR, { recursive: true });

const upload = multer({
  storage: multer.diskStorage({
    destination: AVATAR_DIR,
    filename: (_req, file, callback) => {
      const extension = ALLOWED_TYPES.get(file.mimetype) ?? '.img';
      callback(null, `${randomUUID()}${extension}`);
    },
  }),
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (_req, file, callback) => {
    if (ALLOWED_TYPES.has(file.mimetype)) {
      callback(null, true);
      return;
    }
    callback(new Error('Picture must be a JPEG, PNG, or WebP image'));
  },
});

export function uploadPicture(req: Request, res: Response, next: NextFunction): void {
  upload.single('picture')(req, res, (err: unknown) => {
    if (!err) {
      next();
      return;
    }
    const code = typeof err === 'object' && err && 'code' in err ? String(err.code) : '';
    const message =
      code === 'LIMIT_FILE_SIZE'
        ? 'Picture must be 2 MB or smaller'
        : err instanceof Error
          ? err.message
          : 'Picture upload failed';
    res.status(400).json({ error: message });
  });
}

function storedName(avatarUrl: string | null): string | null {
  if (!avatarUrl?.startsWith('/api/uploads/avatars/')) return null;
  const name = path.basename(avatarUrl);
  return /^[0-9a-f-]{36}\.(jpg|png|webp)$/i.test(name) ? name : null;
}

async function removeStoredAvatar(avatarUrl: string | null): Promise<void> {
  const name = storedName(avatarUrl);
  if (!name) return;
  await fs.promises.unlink(path.join(AVATAR_DIR, name)).catch(() => undefined);
}

export async function assertCanSetAvatar(actor: AuthUser, userId: string): Promise<void> {
  if (actor.id === userId) return;
  const target = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
  if (!target) throw new HttpError(404, 'User not found');
  if (actor.role === Role.super_admin) return;
  if (actor.role === Role.hr && target.role === Role.employee) return;
  throw new HttpError(403, 'You cannot change this picture');
}

export async function saveUserAvatar(
  userId: string,
  file: Express.Multer.File,
): Promise<PublicUser> {
  const existing = await prisma.user.findUnique({
    where: { id: userId },
    select: { avatar_url: true },
  });
  if (!existing) {
    await fs.promises.unlink(file.path).catch(() => undefined);
    throw new HttpError(404, 'User not found');
  }

  await removeStoredAvatar(existing.avatar_url);
  return prisma.user.update({
    where: { id: userId },
    data: { avatar_url: `/api/uploads/avatars/${path.basename(file.filename)}` },
    select: publicUserSelect,
  });
}

export async function clearUserAvatar(userId: string): Promise<PublicUser> {
  const existing = await prisma.user.findUnique({
    where: { id: userId },
    select: { avatar_url: true },
  });
  if (!existing) throw new HttpError(404, 'User not found');
  await removeStoredAvatar(existing.avatar_url);
  return prisma.user.update({
    where: { id: userId },
    data: { avatar_url: null },
    select: publicUserSelect,
  });
}

export function sendAvatar(filename: string, res: Response): void {
  if (!/^[0-9a-f-]{36}\.(jpg|png|webp)$/i.test(filename)) {
    throw new HttpError(404, 'Picture not found');
  }
  const filePath = path.join(AVATAR_DIR, filename);
  if (!fs.existsSync(filePath)) throw new HttpError(404, 'Picture not found');
  res.sendFile(filePath);
}
