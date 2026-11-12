import { NotificationKind, Role } from '@prisma/client';
import { HttpError } from './http';
import { prisma } from './prisma';

type Decision = 'approved' | 'rejected';

export type Notice = {
  kind: NotificationKind;
  title: string;
  body: string;
  href: string;
};

function clip(text: string, max = 160): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (clean.length <= max) return clean;
  return `${clean.slice(0, max - 1)}…`;
}

function money(amount: number): string {
  return `PKR ${amount.toLocaleString('en-US')}`;
}

function daysLabel(days: number): string {
  return `${days} ${days === 1 ? 'day' : 'days'}`;
}

function benefitLabel(kind: string): string {
  return kind === 'opd' ? 'OPD' : 'Medical';
}

function decisionKind(status: Decision): NotificationKind {
  return status === 'approved'
    ? NotificationKind.request_approved
    : NotificationKind.request_rejected;
}

function withNote(sentence: string, note: string | null): string {
  if (!note?.trim()) return sentence;
  return `${sentence} ${clip(note)}`;
}

async function writeFor(userIds: string[], notice: Notice): Promise<void> {
  const unique = [...new Set(userIds)];
  if (unique.length === 0) return;
  await prisma.notification.createMany({
    data: unique.map((user_id) => ({
      user_id,
      kind: notice.kind,
      title: clip(notice.title, 120),
      body: clip(notice.body, 500),
      href: notice.href,
    })),
  });
}

async function safely(work: () => Promise<void>): Promise<void> {
  try {
    await work();
  } catch (err) {
    console.error('Could not save notification', err);
  }
}

/** Active accounts of one role, excluding the person who just acted. Super Admin is used only when nobody in that role can review. */
async function notifyRole(role: Role, excludeUserId: string, notice: Notice): Promise<void> {
  await safely(async () => {
    const people = await prisma.user.findMany({
      where: { role, is_active: true, id: { not: excludeUserId } },
      select: { id: true },
    });
    const recipients =
      people.length > 0
        ? people
        : await prisma.user.findMany({
            where: { role: Role.super_admin, is_active: true, id: { not: excludeUserId } },
            select: { id: true },
          });
    await writeFor(
      recipients.map((user) => user.id),
      notice,
    );
  });
}

/** Active HR accounts, excluding the person who just acted. */
export async function notifyReviewers(excludeUserId: string, notice: Notice): Promise<void> {
  await notifyRole(Role.hr, excludeUserId, notice);
}

export async function notifyUser(userId: string, notice: Notice): Promise<void> {
  await safely(() => writeFor([userId], notice));
}

export function notifyBenefitSubmitted(input: {
  actorId: string;
  requesterName: string;
  kind: string;
  amount: number;
  reason: string;
}): Promise<void> {
  const label = benefitLabel(input.kind);
  return notifyRole(Role.finance, input.actorId, {
    kind: NotificationKind.request_submitted,
    title: `New ${label} request`,
    body: `${input.requesterName} requested ${money(input.amount)}. ${clip(input.reason, 120)}`,
    href: input.kind === 'opd' ? '/finance/claims?tab=opd' : '/finance/claims?tab=medical',
  });
}

export function notifyBenefitOnBehalf(input: {
  actorId: string;
  filerName: string;
  employeeId: string;
  employeeName: string;
  kind: string;
  amount: number;
  reason: string;
}): Promise<void> {
  const label = benefitLabel(input.kind);
  const href =
    input.kind === 'opd'
      ? '/requests?tab=benefits&kind=opd'
      : '/requests?tab=benefits&kind=medical';
  return Promise.all([
    notifyReviewers(input.actorId, {
      kind: NotificationKind.request_submitted,
      title: `${label} claim filed for ${input.employeeName}`,
      body: `${input.filerName} filed ${money(input.amount)} for ${input.employeeName}. ${clip(input.reason, 120)}`,
      href: input.kind === 'opd' ? '/hr/requests?tab=opd' : '/hr/requests?tab=medical',
    }),
    notifyUser(input.employeeId, {
      kind: NotificationKind.request_submitted,
      title: `${label} claim filed for you`,
      body: `${input.filerName} filed a ${label} claim for ${money(input.amount)}. HR will review it.`,
      href,
    }),
  ]).then(() => undefined);
}

export function notifyBenefitFiler(input: {
  userId: string;
  employeeName: string;
  kind: string;
  amount: number;
  status: Decision;
  reviewNote: string | null;
}): Promise<void> {
  const label = benefitLabel(input.kind);
  const decision = input.status === 'approved' ? 'approved' : 'rejected';
  return notifyUser(input.userId, {
    kind: decisionKind(input.status),
    title: `Claim you filed was ${decision}`,
    body: withNote(
      `${input.employeeName}'s ${label} claim for ${money(input.amount)} was ${decision}.`,
      input.reviewNote,
    ),
    href: input.kind === 'opd' ? '/finance/claims?tab=opd' : '/finance/claims?tab=medical',
  });
}

