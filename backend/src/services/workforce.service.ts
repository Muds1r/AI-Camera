import { BenefitKind, HolidayKind, MedicalRequestStatus, Prisma, Role } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { HttpError } from '../lib/http';
import { writeAudit } from '../lib/audit';
import { AuthUser } from '../lib/auth/session';
import { roleHasPermission, Permission } from '../lib/auth/permissions';
import { publicUserSelect } from '../lib/auth/users';

const COMPANY_ID = 'default';

function utcDate(value = new Date()): Date {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
}

function parseMonth(value: unknown): { year: number; month: number } {
  const text = typeof value === 'string' && /^\d{4}-\d{2}$/.test(value) ? value : '';
  const now = new Date();
  const year = text ? Number(text.slice(0, 4)) : now.getUTCFullYear();
  const month = text ? Number(text.slice(5, 7)) : now.getUTCMonth() + 1;
  if (month < 1 || month > 12) throw new HttpError(400, 'Month must be YYYY-MM');
  return { year, month };
}

async function companySettings() {
  return prisma.company.upsert({
    where: { id: COMPANY_ID },
    update: {},
    create: { id: COMPANY_ID, name: 'TruckFlow' },
  });
}

function weekendSet(days: string): Set<number> {
  return new Set(
    days
      .split(',')
      .map((part) => Number(part.trim()))
      .filter((day) => day >= 0 && day <= 6),
  );
}

function eachDate(year: number, month: number): Date[] {
  const count = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return Array.from(
    { length: count },
    (_, index) => new Date(Date.UTC(year, month - 1, index + 1)),
  );
}

function daysBetween(start: Date, end: Date, weekends: Set<number>, holidays: Set<string>): number {
  let days = 0;
  for (let cursor = start.getTime(); cursor <= end.getTime(); cursor += 86400000) {
    const date = new Date(cursor);
    const key = date.toISOString().slice(0, 10);
    if (weekends.has(date.getUTCDay()) || holidays.has(key)) continue;
    days += 1;
  }
  return days;
}

export async function ensureLeaveBalances(userId: string) {
  const types = await prisma.leaveType.findMany({ where: { is_active: true } });
  for (const type of types) {
    await prisma.leaveBalance.upsert({
      where: { user_id_leave_type_id: { user_id: userId, leave_type_id: type.id } },
      update: {},
      create: { user_id: userId, leave_type_id: type.id, allocated: type.default_days },
    });
  }
}

async function monthContext(year: number, month: number) {
  const company = await companySettings();
  const weekends = weekendSet(company.weekend_days);
  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 0));
  const holidays = await prisma.holiday.findMany({
    where: { holiday_on: { gte: start, lte: end } },
  });
  const holidayKeys = new Set(
    holidays.map((holiday) => holiday.holiday_on.toISOString().slice(0, 10)),
  );
  const dates = eachDate(year, month);
  const sundays = dates.filter((date) => date.getUTCDay() === 0).length;
  const gazetted = holidays.filter((holiday) => holiday.kind === HolidayKind.gazetted).length;
  const generalOff = holidays.filter((holiday) => holiday.kind === HolidayKind.general_off).length;
  const workingDays = dates.filter(
    (date) => !weekends.has(date.getUTCDay()) && !holidayKeys.has(date.toISOString().slice(0, 10)),
  ).length;
  return {
    company,
    weekends,
    start,
    end,
    holidays,
    holidayKeys,
    dates,
    sundays,
    gazetted,
    generalOff,
    workingDays,
  };
}

function lateStatus(clockIn: Date, workStart: string) {
  const [hours, minutes] = workStart.split(':').map(Number);
  const startMinutes = (hours || 0) * 60 + (minutes || 0);
  const clockMinutes = clockIn.getUTCHours() * 60 + clockIn.getUTCMinutes();
  return clockMinutes > startMinutes ? 'late' : 'present';
}

export async function clockIn(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user?.clock_enabled) throw new HttpError(403, 'Clock in is not enabled for this account');
  const today = utcDate();
  const existing = await prisma.attendance.findUnique({
    where: { user_id_work_date: { user_id: userId, work_date: today } },
  });
  if (existing?.clock_in) throw new HttpError(409, 'You have already clocked in today');
  const company = await companySettings();
  const now = new Date();
  const status = lateStatus(now, company.work_start);
  const record = await prisma.attendance.upsert({
    where: { user_id_work_date: { user_id: userId, work_date: today } },
    update: { clock_in: now, status },
    create: { user_id: userId, work_date: today, clock_in: now, status },
  });
  await writeAudit(userId, 'attendance.clock_in', 'attendance', record.id, status);
  return record;
}

