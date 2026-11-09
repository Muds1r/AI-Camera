import { randomUUID } from 'crypto';
import fs from 'fs';
import path from 'path';
import multer from 'multer';
import { NextFunction, Request, Response } from 'express';
import { HttpError } from '../http';

export const DOCUMENT_DIR = path.join(process.cwd(), 'uploads', 'documents');

const ALLOWED_TYPES = new Map([
  ['image/jpeg', '.jpg'],
  ['image/png', '.png'],
  ['image/webp', '.webp'],
  ['application/pdf', '.pdf'],
]);

fs.mkdirSync(DOCUMENT_DIR, { recursive: true });

const upload = multer({
  storage: multer.diskStorage({
    destination: DOCUMENT_DIR,
    filename: (_req, file, callback) => {
      const extension = ALLOWED_TYPES.get(file.mimetype) ?? '.bin';
      callback(null, `${randomUUID()}${extension}`);
    },
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, callback) => {
    if (ALLOWED_TYPES.has(file.mimetype)) {
      callback(null, true);
      return;
    }
    callback(new Error('Document must be a JPEG, PNG, WebP, or PDF file'));
  },
});

export function uploadDocument(req: Request, res: Response, next: NextFunction): void {
  upload.single('document')(req, res, (err: unknown) => {
    if (!err) {
      next();
      return;
    }
    const code = typeof err === 'object' && err && 'code' in err ? String(err.code) : '';
    const message =
      code === 'LIMIT_FILE_SIZE'
        ? 'Document must be 5 MB or smaller'
        : err instanceof Error
          ? err.message
          : 'Document upload failed';
    res.status(400).json({ error: message });
  });
}

export function sendDocument(filename: string, res: Response): void {
  if (!/^[0-9a-f-]{36}\.(jpg|png|webp|pdf)$/i.test(filename)) {
    throw new HttpError(404, 'Document not found');
  }
  const filePath = path.join(DOCUMENT_DIR, filename);
  if (!fs.existsSync(filePath)) throw new HttpError(404, 'Document not found');
  res.sendFile(filePath);
}