export function notifyBenefitDecided(input: {
  userId: string;
  kind: string;
  amount: number;
  status: Decision;
  reviewNote: string | null;
}): Promise<void> {
  const label = benefitLabel(input.kind);
  const decision = input.status === 'approved' ? 'approved' : 'rejected';
  return notifyUser(input.userId, {
    kind: decisionKind(input.status),
    title: `${label} request ${decision}`,
    body: withNote(
      `Your ${label} request for ${money(input.amount)} was ${decision}.`,
      input.reviewNote,
    ),
    href:
      input.kind === 'opd'
        ? '/requests?tab=benefits&kind=opd'
        : '/requests?tab=benefits&kind=medical',
  });
}

export function notifyLeaveSubmitted(input: {
  actorId: string;
  requesterName: string;
  leaveName: string;
  days: number;
  reason: string;
}): Promise<void> {
  return notifyReviewers(input.actorId, {
    kind: NotificationKind.request_submitted,
    title: 'New leave request',
    body: `${input.requesterName} requested ${daysLabel(input.days)} of ${input.leaveName}. ${clip(input.reason, 120)}`,
    href: '/hr/requests?tab=leave',
  });
}

export function notifyLeaveDecided(input: {
  userId: string;
  leaveName: string;
  days: number;
  status: Decision;
  reviewNote: string | null;
}): Promise<void> {
  const decision = input.status === 'approved' ? 'approved' : 'rejected';
  return notifyUser(input.userId, {
    kind: decisionKind(input.status),
    title: `Leave request ${decision}`,
    body: withNote(
      `Your ${input.leaveName} request for ${daysLabel(input.days)} was ${decision}.`,
      input.reviewNote,
    ),
    href: '/requests?tab=leave',
  });
}

export function notifyAttendanceSubmitted(input: {
  actorId: string;
  requesterName: string;
  workDate: string;
  status: string;
  reason: string;
}): Promise<void> {
  return notifyReviewers(input.actorId, {
    kind: NotificationKind.request_submitted,
    title: 'Attendance correction',
    body: `${input.requesterName} asked to mark ${input.workDate} as ${input.status.replace(/_/g, ' ')}. ${clip(input.reason, 120)}`,
    href: '/hr/requests?tab=attendance',
  });
}

export function notifyAttendanceDecided(input: {
  userId: string;
  workDate: string;
  status: Decision;
  reviewNote: string | null;
}): Promise<void> {
  const decision = input.status === 'approved' ? 'approved' : 'rejected';
  return notifyUser(input.userId, {
    kind: decisionKind(input.status),
    title: `Attendance correction ${decision}`,
    body: withNote(`Your correction for ${input.workDate} was ${decision}.`, input.reviewNote),
    href: '/attendance',
  });
}

export function notifyOvertimeSubmitted(input: {
  actorId: string;
  requesterName: string;
  hours: number;
  workDate: string;
  reason: string;
}): Promise<void> {
  return notifyReviewers(input.actorId, {
    kind: NotificationKind.request_submitted,
    title: 'New overtime request',
    body: `${input.requesterName} requested ${input.hours} overtime hours on ${input.workDate}. ${clip(input.reason, 120)}`,
    href: '/hr/requests?tab=overtime',
  });
}

export function notifyOvertimeDecided(input: {
  userId: string;
  hours: number;
  workDate: string;
  status: Decision;
  reviewNote: string | null;
}): Promise<void> {
  const decision = input.status === 'approved' ? 'approved' : 'rejected';
  return notifyUser(input.userId, {
    kind: decisionKind(input.status),
    title: `Overtime request ${decision}`,
    body: withNote(
      `Your overtime request for ${input.hours} hours on ${input.workDate} was ${decision}.`,
      input.reviewNote,
    ),
    href: '/requests?tab=overtime',
  });
}

export function notifyProfileSubmitted(input: {
  actorId: string;
  requesterName: string;
}): Promise<void> {
  return notifyReviewers(input.actorId, {
    kind: NotificationKind.request_submitted,
    title: 'Profile update request',
    body: `${input.requesterName} asked to update their profile.`,
    href: '/hr/requests?tab=profile',
  });
}

export function notifyProfileDecided(input: {
  userId: string;
  status: Decision;
  reviewNote: string | null;
}): Promise<void> {
  const decision = input.status === 'approved' ? 'approved' : 'rejected';
  return notifyUser(input.userId, {
    kind: decisionKind(input.status),
    title: `Profile update ${decision}`,
    body: withNote(`Your profile update was ${decision}.`, input.reviewNote),
    href: '/profile',
  });
}

export async function listNotifications(userId: string) {
  const [notifications, unread] = await Promise.all([
    prisma.notification.findMany({
      where: { user_id: userId },
      orderBy: { created_at: 'desc' },
      take: 40,
    }),
    prisma.notification.count({ where: { user_id: userId, is_read: false } }),
  ]);
  return { notifications, unread };
}

export async function markNotificationRead(userId: string, id: string): Promise<void> {
  const result = await prisma.notification.updateMany({
    where: { id, user_id: userId, is_read: false },
    data: { is_read: true },
  });
  if (result.count > 0) return;
  const existing = await prisma.notification.findFirst({
    where: { id, user_id: userId },
    select: { id: true },
  });
  if (!existing) throw new HttpError(404, 'Notification not found');
}

export async function markAllNotificationsRead(userId: string): Promise<void> {
  await prisma.notification.updateMany({
    where: { user_id: userId, is_read: false },
    data: { is_read: true },
  });
}