export async function clockOut(userId: string) {
  const today = utcDate();
  const existing = await prisma.attendance.findUnique({
    where: { user_id_work_date: { user_id: userId, work_date: today } },
  });
  if (!existing?.clock_in) throw new HttpError(400, 'Clock in before clocking out');
  if (existing.clock_out) throw new HttpError(409, 'You have already clocked out today');
  const record = await prisma.attendance.update({
    where: { id: existing.id },
    data: { clock_out: new Date() },
  });
  await writeAudit(userId, 'attendance.clock_out', 'attendance', record.id);
  return record;
}

export async function ownAttendance(userId: string, monthValue: unknown) {
  const parsed = parseMonth(monthValue);
  const context = await monthContext(parsed.year, parsed.month);
  const { start, end, sundays, gazetted, generalOff, workingDays } = context;
  const records = await prisma.attendance.findMany({
    where: { user_id: userId, work_date: { gte: context.start, lte: context.end } },
    orderBy: { work_date: 'asc' },
  });
  const present = records.filter((record) => record.status === 'present').length;
  const late = records.filter((record) => record.status === 'late').length;
  const today = utcDate();
  const todayRecord = records.find((record) => record.work_date.getTime() === today.getTime());
  const elapsedWorking = context.dates.filter(
    (date) =>
      date <= today &&
      !context.weekends.has(date.getUTCDay()) &&
      !context.holidayKeys.has(date.toISOString().slice(0, 10)),
  ).length;
  const absent = Math.max(0, elapsedWorking - present - late);
  return {
    month: `${parsed.year}-${String(parsed.month).padStart(2, '0')}`,
    summary: {
      workingDays: context.workingDays,
      sundays: context.sundays,
      gazetted: context.gazetted,
      generalOff: context.generalOff,
      present,
      late,
      absent,
      records: records.length,
    },
    today: todayRecord ?? null,
    records,
    range: {
      start,
      end,
      sundays,
      gazetted,
      generalOff,
      workingDays,
      year: parsed.year,
      month: parsed.month,
    },
  };
}

export async function allAttendance(monthValue: unknown, query: string | undefined) {
  const parsed = parseMonth(monthValue);
  const context = await monthContext(parsed.year, parsed.month);
  const records = await prisma.attendance.findMany({
    where: {
      work_date: { gte: context.start, lte: context.end },
      ...(query
        ? {
            user: {
              OR: [
                { full_name: { contains: query, mode: 'insensitive' } },
                { email: { contains: query, mode: 'insensitive' } },
              ],
            },
          }
        : {}),
    },
    include: {
      user: { select: { id: true, full_name: true, email: true, department: true, role: true } },
    },
    orderBy: { work_date: 'desc' },
  });
  const open = records.filter(
    (record) =>
      record.clock_in && !record.clock_out && record.work_date.getTime() === utcDate().getTime(),
  );
  return {
    month: `${parsed.year}-${String(parsed.month).padStart(2, '0')}`,
    records,
    clockedIn: open,
    summary: context,
  };
}

export async function saveHoliday(
  actorId: string,
  input: { date?: unknown; name?: unknown; kind?: unknown },
) {
  if (typeof input.date !== 'string' || typeof input.name !== 'string') {
    throw new HttpError(400, 'Date and name are required');
  }
  if (input.kind !== HolidayKind.gazetted && input.kind !== HolidayKind.general_off) {
    throw new HttpError(400, 'Kind must be gazetted or general_off');
  }
  const holiday = await prisma.holiday.upsert({
    where: { holiday_on: utcDate(new Date(input.date)) },
    update: { name: input.name.trim(), kind: input.kind },
    create: {
      holiday_on: utcDate(new Date(input.date)),
      name: input.name.trim(),
      kind: input.kind,
    },
  });
  await writeAudit(actorId, 'holiday.save', 'holiday', holiday.id, holiday.name);
  return holiday;
}

export async function listHolidays() {
  return prisma.holiday.findMany({ orderBy: { holiday_on: 'asc' } });
}

export async function deleteHoliday(actorId: string, id: string) {
  await prisma.holiday.delete({ where: { id } });
  await writeAudit(actorId, 'holiday.delete', 'holiday', id);
}

const benefitInclude = {
  requester: { select: { id: true, full_name: true, email: true, role: true } },
  reviewer: { select: { id: true, full_name: true } },
} as const;

