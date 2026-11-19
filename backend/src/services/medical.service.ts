import { MedicalRequestStatus, Role } from '@prisma/client';
import { assertBenefitWithinBudget } from '../lib/claims';
import { prisma } from '../lib/prisma';
import { HttpError } from '../lib/http';
import { notifyBenefitDecided, notifyBenefitFiler } from '../lib/notifications';
import { roleHasPermission, Permission } from '../lib/auth/permissions';
import { AuthUser } from '../lib/auth/session';

const requestInclude = {
  requester: { select: { id: true, full_name: true, email: true, role: true } },
  reviewer: { select: { id: true, full_name: true, email: true } },
} as const;

export function listMedicalRequests(actor: AuthUser, scope: unknown, behalf: unknown) {
  const wantsQueue = scope === 'queue';
  const onBehalf = behalf === '1' || behalf === 'true';
  if (wantsQueue) {
    const canSelf = roleHasPermission(actor.role, Permission.MedicalReview);
    const canBehalf = roleHasPermission(actor.role, Permission.MedicalReviewOnBehalf);
    if (onBehalf && !canBehalf) throw new HttpError(403, 'Forbidden');
    if (!onBehalf && !canSelf) throw new HttpError(403, 'Forbidden');
  }

  return prisma.medicalRequest.findMany({
    where: wantsQueue
      ? onBehalf
        ? { submitted_by: null, requester: { role: Role.finance } }
        : { submitted_by: null, requester: { role: { not: Role.finance } } }
      : { user_id: actor.id },
    include: requestInclude,
    orderBy: { created_at: 'desc' },
    take: 100,
  });
}

export async function submitMedicalRequest(_userId: string, _reason: unknown) {
  throw new HttpError(
    400,
    'Use POST /api/benefits with kind, amount, and reason to submit a medical or OPD claim',
  );
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
  const owner = await prisma.user.findUnique({
    where: { id: request.user_id },
    select: { role: true, full_name: true },
  });
  const hrQueue = Boolean(request.submitted_by) || owner?.role === Role.finance;
  if (hrQueue && !roleHasPermission(actor.role, Permission.MedicalReviewOnBehalf)) {
    throw new HttpError(403, 'HR reviews claims filed for a worker and finance staff claims');
  }
  if (!hrQueue && !roleHasPermission(actor.role, Permission.MedicalReview)) {
    throw new HttpError(403, 'Finance reviews claims an employee or HR filed');
  }
  if (request.status !== MedicalRequestStatus.pending) {
    throw new HttpError(409, 'This request has already been reviewed');
  }
  if (status === MedicalRequestStatus.approved) {
    if (request.amount <= 0) {
      throw new HttpError(400, 'Approved claims must have an amount greater than zero');
    }
    await assertBenefitWithinBudget(request.user_id, request.kind, request.amount, request.id);
  }

  const updated = await prisma.medicalRequest.update({
    where: { id: request.id },
    data: {
      status,
      review_note: note,
      reviewed_by: actor.id,
      reviewed_at: new Date(),
    },
    include: requestInclude,
  });
  await notifyBenefitDecided({
    userId: updated.user_id,
    kind: updated.kind,
    amount: updated.amount,
    status,
    reviewNote: updated.review_note,
    ...(owner?.role === Role.finance ? { audience: 'finance' as const } : {}),
  });
  if (request.submitted_by && request.submitted_by !== updated.user_id) {
    const owner = await prisma.user.findUnique({
      where: { id: updated.user_id },
      select: { full_name: true },
    });
    await notifyBenefitFiler({
      userId: request.submitted_by,
      employeeName: owner?.full_name ?? 'Employee',
      kind: updated.kind,
      amount: updated.amount,
      status: status === MedicalRequestStatus.approved ? 'approved' : 'rejected',
      reviewNote: updated.review_note,
    });
  }
  return updated;
}
