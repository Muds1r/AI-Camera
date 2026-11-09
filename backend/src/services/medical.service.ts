import { MedicalRequestStatus } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { HttpError } from '../lib/http';
import { roleHasPermission, Permission } from '../lib/auth/permissions';
import { AuthUser } from '../lib/auth/session';

const requestInclude = {
  requester: { select: { id: true, full_name: true, email: true, role: true } },
  reviewer: { select: { id: true, full_name: true, email: true } },
} as const;

export function listMedicalRequests(actor: AuthUser, scope: unknown) {
  const wantsQueue = scope === 'queue';
  if (wantsQueue && !roleHasPermission(actor.role, Permission.MedicalReview)) {
    throw new HttpError(403, 'Forbidden');
  }

  return prisma.medicalRequest.findMany({
    where: wantsQueue ? {} : { user_id: actor.id },
    include: requestInclude,
    orderBy: { created_at: 'desc' },
    take: 100,
  });
}

export async function submitMedicalRequest(userId: string, reason: unknown) {
  if (typeof reason !== 'string' || reason.trim().length < 3 || reason.trim().length > 2000) {
    throw new HttpError(400, 'A reason between 3 and 2000 characters is required');
  }

  return prisma.medicalRequest.create({
    data: { user_id: userId, reason: reason.trim() },
    include: requestInclude,
  });
}

export async function reviewMedicalRequest(
  actor: AuthUser,
  requestId: string,
  status: unknown,
  reviewNote: unknown,
) {
  if (status !== MedicalRequestStatus.approved && status !== MedicalRequestStatus.rejected) {
    throw new HttpError(400, 'Status must be approved or rejected');
  }

  let note: string | null = null;
  if (reviewNote !== undefined && reviewNote !== null) {
    if (typeof reviewNote !== 'string' || reviewNote.trim().length > 2000) {
      throw new HttpError(400, 'Review note must be at most 2000 characters');
    }
    note = reviewNote.trim() || null;
  }

  const request = await prisma.medicalRequest.findUnique({ where: { id: requestId } });
  if (!request) throw new HttpError(404, 'Medical request not found');
  if (request.user_id === actor.id) {
    throw new HttpError(403, 'You cannot review your own medical request');
  }
  if (request.status !== MedicalRequestStatus.pending) {
    throw new HttpError(409, 'This request has already been reviewed');
  }

  return prisma.medicalRequest.update({
    where: { id: request.id },
    data: {
      status,
      review_note: note,
      reviewed_by: actor.id,
      reviewed_at: new Date(),
    },
    include: requestInclude,
  });
}