const DOCUMENT_PATH = /^\/api\/uploads\/documents\/[0-9a-f-]{36}\.(jpg|png|webp|pdf)$/i;

function requestFilters(status: unknown, q: unknown, from: unknown, to: unknown) {
  const created_at: Prisma.DateTimeFilter = {};
  if (typeof from === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(from)) {
    created_at.gte = new Date(`${from}T00:00:00.000Z`);
  }
  if (typeof to === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(to)) {
    created_at.lte = new Date(`${to}T23:59:59.999Z`);
  }
  const note = typeof q === 'string' ? q.trim() : '';
  const statusFilter =
    status === MedicalRequestStatus.pending ||
    status === MedicalRequestStatus.approved ||
    status === MedicalRequestStatus.rejected
      ? status
      : undefined;
  return {
    ...(statusFilter ? { status: statusFilter } : {}),
    ...(Object.keys(created_at).length ? { created_at } : {}),
    ...(note ? { requester: { full_name: { contains: note, mode: 'insensitive' as const } } } : {}),
  };
}

function rejectionNote(status: unknown, reviewNote: unknown): string | null {
  if (status === MedicalRequestStatus.rejected) {
    if (typeof reviewNote !== 'string' || reviewNote.trim().length < 3) {
      throw new HttpError(400, 'A rejection reason of at least 3 characters is required');
    }
    return reviewNote.trim();
  }
  return typeof reviewNote === 'string' && reviewNote.trim() ? reviewNote.trim() : null;
}

export async function submitBenefit(
  userId: string,
  input: { kind?: unknown; amount?: unknown; reason?: unknown; document_url?: unknown },
) {
  if (input.kind !== BenefitKind.medical && input.kind !== BenefitKind.opd) {
    throw new HttpError(400, 'Kind must be medical or opd');
  }
  const amount = Number(input.amount);
  if (!Number.isFinite(amount) || amount <= 0)
    throw new HttpError(400, 'Amount must be greater than zero');
  if (typeof input.reason !== 'string' || input.reason.trim().length < 3) {
    throw new HttpError(400, 'A reason of at least 3 characters is required');
  }
  let documentUrl: string | null = null;
  if (
    input.document_url !== undefined &&
    input.document_url !== null &&
    input.document_url !== ''
  ) {
    if (typeof input.document_url !== 'string' || !DOCUMENT_PATH.test(input.document_url)) {
      throw new HttpError(400, 'Supporting document is invalid');
    }
    documentUrl = input.document_url;
  }
  const request = await prisma.medicalRequest.create({
    data: {
      user_id: userId,
      kind: input.kind,
      amount,
      reason: input.reason.trim(),
      document_url: documentUrl,
    },
    include: benefitInclude,
  });
  await writeAudit(userId, 'benefit.submit', 'medical_request', request.id, input.kind);
  return request;
}

export async function listBenefits(
  actor: AuthUser,
  scope: unknown,
  kind: unknown,
  filters: { status?: unknown; q?: unknown; from?: unknown; to?: unknown } = {},
) {
  const queue = scope === 'queue';
  if (queue && !roleHasPermission(actor.role, Permission.MedicalReview)) {
    throw new HttpError(403, 'Forbidden');
  }
  return prisma.medicalRequest.findMany({
    where: {
      ...(queue ? {} : { user_id: actor.id }),
      ...(kind === BenefitKind.medical || kind === BenefitKind.opd ? { kind } : {}),
      ...requestFilters(filters.status, filters.q, filters.from, filters.to),
    },
    include: benefitInclude,
    orderBy: { created_at: 'desc' },
    take: 100,
  });
}

