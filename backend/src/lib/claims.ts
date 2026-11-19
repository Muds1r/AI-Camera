import { BenefitKind, MedicalRequestStatus } from '@prisma/client';
import { prisma } from './prisma';
import { HttpError } from './http';

export const CLAIM_AMOUNT_MAX = 10_000_000;

export function parseClaimAmount(value: unknown): number {
  const amount = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new HttpError(400, 'Amount must be greater than zero');
  }
  if (amount > CLAIM_AMOUNT_MAX) {
    throw new HttpError(400, 'Amount must be at most 10,000,000');
  }
  return amount;
}

export function parseOvertimeHours(value: unknown): number {
  const hours = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(hours) || hours < 0.5 || hours > 12) {
    throw new HttpError(400, 'Overtime hours must be between 0.5 and 12');
  }
  return hours;
}

export async function assertBenefitWithinBudget(
  userId: string,
  kind: BenefitKind,
  amount: number,
  excludeRequestId?: string,
): Promise<void> {
  const owner = await prisma.user.findUnique({ where: { id: userId } });
  if (!owner) throw new HttpError(404, 'Employee not found');
  const limit = kind === BenefitKind.opd ? owner.opd_limit : owner.medical_limit;
  const [approved, pending] = await Promise.all([
    prisma.medicalRequest.aggregate({
      where: { user_id: userId, kind, status: MedicalRequestStatus.approved },
      _sum: { amount: true },
    }),
    prisma.medicalRequest.aggregate({
      where: {
        user_id: userId,
        kind,
        status: MedicalRequestStatus.pending,
        ...(excludeRequestId ? { id: { not: excludeRequestId } } : {}),
      },
      _sum: { amount: true },
    }),
  ]);
  const spent = approved._sum.amount ?? 0;
  const reserved = pending._sum.amount ?? 0;
  if (spent + reserved + amount > limit) {
    throw new HttpError(409, 'This amount exceeds the remaining balance');
  }
}

export async function pendingLeaveDays(
  userId: string,
  leaveTypeId: string,
  excludeRequestId?: string,
): Promise<number> {
  const result = await prisma.leaveRequest.aggregate({
    where: {
      user_id: userId,
      leave_type_id: leaveTypeId,
      status: MedicalRequestStatus.pending,
      ...(excludeRequestId ? { id: { not: excludeRequestId } } : {}),
    },
    _sum: { days: true },
  });
  return result._sum.days ?? 0;
}

export async function assertPaidLeaveWithinBalance(
  userId: string,
  leaveTypeId: string,
  days: number,
  excludeRequestId?: string,
): Promise<void> {
  if (days <= 0) throw new HttpError(400, 'The selected dates contain no working days');
  const balance = await prisma.leaveBalance.findUnique({
    where: { user_id_leave_type_id: { user_id: userId, leave_type_id: leaveTypeId } },
  });
  if (!balance) throw new HttpError(404, 'Leave type not found');
  const pending = await pendingLeaveDays(userId, leaveTypeId, excludeRequestId);
  const available = balance.allocated - balance.used - pending;
  if (available < days) {
    throw new HttpError(409, 'Not enough leave balance');
  }
}
