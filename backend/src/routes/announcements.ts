import { NextFunction, Request, Response, Router } from 'express';
import { prisma } from '../lib/prisma';
import { writeAudit } from '../lib/audit';
import { HttpError, routeParam } from '../lib/http';
import { Permission } from '../lib/auth/permissions';
import { uploadImage } from '../lib/auth/documents';
import { requireAuth, requirePermission } from '../middleware/auth';

const router = Router();

function asyncHandler(fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction) => {
    fn(req, res, next).catch(next);
  };
}

const IMAGE_PATH = /^\/api\/uploads\/documents\/[0-9a-f-]{36}\.(jpg|png|webp)$/i;

const announcementInclude = {
  author: { select: { id: true, full_name: true } },
  images: {
    orderBy: { position: 'asc' as const },
    select: { id: true, url: true, position: true },
  },
};

function announcementText(title: unknown, body: unknown, images: unknown) {
  if (typeof title !== 'string' || title.trim().length < 3 || title.trim().length > 160) {
    throw new HttpError(400, 'Title must be between 3 and 160 characters');
  }
  const text = typeof body === 'string' ? body.trim() : '';
  if (text.length > 8000)
    throw new HttpError(400, 'Announcement text must be at most 8000 characters');
  if (!Array.isArray(images) || images.length > 8) {
    throw new HttpError(400, 'An announcement can include up to 8 images');
  }
  const urls = images.filter((item): item is string => typeof item === 'string');
  if (urls.length !== images.length || urls.some((url) => !IMAGE_PATH.test(url))) {
    throw new HttpError(400, 'One of the images is invalid');
  }
  const unique = [...new Set(urls)];
  if (text.length < 3 && unique.length === 0) {
    throw new HttpError(400, 'Add the announcement text or at least one image');
  }
  return { title: title.trim(), body: text, urls: unique };
}

function imageRows(urls: string[]) {
  return urls.map((url, position) => ({ url, position }));
}

router.use(requireAuth);

router.get(
  '/',
  asyncHandler(async (_req, res) => {
    const announcements = await prisma.announcement.findMany({
      include: announcementInclude,
      orderBy: { created_at: 'desc' },
      take: 40,
    });
    res.json({ announcements });
  }),
);

router.post(
  '/image',
  requirePermission(Permission.CompanyManage),
  uploadImage,
  asyncHandler(async (req, res) => {
    if (!req.file) throw new HttpError(400, 'Choose an image to upload');
    res.status(201).json({ image_url: `/api/uploads/documents/${req.file.filename}` });
  }),
);

router.post(
  '/',
  requirePermission(Permission.CompanyManage),
  asyncHandler(async (req, res) => {
    const text = announcementText(req.body?.title, req.body?.body, req.body?.images ?? []);
    const announcement = await prisma.announcement.create({
      data: {
        title: text.title,
        body: text.body,
        created_by: req.auth!.id,
        images: text.urls.length > 0 ? { create: imageRows(text.urls) } : undefined,
      },
      include: announcementInclude,
    });
    await writeAudit(
      req.auth!.id,
      'announcement.create',
      'announcement',
      announcement.id,
      announcement.title,
    );
    res.status(201).json({ announcement });
  }),
);

router.patch(
  '/:id',
  requirePermission(Permission.CompanyManage),
  asyncHandler(async (req, res) => {
    const id = routeParam(req.params.id);
    const existing = await prisma.announcement.findUnique({ where: { id } });
    if (!existing) throw new HttpError(404, 'Announcement not found');
    const text = announcementText(
      req.body?.title ?? existing.title,
      req.body?.body ?? existing.body,
      req.body?.images ?? [],
    );
    const announcement = await prisma.$transaction(async (tx) => {
      await tx.announcementImage.deleteMany({ where: { announcement_id: id } });
      return tx.announcement.update({
        where: { id },
        data: {
          title: text.title,
          body: text.body,
          images: text.urls.length > 0 ? { create: imageRows(text.urls) } : undefined,
        },
        include: announcementInclude,
      });
    });
    await writeAudit(
      req.auth!.id,
      'announcement.update',
      'announcement',
      announcement.id,
      announcement.title,
    );
    res.json({ announcement });
  }),
);

router.delete(
  '/:id',
  requirePermission(Permission.CompanyManage),
  asyncHandler(async (req, res) => {
    const id = routeParam(req.params.id);
    const existing = await prisma.announcement.findUnique({ where: { id } });
    if (!existing) throw new HttpError(404, 'Announcement not found');
    await prisma.announcement.delete({ where: { id } });
    await writeAudit(req.auth!.id, 'announcement.delete', 'announcement', id, existing.title);
    res.status(204).end();
  }),
);

export default router;