export async function reviewBenefit(
  actor: AuthUser,
  id: string,
  status: unknown,
  reviewNote: unknown,
) {
  if (status !== MedicalRequestStatus.approved && status !== MedicalRequestStatus.rejected) {
    throw new HttpError(400, 'Status must be approved or rejected');
  }
  const request = await prisma.medicalRequest.findUnique({ where: { id } });
  if (!request) throw new HttpError(404, 'Request not found');
  if (request.user_id === actor.id) throw new HttpError(403, 'You cannot review your own request');
  if (request.status !== MedicalRequestStatus.pending)
    throw new HttpError(409, 'This request has already been reviewed');
  const owner = await prisma.user.findUnique({ where: { id: request.user_id } });
  if (!owner) throw new HttpError(404, 'Employee not found');
  if (status === MedicalRequestStatus.approved) {
    const approved = await prisma.medicalRequest.aggregate({
      where: { user_id: owner.id, kind: request.kind, status: MedicalRequestStatus.approved },
      _sum: { amount: true },
    });
    const spent = approved._sum.amount ?? 0;
    const limit = request.kind === BenefitKind.opd ? owner.opd_limit : owner.medical_limit;
    if (spent + request.amount > limit)
      throw new HttpError(409, 'This amount exceeds the remaining balance');
  }
  const updated = await prisma.medicalRequest.update({
    where: { id },
    data: {
      status,
      review_note: rejectionNote(status, reviewNote),
      reviewed_by: actor.id,
      reviewed_at: new Date(),
    },
    include: benefitInclude,
  });
  await writeAudit(actor.id, `benefit.${status}`, 'medical_request', id);
  return updated;
}

export async function benefitBalances(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new HttpError(404, 'User not found');
  const sums = await prisma.medicalRequest.groupBy({
    by: ['kind'],
    where: { user_id: userId, status: MedicalRequestStatus.approved },
    _sum: { amount: true },
  });
  const used = Object.fromEntries(sums.map((row) => [row.kind, row._sum.amount ?? 0]));
  return {
    medical: {
      limit: user.medical_limit,
      used: used.medical ?? 0,
      remaining: user.medical_limit - (used.medical ?? 0),
    },
    opd: {
      limit: user.opd_limit,
      used: used.opd ?? 0,
      remaining: user.opd_limit - (used.opd ?? 0),
    },
  };
}

export async function leaveBalances(userId: string) {
  await ensureLeaveBalances(userId);
  return prisma.leaveBalance.findMany({
    where: { user_id: userId },
    include: { leave_type: true },
    orderBy: { leave_type: { name: 'asc' } },
  });
}

export async function submitLeave(
  userId: string,
  input: { leave_type_id?: unknown; start_date?: unknown; end_date?: unknown; reason?: unknown },
) {
  if (
    typeof input.leave_type_id !== 'string' ||
    typeof input.start_date !== 'string' ||
    typeof input.end_date !== 'string'
  ) {
    throw new HttpError(400, 'Leave type and dates are required');
  }
  if (typeof input.reason !== 'string' || input.reason.trim().length < 3) {
    throw new HttpError(400, 'A reason of at least 3 characters is required');
  }
  const start = utcDate(new Date(input.start_date));
  const end = utcDate(new Date(input.end_date));
  if (end < start) throw new HttpError(400, 'End date cannot be before the start date');
  const company = await companySettings();
  const holidays = await prisma.holiday.findMany({
    where: { holiday_on: { gte: start, lte: end } },
  });
  const days = daysBetween(
    start,
    end,
    weekendSet(company.weekend_days),
    new Set(holidays.map((holiday) => holiday.holiday_on.toISOString().slice(0, 10))),
  );
  if (days <= 0) throw new HttpError(400, 'The selected dates contain no working days');
  await ensureLeaveBalances(userId);
  const balance = await prisma.leaveBalance.findUnique({
    where: { user_id_leave_type_id: { user_id: userId, leave_type_id: input.leave_type_id } },
  });
  if (!balance) throw new HttpError(404, 'Leave type not found');
  if (balance.allocated - balance.used < days) throw new HttpError(409, 'Not enough leave balance');
  const request = await prisma.leaveRequest.create({
    data: {
      user_id: userId,
      leave_type_id: input.leave_type_id,
      start_date: start,
      end_date: end,
      days,
      reason: input.reason.trim(),
    },
    include: {
      leave_type: true,
      requester: { select: { id: true, full_name: true, email: true } },
    },
  });
  await writeAudit(userId, 'leave.submit', 'leave_request', request.id);
  return request;
}

export async function listLeave(
  actor: AuthUser,
  scope: unknown,
  filters: { status?: unknown; q?: unknown; from?: unknown; to?: unknown } = {},
) {
  const queue = scope === 'queue';
  if (queue && !roleHasPermission(actor.role, Permission.LeaveReview))
    throw new HttpError(403, 'Forbidden');
  return prisma.leaveRequest.findMany({
    where: {
      ...(queue ? {} : { user_id: actor.id }),
      ...requestFilters(filters.status, filters.q, filters.from, filters.to),
    },
    include: {
      leave_type: true,
      requester: { select: { id: true, full_name: true, email: true } },
      reviewer: { select: { full_name: true } },
    },
    orderBy: { created_at: 'desc' },
    take: 100,
  });
}

export async function reviewLeave(
  actor: AuthUser,
  id: string,
  status: unknown,
  reviewNote: unknown,
) {
  if (status !== MedicalRequestStatus.approved && status !== MedicalRequestStatus.rejected) {
    throw new HttpError(400, 'Status must be approved or rejected');
  }
  const request = await prisma.leaveRequest.findUnique({ where: { id } });
  if (!request) throw new HttpError(404, 'Leave request not found');
  if (request.user_id === actor.id) throw new HttpError(403, 'You cannot review your own request');
  if (request.status !== MedicalRequestStatus.pending)
    throw new HttpError(409, 'This request has already been reviewed');
  const updated = await prisma.$transaction(async (tx) => {
    if (status === MedicalRequestStatus.approved) {
      const balance = await tx.leaveBalance.findUnique({
        where: {
          user_id_leave_type_id: { user_id: request.user_id, leave_type_id: request.leave_type_id },
        },
      });
      if (!balance || balance.allocated - balance.used < request.days) {
        throw new HttpError(409, 'Not enough leave balance');
      }
      await tx.leaveBalance.update({
        where: { id: balance.id },
        data: { used: { increment: request.days } },
      });
    }
    return tx.leaveRequest.update({
      where: { id },
      data: {
        status,
        review_note: rejectionNote(status, reviewNote),
        reviewed_by: actor.id,
        reviewed_at: new Date(),
      },
      include: { leave_type: true, requester: { select: { full_name: true, email: true } } },
    });
  });
  await writeAudit(actor.id, `leave.${status}`, 'leave_request', id);
  return updated;
}

const PROFILE_FIELDS = [
  'full_name',
  'phone',
  'address',
  'info',
  'department',
  'designation',
  'avatar_url',
] as const;

export async function submitProfileRequest(userId: string, changes: unknown) {
  if (!changes || typeof changes !== 'object' || Array.isArray(changes)) {
    throw new HttpError(400, 'Changes are required');
  }
  const source = changes as Record<string, unknown>;
  if ('email' in source || 'joined_on' in source || 'role' in source) {
    throw new HttpError(400, 'That detail cannot be changed from a profile request');
  }

  const pending = await prisma.profileUpdateRequest.findFirst({
    where: { user_id: userId, status: MedicalRequestStatus.pending },
    select: { id: true },
  });
  if (pending) {
    throw new HttpError(
      409,
      'You already have a profile update waiting for HR. Wait for it to be reviewed, or ask HR to reject it first.',
    );
  }

  const owner = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true },
  });
  if (!owner) throw new HttpError(404, 'User not found');

  const clean: Record<string, string | null> = {};

  if ('full_name' in source) {
    if (typeof source.full_name !== 'string') throw new HttpError(400, 'Full name is invalid');
    clean.full_name = assertPersonName(source.full_name, 'Full name');
  }
  if ('phone' in source) {
    clean.phone = requiredText(optionalPhone(source.phone) ?? null, 'Phone number');
  }
  if ('secondary_email' in source) {
    const secondaryEmail =
      source.secondary_email === null || source.secondary_email === ''
        ? null
        : typeof source.secondary_email === 'string'
          ? assertEmail(source.secondary_email)
          : (() => {
              throw new HttpError(400, 'Primary email is invalid');
            })();
    if (secondaryEmail && secondaryEmail === owner.email) {
      throw new HttpError(400, 'Primary email must be different from the company email');
    }
    clean.secondary_email = requiredText(secondaryEmail, 'Primary email');
  }
  if ('date_of_birth' in source) {
    const dateOfBirth = optionalDateOfBirth(source.date_of_birth);
    clean.date_of_birth = requiredText(
      dateOfBirth ? dateOfBirth.toISOString().slice(0, 10) : null,
      'Date of birth',
    );
  }
  if ('gender' in source) {
    clean.gender = requiredText(optionalChoice(source.gender, 'Gender', GENDERS) ?? null, 'Gender');
  }
  if ('id_card_number' in source) {
    clean.id_card_number = requiredText(
      optionalIdCard(source.id_card_number) ?? null,
      'ID card number',
    );
  }
  if ('address' in source) {
    clean.address = requiredText(optionalAddress(source.address) ?? null, 'Address');
  }
  if ('emergency_contact_name' in source) {
    clean.emergency_contact_name = requiredText(
      optionalPersonName(source.emergency_contact_name, 'Emergency contact') ?? null,
      'Emergency contact',
    );
  }
  if ('emergency_contact_phone' in source) {
    clean.emergency_contact_phone = requiredText(
      optionalPhone(source.emergency_contact_phone, 'Emergency phone') ?? null,
      'Emergency phone',
    );
  }
  if ('blood_group' in source) {
    clean.blood_group = optionalChoice(source.blood_group, 'Blood group', BLOOD_GROUPS) ?? null;
  }
  if ('department' in source) {
    clean.department = optionalLabel(source.department, 'Department') ?? null;
  }
  if ('designation' in source) {
    clean.designation = optionalLabel(source.designation, 'Designation') ?? null;
  }
  if ('info' in source) {
    clean.info = optionalNotes(source.info) ?? null;
  }
  if (source.avatar_url !== undefined && source.avatar_url !== null && source.avatar_url !== '') {
    if (typeof source.avatar_url !== 'string' || !AVATAR_PATH.test(source.avatar_url)) {
      throw new HttpError(400, 'Picture is invalid');
    }
    clean.avatar_url = source.avatar_url;
  }

  if (Object.keys(clean).length === 0) {
    throw new HttpError(400, 'No changes to submit');
  }

  const request = await prisma.profileUpdateRequest.create({
    data: { user_id: userId, changes: clean as Prisma.InputJsonValue },
  });
  await writeAudit(userId, 'profile.request', 'profile_update_request', request.id);
  return request;
}

export async function listProfileRequests(
  actor: AuthUser,
  scope: unknown,
  filters: { status?: unknown; q?: unknown; from?: unknown; to?: unknown } = {},
) {
  const queue = scope === 'queue';
  if (
    queue &&
    !roleHasPermission(actor.role, Permission.UsersManage) &&
    actor.role !== Role.super_admin
  ) {
    throw new HttpError(403, 'Forbidden');
  }
  return prisma.profileUpdateRequest.findMany({
    where: {
      ...(queue ? {} : { user_id: actor.id }),
      ...requestFilters(filters.status, filters.q, filters.from, filters.to),
    },
    include: {
      requester: { select: { id: true, full_name: true, email: true, role: true } },
      reviewer: { select: { full_name: true } },
    },
    orderBy: { created_at: 'desc' },
    take: 100,
  });
}

export async function reviewProfileRequest(
  actor: AuthUser,
  id: string,
  status: unknown,
  reviewNote: unknown,
) {
  if (status !== MedicalRequestStatus.approved && status !== MedicalRequestStatus.rejected) {
    throw new HttpError(400, 'Status must be approved or rejected');
  }
  const request = await prisma.profileUpdateRequest.findUnique({ where: { id } });
  if (!request) throw new HttpError(404, 'Profile request not found');
  if (request.user_id === actor.id)
    throw new HttpError(403, 'You cannot review your own profile request');
  if (request.status !== MedicalRequestStatus.pending)
    throw new HttpError(409, 'This request has already been reviewed');
  const changes = request.changes as Record<string, string | null>;
  const updated = await prisma.$transaction(async (tx) => {
    if (status === MedicalRequestStatus.approved) {
      await tx.user.update({ where: { id: request.user_id }, data: changes });
    }
    return tx.profileUpdateRequest.update({
      where: { id },
      data: {
        status,
        review_note: rejectionNote(status, reviewNote),
        reviewed_by: actor.id,
        reviewed_at: new Date(),
      },
    });
  });
  await writeAudit(actor.id, `profile.${status}`, 'profile_update_request', id);
  return updated;
}

export async function updateEmployment(
  actor: AuthUser,
  userId: string,
  input: Record<string, unknown>,
) {
  const target = await prisma.user.findUnique({ where: { id: userId } });
  if (!target) throw new HttpError(404, 'User not found');
  if (target.role === Role.super_admin) throw new HttpError(403, 'HR cannot manage a Super Admin');
  if (actor.role === Role.hr && target.role === Role.hr && actor.id !== target.id) {
    throw new HttpError(403, 'HR cannot manage another HR account');
  }
  if (
    actor.role === Role.hr &&
    target.role !== Role.employee &&
    target.role !== Role.dataview &&
    actor.id !== target.id
  ) {
    throw new HttpError(403, 'You can only manage Employee and DataView accounts');
  }
  const data: Prisma.UserUpdateInput = {};
  const text = (
    key: 'phone' | 'address' | 'department' | 'designation' | 'info',
    label: string,
    max: number,
  ) => {
    if (input[key] === undefined) return;
    if (input[key] === null || input[key] === '') data[key] = null;
    else if (typeof input[key] === 'string' && input[key].trim().length <= max)
      data[key] = input[key].trim();
    else throw new HttpError(400, `${label} is invalid`);
  };
  if (input.full_name !== undefined) {
    if (typeof input.full_name !== 'string') throw new HttpError(400, 'Name is invalid');
    data.full_name = assertPersonName(input.full_name, 'Full name');
  }
  assign('phone', optionalPhone(input.phone));
  if (input.email !== undefined) {
    if (actor.role !== Role.super_admin) {
      throw new HttpError(403, 'Only a Super Admin can change an email address');
    }
    if (typeof input.email !== 'string') throw new HttpError(400, 'Email is invalid');
    data.email = assertEmail(input.email);
  }
  const accountEmail = typeof data.email === 'string' ? data.email : target.email;
  if (input.secondary_email !== undefined) {
    if (input.secondary_email === null || input.secondary_email === '') {
      data.secondary_email = null;
    } else if (typeof input.secondary_email === 'string') {
      const secondaryEmail = assertEmail(input.secondary_email);
      if (secondaryEmail === accountEmail) {
        throw new HttpError(400, 'Primary email must be different from the company email');
      }
      data.secondary_email = secondaryEmail;
    } else {
      throw new HttpError(400, 'Primary email is invalid');
    }
    data.full_name = input.full_name.trim();
  }
  text('phone', 'Phone', 30);
  text('address', 'Address', 300);
  text('department', 'Department', 80);
  text('designation', 'Designation', 80);
  text('info', 'Info', 2000);
  for (const key of [
    'salary_basic',
    'salary_allowance',
    'salary_deduction',
    'medical_limit',
    'opd_limit',
  ] as const) {
    if (input[key] === undefined) continue;
    const parsed = Number(input[key]);
    if (!Number.isFinite(parsed) || parsed < 0)
      throw new HttpError(400, `${key} must be zero or greater`);
    data[key] = parsed;
  }
  if (input.clock_enabled !== undefined) data.clock_enabled = Boolean(input.clock_enabled);
  if (input.is_active !== undefined) data.is_active = Boolean(input.is_active);
  if (input.email !== undefined) {
    if (actor.role !== Role.super_admin) {
      throw new HttpError(403, 'Only a Super Admin can change an email address');
    }
    if (typeof input.email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email.trim())) {
      throw new HttpError(400, 'Email is invalid');
    }
    data.email = input.email.trim().toLowerCase();
  }
  const user = await prisma.user.update({ where: { id: userId }, data, select: publicUserSelect });
  if (input.is_active === false) {
    await prisma.refreshToken.updateMany({
      where: { user_id: userId, revoked_at: null },
      data: { revoked_at: new Date() },
    });
  }
  await ensureLeaveBalances(userId);
  if (input.leave_allocations && typeof input.leave_allocations === 'object') {
    for (const [code, allocated] of Object.entries(
      input.leave_allocations as Record<string, unknown>,
    )) {
      const type = await prisma.leaveType.findUnique({ where: { code } });
      const amount = Number(allocated);
      if (!type || !Number.isFinite(amount) || amount < 0) continue;
      await prisma.leaveBalance.update({
        where: { user_id_leave_type_id: { user_id: userId, leave_type_id: type.id } },
        data: { allocated: amount },
      });
    }
  }
  await writeAudit(actor.id, 'user.update', 'user', userId, target.email);
  return user;
}

export async function salaryView(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new HttpError(404, 'User not found');
  return {
    basic: user.salary_basic,
    allowance: user.salary_allowance,
    deduction: user.salary_deduction,
    net: user.salary_basic + user.salary_allowance - user.salary_deduction,
  };
}

export async function dashboardFor(actor: AuthUser) {
  const month = `${new Date().getUTCFullYear()}-${String(new Date().getUTCMonth() + 1).padStart(2, '0')}`;
  const company = await companySettings();
  const base = { role: actor.role, company: { name: company.name, logo_url: company.logo_url } };
  if (actor.role === Role.super_admin) {
    const [total, active, recent, logs] = await Promise.all([
      prisma.user.count({ where: { role: Role.hr } }),
      prisma.user.count({ where: { role: Role.hr, is_active: true } }),
      prisma.user.findMany({
        where: { role: Role.hr },
        orderBy: { created_at: 'desc' },
        take: 5,
        select: publicUserSelect,
      }),
      prisma.auditLog.findMany({
        orderBy: { created_at: 'desc' },
        take: 8,
        include: { actor: { select: { full_name: true, role: true } } },
      }),
    ]);
    return {
      ...base,
      admin: {
        totalHr: total,
        activeHr: active,
        inactiveHr: total - active,
        recentHr: recent,
        logs,
      },
    };
  }
  const own = await ownAttendance(actor.id, month);
  const balances = await benefitBalances(actor.id).catch(() => null);
  const leaves = actor.role === Role.dataview ? [] : await leaveBalances(actor.id);
  const salary = actor.role === Role.dataview ? null : await salaryView(actor.id);
  const recentMedical = await prisma.medicalRequest.findMany({
    where: { user_id: actor.id },
    orderBy: { created_at: 'desc' },
    take: 5,
  });
  const recentLeave = await prisma.leaveRequest.findMany({
    where: { user_id: actor.id },
    orderBy: { created_at: 'desc' },
    take: 5,
    include: { leave_type: true },
  });
  const personal = {
    attendance: own,
    benefits: balances,
    leaves,
    salary,
    recentMedical,
    recentLeave,
  };
  if (actor.role !== Role.hr) return { ...base, personal };
  const today = utcDate();
  const [employees, inactive, clockedIn, pendingMedical, pendingLeave, pendingProfile, todayRows] =
    await Promise.all([
      prisma.user.count({
        where: { role: { in: [Role.employee, Role.dataview] }, is_active: true },
      }),
      prisma.user.count({
        where: { role: { in: [Role.employee, Role.dataview] }, is_active: false },
      }),
      prisma.attendance.count({
        where: { work_date: today, clock_in: { not: null }, clock_out: null },
      }),
      prisma.medicalRequest.count({ where: { status: 'pending' } }),
      prisma.leaveRequest.count({ where: { status: 'pending' } }),
      prisma.profileUpdateRequest.count({ where: { status: 'pending' } }),
      prisma.attendance.groupBy({
        by: ['status'],
        where: { work_date: today },
        _count: { _all: true },
      }),
    ]);
  const todayCount = Object.fromEntries(todayRows.map((row) => [row.status, row._count._all]));
  const activity = await prisma.auditLog.findMany({
    orderBy: { created_at: 'desc' },
    take: 8,
    include: { actor: { select: { full_name: true } } },
  });
  return {
    ...base,
    personal,
    hr: {
      total: employees + inactive,
      employees,
      inactive,
      clockedIn,
      presentToday: todayCount.present ?? 0,
      lateToday: todayCount.late ?? 0,
      pendingMedical,
      pendingLeave,
      pendingProfile,
      activity,
    },
  };
}

export async function employmentProfile(actor: AuthUser, userId: string) {
  const target = await prisma.user.findUnique({ where: { id: userId }, select: publicUserSelect });
  if (!target) throw new HttpError(404, 'User not found');
  if (target.role === Role.super_admin && actor.role !== Role.super_admin) {
    throw new HttpError(403, 'You cannot view a Super Admin account');
  }
  if (actor.role === Role.hr && target.role !== Role.employee && target.role !== Role.dataview) {
    throw new HttpError(403, 'You can only view Employee and DataView accounts');
  }
  await ensureLeaveBalances(userId);
  const balances = await prisma.leaveBalance.findMany({
    where: { user_id: userId },
    include: { leave_type: true },
    orderBy: { leave_type: { name: 'asc' } },
  });
  return { user: target, balances };
}

export async function listPeople(
  actor: AuthUser,
  role: Role | undefined,
  query: string | undefined,
  page: number,
  active?: boolean,
) {
  const pageSize = 20;
  const staff =
    actor.role === Role.hr
      ? [Role.employee, Role.dataview]
      : [Role.employee, Role.dataview, Role.hr];
  if (role && actor.role === Role.hr && role !== Role.employee && role !== Role.dataview) {
    throw new HttpError(403, 'Forbidden');
  }
  const where: Prisma.UserWhereInput = {
    role: role ?? { in: staff },
    ...(active === undefined ? {} : { is_active: active }),
    ...(query
      ? {
          OR: [
            { full_name: { contains: query, mode: 'insensitive' } },
            { email: { contains: query, mode: 'insensitive' } },
            { department: { contains: query, mode: 'insensitive' } },
          ],
        }
      : {}),
  };
  const [total, users] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      select: publicUserSelect,
      orderBy: { full_name: 'asc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);
  return { users, total, page, pageSize };
}

export { companySettings };
