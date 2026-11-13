import {
  BenefitKind,
  HolidayKind,
  MedicalRequestStatus,
  Prisma,
  Role,
  AttendanceStatus,
} from '@prisma/client';
import { prisma } from '../lib/prisma';
import { HttpError } from '../lib/http';
import { writeAudit } from '../lib/audit';
import {
  notifyBenefitDecided,
  notifyBenefitFiler,
  notifyBenefitOnBehalf,
  notifyBenefitSubmitted,
  notifyLeaveDecided,
  notifyLeaveSubmitted,
  notifyOvertimeDecided,
  notifyOvertimeSubmitted,
  notifyAttendanceDecided,
  notifyAttendanceSubmitted,
  notifyProfileDecided,
  notifyProfileSubmitted,
} from '../lib/notifications';
import { AuthUser } from '../lib/auth/session';
import { roleHasPermission, Permission } from '../lib/auth/permissions';
import { assertEmail, assertPassword, publicUserSelect } from '../lib/auth/users';
import { hashPassword } from '../lib/auth/passwords';
import {
  BLOOD_GROUPS,
  GENDERS,
  assertPersonName,
  optionalAddress,
  optionalChoice,
  optionalDateOfBirth,
  optionalIdCard,
  optionalJoinedOn,
  optionalLabel,
  optionalNotes,
  optionalPersonName,
  optionalPhone,
} from '../lib/fields';

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
  const sundays = dates.filter((date) => weekends.has(date.getUTCDay())).length;
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

function parseClockTime(value: string): number {
  const [hours, minutes] = value.split(':').map(Number);
  return (hours || 0) * 60 + (minutes || 0);
}

/** Local wall-clock minutes (matches employee’s typical 9–5 window in their timezone). */
function minutesOfDay(date: Date): number {
  return date.getHours() * 60 + date.getMinutes();
}

function lateStatus(clockIn: Date, workStart: string, workEnd: string) {
  return isLate(clockIn, workStart, workEnd) ? 'late' : 'present';
}

function shiftWindow(
  shift: string,
  company: { work_start: string; work_end: string; night_start: string; night_end: string },
) {
  return shift === 'night'
    ? { start: company.night_start, end: company.night_end }
    : { start: company.work_start, end: company.work_end };
}

function assertClockInWindow(now: Date, workStart: string, workEnd: string) {
  const nowMinutes = minutesOfDay(now);
  const start = parseClockTime(workStart);
  const end = parseClockTime(workEnd);
  const inside =
    start <= end
      ? nowMinutes >= start && nowMinutes <= end
      : nowMinutes >= start || nowMinutes <= end;
  if (!inside) {
    throw new HttpError(400, `Clock in is only allowed between ${workStart} and ${workEnd}`);
  }
}

function isLate(clockIn: Date, workStart: string, workEnd: string) {
  const nowMinutes = minutesOfDay(clockIn);
  const start = parseClockTime(workStart);
  const end = parseClockTime(workEnd);
  if (start <= end) return nowMinutes > start;
  if (nowMinutes >= start) return nowMinutes > start;
  return end > 0;
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
  const window = shiftWindow(user.shift, company);
  const now = new Date();
  assertClockInWindow(now, window.start, window.end);
  const status = lateStatus(now, window.start, window.end);
  const record = await prisma.attendance.upsert({
    where: { user_id_work_date: { user_id: userId, work_date: today } },
    update: { clock_in: now, status },
    create: { user_id: userId, work_date: today, clock_in: now, status },
  });
  await writeAudit(userId, 'attendance.clock_in', 'attendance', record.id, status);
  return record;
}

export async function clockOut(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { shift: true },
  });
  const today = utcDate();
  let existing = await prisma.attendance.findUnique({
    where: { user_id_work_date: { user_id: userId, work_date: today } },
  });
  if (existing?.clock_out) throw new HttpError(409, 'You have already clocked out today');
  if (!existing?.clock_in && user?.shift === 'night') {
    const company = await companySettings();
    const overnight = minutesOfDay(new Date()) <= parseClockTime(company.night_end) + 120;
    if (overnight) {
      const yesterday = new Date(today.getTime() - 86_400_000);
      const previous = await prisma.attendance.findUnique({
        where: { user_id_work_date: { user_id: userId, work_date: yesterday } },
      });
      if (previous?.clock_in && !previous.clock_out) existing = previous;
    }
  }
  if (!existing?.clock_in) throw new HttpError(400, 'Clock in before clocking out');
  if (existing.clock_out) throw new HttpError(409, 'You have already clocked out today');
  const record = await prisma.attendance.update({
    where: { id: existing.id },
    data: { clock_out: new Date() },
  });
  await writeAudit(userId, 'attendance.clock_out', 'attendance', record.id);
  return record;
}

export async function submitAttendanceCorrection(
  userId: string,
  input: {
    work_date?: unknown;
    status?: unknown;
    clock_in?: unknown;
    clock_out?: unknown;
    reason?: unknown;
  },
) {
  if (typeof input.work_date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(input.work_date)) {
    throw new HttpError(400, 'The date to correct is required');
  }
  if (
    input.status !== AttendanceStatus.present &&
    input.status !== AttendanceStatus.late &&
    input.status !== AttendanceStatus.half_day &&
    input.status !== AttendanceStatus.absent
  ) {
    throw new HttpError(400, 'Status must be present, late, half_day, or absent');
  }
  if (
    typeof input.reason !== 'string' ||
    input.reason.trim().length < 3 ||
    input.reason.trim().length > 2000
  ) {
    throw new HttpError(400, 'A reason between 3 and 2000 characters is required');
  }
  const workDate = utcDate(new Date(`${input.work_date}T00:00:00.000Z`));
  const today = utcDate();
  if (workDate > today) throw new HttpError(400, 'You cannot correct a future day');
  const earliest = new Date(today.getTime() - 60 * 86_400_000);
  if (workDate < earliest) throw new HttpError(400, 'You can only correct the last 60 days');
  const person = await prisma.user.findUnique({
    where: { id: userId },
    select: { shift: true },
  });
  const clockIn = clockOnDate(input.work_date, input.clock_in);
  let clockOut = clockOnDate(input.work_date, input.clock_out);
  if (clockIn && clockOut && clockOut.getTime() <= clockIn.getTime()) {
    if (person?.shift === 'night') {
      clockOut = new Date(clockOut.getTime() + 86_400_000);
    } else {
      throw new HttpError(400, 'Clock out cannot be before clock in');
    }
  }
  const existing = await prisma.attendanceCorrection.findFirst({
    where: { user_id: userId, work_date: workDate, status: MedicalRequestStatus.pending },
  });
  if (existing) throw new HttpError(409, 'A correction for this date is already waiting for HR');
  const request = await prisma.attendanceCorrection.create({
    data: {
      user_id: userId,
      work_date: workDate,
      requested_status: input.status,
      clock_in: clockIn,
      clock_out: clockOut,
      reason: input.reason.trim(),
    },
    include: {
      requester: { select: { id: true, full_name: true, email: true } },
    },
  });
  await writeAudit(userId, 'attendance.correction.submit', 'attendance_correction', request.id);
  await notifyAttendanceSubmitted({
    actorId: userId,
    requesterName: request.requester.full_name,
    workDate: input.work_date,
    status: input.status,
    reason: request.reason,
  });
  return request;
}

function clockOnDate(day: string, value: unknown): Date | null {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string' || !/^\d{2}:\d{2}$/.test(value)) {
    throw new HttpError(400, 'Times must be HH:MM');
  }
  const stamp = new Date(`${day}T${value}:00`);
  if (Number.isNaN(stamp.getTime())) throw new HttpError(400, 'Times must be HH:MM');
  return stamp;
}

export async function listAttendanceCorrections(
  actor: AuthUser,
  scope: unknown,
  filters: { status?: unknown; q?: unknown; from?: unknown; to?: unknown } = {},
) {
  const queue = scope === 'queue';
  if (queue && !roleHasPermission(actor.role, Permission.AttendanceReadAll)) {
    throw new HttpError(403, 'Forbidden');
  }
  return prisma.attendanceCorrection.findMany({
    where: {
      ...(queue ? {} : { user_id: actor.id }),
      ...requestFilters(filters.status, filters.q, filters.from, filters.to),
    },
    include: {
      requester: { select: { id: true, full_name: true, email: true } },
      reviewer: { select: { full_name: true } },
    },
    orderBy: { created_at: 'desc' },
    take: 100,
  });
}

export async function reviewAttendanceCorrection(
  actor: AuthUser,
  id: string,
  status: unknown,
  reviewNote: unknown,
) {
  if (status !== MedicalRequestStatus.approved && status !== MedicalRequestStatus.rejected) {
    throw new HttpError(400, 'Status must be approved or rejected');
  }
  const request = await prisma.attendanceCorrection.findUnique({ where: { id } });
  if (!request) throw new HttpError(404, 'Attendance correction not found');
  if (request.user_id === actor.id) throw new HttpError(403, 'You cannot review your own request');
  if (request.status !== MedicalRequestStatus.pending) {
    throw new HttpError(409, 'This request has already been reviewed');
  }
  const updated = await prisma.$transaction(async (tx) => {
    if (status === MedicalRequestStatus.approved) {
      await tx.attendance.upsert({
        where: {
          user_id_work_date: { user_id: request.user_id, work_date: request.work_date },
        },
        create: {
          user_id: request.user_id,
          work_date: request.work_date,
          status: request.requested_status,
          clock_in: request.clock_in,
          clock_out: request.clock_out,
          note: request.reason,
        },
        update: {
          status: request.requested_status,
          ...(request.clock_in ? { clock_in: request.clock_in } : {}),
          ...(request.clock_out ? { clock_out: request.clock_out } : {}),
          note: request.reason,
        },
      });
    }
    return tx.attendanceCorrection.update({
      where: { id },
      data: {
        status,
        review_note: rejectionNote(status, reviewNote),
        reviewed_by: actor.id,
        reviewed_at: new Date(),
      },
      include: { requester: { select: { full_name: true } } },
    });
  });
  await writeAudit(actor.id, `attendance.correction.${status}`, 'attendance_correction', id);
  await notifyAttendanceDecided({
    userId: request.user_id,
    workDate: request.work_date.toISOString().slice(0, 10),
    status,
    reviewNote: updated.review_note,
  });
  return updated;
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
  const leaves = await prisma.leaveRequest.findMany({
    where: {
      user_id: userId,
      status: MedicalRequestStatus.approved,
      start_date: { lte: end },
      end_date: { gte: start },
    },
    include: { leave_type: true },
  });
  const worked = new Set(
    records
      .filter((record) => record.clock_in)
      .map((record) => record.work_date.toISOString().slice(0, 10)),
  );
  const seenLeave = new Set<string>();
  let paidLeave = 0;
  let unpaidLeave = 0;
  for (const leave of leaves) {
    for (
      let cursor = leave.start_date.getTime();
      cursor <= leave.end_date.getTime();
      cursor += 86_400_000
    ) {
      const date = new Date(cursor);
      const key = date.toISOString().slice(0, 10);
      if (date < start || date > end || date > today) continue;
      if (context.weekends.has(date.getUTCDay()) || context.holidayKeys.has(key)) continue;
      if (worked.has(key) || seenLeave.has(key)) continue;
      seenLeave.add(key);
      if (leave.leave_type.is_paid) paidLeave += 1;
      else unpaidLeave += 1;
    }
  }
  const absent = Math.max(0, elapsedWorking - present - late - paidLeave - unpaidLeave);
  return {
    month: `${parsed.year}-${String(parsed.month).padStart(2, '0')}`,
    summary: {
      workingDays: context.workingDays,
      sundays: context.sundays,
      gazetted: context.gazetted,
      generalOff: context.generalOff,
      present,
      late,
      paidLeave,
      unpaidLeave,
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
  submitter: { select: { id: true, full_name: true, role: true } },
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
  options?: { submittedBy?: string },
) {
  if (input.kind !== BenefitKind.medical && input.kind !== BenefitKind.opd) {
    throw new HttpError(400, 'Kind must be medical or opd');
  }
  const amount = Number(input.amount);
  if (!Number.isFinite(amount) || amount <= 0 || amount > 10_000_000) {
    throw new HttpError(400, 'Amount must be greater than zero and at most 10,000,000');
  }
  if (
    typeof input.reason !== 'string' ||
    input.reason.trim().length < 3 ||
    input.reason.trim().length > 2000
  ) {
    throw new HttpError(400, 'A reason between 3 and 2000 characters is required');
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
      submitted_by: options?.submittedBy ?? null,
    },
    include: benefitInclude,
  });
  await writeAudit(
    options?.submittedBy ?? userId,
    'benefit.submit',
    'medical_request',
    request.id,
    input.kind,
  );
  if (options?.submittedBy) {
    const filer = await prisma.user.findUnique({
      where: { id: options.submittedBy },
      select: { full_name: true },
    });
    await notifyBenefitOnBehalf({
      actorId: options.submittedBy,
      filerName: filer?.full_name ?? 'Finance',
      employeeId: userId,
      employeeName: request.requester.full_name,
      kind: request.kind,
      amount: request.amount,
      reason: request.reason,
    });
  } else {
    await notifyBenefitSubmitted({
      actorId: userId,
      requesterName: request.requester.full_name,
      kind: request.kind,
      amount: request.amount,
      reason: request.reason,
    });
  }
  return request;
}

export async function submitBenefitFor(
  actor: AuthUser,
  input: {
    user_id?: unknown;
    kind?: unknown;
    amount?: unknown;
    reason?: unknown;
    document_url?: unknown;
  },
) {
  if (!roleHasPermission(actor.role, Permission.MedicalSubmitFor)) {
    throw new HttpError(403, 'You cannot file a claim for someone else');
  }
  if (typeof input.user_id !== 'string') throw new HttpError(400, 'Choose the employee');
  const owner = await prisma.user.findUnique({ where: { id: input.user_id } });
  if (!owner) throw new HttpError(404, 'Employee not found');
  if (owner.id === actor.id) throw new HttpError(400, 'File your own claim from Requests');
  if (owner.role !== Role.employee && owner.role !== Role.dataview) {
    throw new HttpError(403, 'Claims can be filed for employees and data view accounts');
  }
  return submitBenefit(owner.id, input, { submittedBy: actor.id });
}

export async function listBenefits(
  actor: AuthUser,
  scope: unknown,
  kind: unknown,
  filters: { status?: unknown; q?: unknown; from?: unknown; to?: unknown; behalf?: unknown } = {},
) {
  const queue = scope === 'queue';
  const behalf = filters.behalf === '1' || filters.behalf === 'true';
  if (queue) {
    const canSelf = roleHasPermission(actor.role, Permission.MedicalReview);
    const canBehalf = roleHasPermission(actor.role, Permission.MedicalReviewOnBehalf);
    if (behalf && !canBehalf) throw new HttpError(403, 'Forbidden');
    if (!behalf && !canSelf) throw new HttpError(403, 'Forbidden');
  }
  return prisma.medicalRequest.findMany({
    where: {
      ...(queue ? { submitted_by: behalf ? { not: null } : null } : { user_id: actor.id }),
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
  const onBehalf = Boolean(request.submitted_by);
  if (onBehalf && !roleHasPermission(actor.role, Permission.MedicalReviewOnBehalf)) {
    throw new HttpError(403, 'HR reviews claims that finance filed for a worker');
  }
  if (!onBehalf && !roleHasPermission(actor.role, Permission.MedicalReview)) {
    throw new HttpError(403, 'Finance reviews claims an employee filed');
  }
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
  await notifyBenefitDecided({
    userId: updated.user_id,
    kind: updated.kind,
    amount: updated.amount,
    status,
    reviewNote: updated.review_note,
  });
  if (request.submitted_by && request.submitted_by !== updated.user_id) {
    await notifyBenefitFiler({
      userId: request.submitted_by,
      employeeName: updated.requester.full_name,
      kind: updated.kind,
      amount: updated.amount,
      status: status === MedicalRequestStatus.approved ? 'approved' : 'rejected',
      reviewNote: updated.review_note,
    });
  }
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

export async function updateLeaveDefaults(actor: AuthUser, defaults: Record<string, unknown>) {
  if (!roleHasPermission(actor.role, Permission.CompanyManage)) {
    throw new HttpError(403, 'You cannot change leave defaults');
  }
  const types = await prisma.leaveType.findMany({ where: { is_active: true } });
  let updated = false;
  for (const type of types) {
    if (defaults[type.code] === undefined) continue;
    const days = Number(defaults[type.code]);
    if (!Number.isFinite(days) || days < 0) {
      throw new HttpError(400, `${type.name} must be zero or greater`);
    }
    await prisma.leaveType.update({
      where: { id: type.id },
      data: { default_days: Math.floor(days) },
    });
    updated = true;
  }
  if (!updated) throw new HttpError(400, 'No leave defaults to update');
  await writeAudit(actor.id, 'leave.defaults', 'company', COMPANY_ID);
  return prisma.leaveType.findMany({ where: { is_active: true }, orderBy: { name: 'asc' } });
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
  if (
    typeof input.reason !== 'string' ||
    input.reason.trim().length < 3 ||
    input.reason.trim().length > 2000
  ) {
    throw new HttpError(400, 'A reason between 3 and 2000 characters is required');
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
  const leaveType = await prisma.leaveType.findUnique({ where: { id: input.leave_type_id } });
  if (!leaveType?.is_active) throw new HttpError(404, 'Leave type not found');
  if (leaveType.is_paid) {
    const balance = await prisma.leaveBalance.findUnique({
      where: { user_id_leave_type_id: { user_id: userId, leave_type_id: input.leave_type_id } },
    });
    if (!balance) throw new HttpError(404, 'Leave type not found');
    if (balance.allocated - balance.used < days)
      throw new HttpError(409, 'Not enough leave balance');
  }
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
  await notifyLeaveSubmitted({
    actorId: userId,
    requesterName: request.requester.full_name,
    leaveName: request.leave_type.name,
    days: request.days,
    reason: request.reason,
  });
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
      const leaveType = await tx.leaveType.findUnique({ where: { id: request.leave_type_id } });
      if (leaveType?.is_paid) {
        const balance = await tx.leaveBalance.findUnique({
          where: {
            user_id_leave_type_id: {
              user_id: request.user_id,
              leave_type_id: request.leave_type_id,
            },
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
  await notifyLeaveDecided({
    userId: updated.user_id,
    leaveName: updated.leave_type.name,
    days: updated.days,
    status,
    reviewNote: updated.review_note,
  });
  return updated;
}

const overtimeInclude = {
  requester: { select: { id: true, full_name: true, email: true } },
  reviewer: { select: { full_name: true } },
} as const;

export async function submitOvertime(
  userId: string,
  input: { work_date?: unknown; hours?: unknown; reason?: unknown },
) {
  if (typeof input.work_date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(input.work_date)) {
    throw new HttpError(400, 'Overtime date is required');
  }
  const hours = Number(input.hours);
  if (!Number.isFinite(hours) || hours < 0.5 || hours > 12) {
    throw new HttpError(400, 'Overtime hours must be between 0.5 and 12');
  }
  if (
    typeof input.reason !== 'string' ||
    input.reason.trim().length < 3 ||
    input.reason.trim().length > 2000
  ) {
    throw new HttpError(400, 'A reason between 3 and 2000 characters is required');
  }
  const workDate = utcDate(new Date(`${input.work_date}T00:00:00.000Z`));
  const today = utcDate();
  const earliest = new Date(today.getTime() - 90 * 86_400_000);
  const latest = new Date(today.getTime() + 14 * 86_400_000);
  if (workDate < earliest || workDate > latest) {
    throw new HttpError(400, 'Overtime date must be within the last 90 days or the next 14 days');
  }
  const existing = await prisma.overtimeRequest.findFirst({
    where: {
      user_id: userId,
      work_date: workDate,
      status: { in: [MedicalRequestStatus.pending, MedicalRequestStatus.approved] },
    },
  });
  if (existing) throw new HttpError(409, 'Overtime for this date is already requested');
  const request = await prisma.overtimeRequest.create({
    data: {
      user_id: userId,
      work_date: workDate,
      hours: Math.round(hours * 100) / 100,
      reason: input.reason.trim(),
    },
    include: overtimeInclude,
  });
  await writeAudit(userId, 'overtime.submit', 'overtime_request', request.id);
  await notifyOvertimeSubmitted({
    actorId: userId,
    requesterName: request.requester.full_name,
    hours: request.hours,
    workDate: input.work_date,
    reason: request.reason,
  });
  return request;
}

export async function listOvertime(
  actor: AuthUser,
  scope: unknown,
  filters: { status?: unknown; q?: unknown; from?: unknown; to?: unknown } = {},
) {
  const queue = scope === 'queue';
  if (queue && !roleHasPermission(actor.role, Permission.OvertimeReview)) {
    throw new HttpError(403, 'Forbidden');
  }
  return prisma.overtimeRequest.findMany({
    where: {
      ...(queue ? {} : { user_id: actor.id }),
      ...requestFilters(filters.status, filters.q, filters.from, filters.to),
    },
    include: overtimeInclude,
    orderBy: { created_at: 'desc' },
    take: 100,
  });
}

export async function reviewOvertime(
  actor: AuthUser,
  id: string,
  status: unknown,
  reviewNote: unknown,
) {
  if (status !== MedicalRequestStatus.approved && status !== MedicalRequestStatus.rejected) {
    throw new HttpError(400, 'Status must be approved or rejected');
  }
  const request = await prisma.overtimeRequest.findUnique({ where: { id } });
  if (!request) throw new HttpError(404, 'Overtime request not found');
  if (request.user_id === actor.id) throw new HttpError(403, 'You cannot review your own request');
  if (request.status !== MedicalRequestStatus.pending) {
    throw new HttpError(409, 'This request has already been reviewed');
  }
  const updated = await prisma.overtimeRequest.update({
    where: { id },
    data: {
      status,
      review_note: rejectionNote(status, reviewNote),
      reviewed_by: actor.id,
      reviewed_at: new Date(),
    },
    include: overtimeInclude,
  });
  await writeAudit(actor.id, `overtime.${status}`, 'overtime_request', id);
  await notifyOvertimeDecided({
    userId: updated.user_id,
    hours: updated.hours,
    workDate: updated.work_date.toISOString().slice(0, 10),
    status,
    reviewNote: updated.review_note,
  });
  return updated;
}

const AVATAR_PATH = /^\/api\/uploads\/avatars\/[0-9a-f-]{36}\.(jpg|png|webp)$/i;

function requiredText(value: string | null | undefined, label: string): string {
  if (!value) throw new HttpError(400, `${label} is required`);
  return value;
}

export async function submitProfileRequest(userId: string, changes: unknown) {
  if (!changes || typeof changes !== 'object' || Array.isArray(changes)) {
    throw new HttpError(400, 'Changes are required');
  }
  const source = changes as Record<string, unknown>;
  if ('email' in source || 'joined_on' in source || 'role' in source) {
    throw new HttpError(400, 'That detail cannot be changed from a profile request');
  }
  const owner = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true },
  });
  if (!owner) throw new HttpError(404, 'User not found');

  const fullName =
    typeof source.full_name === 'string' ? assertPersonName(source.full_name, 'Full name') : null;
  const phone = optionalPhone(source.phone);
  const secondaryEmail =
    source.secondary_email === undefined ||
    source.secondary_email === null ||
    source.secondary_email === ''
      ? null
      : typeof source.secondary_email === 'string'
        ? assertEmail(source.secondary_email)
        : (() => {
            throw new HttpError(400, 'Secondary email is invalid');
          })();
  if (secondaryEmail && secondaryEmail === owner.email) {
    throw new HttpError(400, 'Secondary email must be different from the account email');
  }
  const dateOfBirth = optionalDateOfBirth(source.date_of_birth);
  const clean: Record<string, string | null> = {
    full_name: requiredText(fullName, 'Full name'),
    phone: requiredText(phone, 'Phone number'),
    secondary_email: requiredText(secondaryEmail, 'Secondary email'),
    date_of_birth: requiredText(
      dateOfBirth ? dateOfBirth.toISOString().slice(0, 10) : null,
      'Date of birth',
    ),
    gender: requiredText(optionalChoice(source.gender, 'Gender', GENDERS), 'Gender'),
    id_card_number: requiredText(optionalIdCard(source.id_card_number), 'ID card number'),
    address: requiredText(optionalAddress(source.address), 'Address'),
    emergency_contact_name: requiredText(
      optionalPersonName(source.emergency_contact_name, 'Emergency contact'),
      'Emergency contact',
    ),
    emergency_contact_phone: requiredText(
      optionalPhone(source.emergency_contact_phone, 'Emergency phone'),
      'Emergency phone',
    ),
    blood_group: optionalChoice(source.blood_group, 'Blood group', BLOOD_GROUPS) ?? null,
    department: optionalLabel(source.department, 'Department') ?? null,
    designation: optionalLabel(source.designation, 'Designation') ?? null,
    info: optionalNotes(source.info) ?? null,
  };
  if (source.avatar_url !== undefined && source.avatar_url !== null && source.avatar_url !== '') {
    if (typeof source.avatar_url !== 'string' || !AVATAR_PATH.test(source.avatar_url)) {
      throw new HttpError(400, 'Picture is invalid');
    }
    clean.avatar_url = source.avatar_url;
  }
  const request = await prisma.profileUpdateRequest.create({
    data: { user_id: userId, changes: clean as Prisma.InputJsonValue },
    include: { requester: { select: { full_name: true } } },
  });
  await writeAudit(userId, 'profile.request', 'profile_update_request', request.id);
  await notifyProfileSubmitted({ actorId: userId, requesterName: request.requester.full_name });
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
      const { date_of_birth: birth, ...rest } = changes;
      await tx.user.update({
        where: { id: request.user_id },
        data: {
          ...rest,
          ...(birth !== undefined
            ? { date_of_birth: birth ? new Date(`${birth}T00:00:00.000Z`) : null }
            : {}),
        },
      });
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
  await notifyProfileDecided({
    userId: updated.user_id,
    status,
    reviewNote: updated.review_note,
  });
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
  const assign = <K extends keyof Prisma.UserUpdateInput>(
    key: K,
    value: Prisma.UserUpdateInput[K] | undefined,
  ) => {
    if (value !== undefined) data[key] = value;
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
        throw new HttpError(400, 'Secondary email must be different from the account email');
      }
      data.secondary_email = secondaryEmail;
    } else {
      throw new HttpError(400, 'Secondary email is invalid');
    }
  }
  assign('address', optionalAddress(input.address));
  assign('id_card_number', optionalIdCard(input.id_card_number));
  assign('date_of_birth', optionalDateOfBirth(input.date_of_birth));
  assign('gender', optionalChoice(input.gender, 'Gender', GENDERS));
  assign('blood_group', optionalChoice(input.blood_group, 'Blood group', BLOOD_GROUPS));
  assign(
    'emergency_contact_name',
    optionalPersonName(input.emergency_contact_name, 'Emergency contact'),
  );
  assign(
    'emergency_contact_phone',
    optionalPhone(input.emergency_contact_phone, 'Emergency phone'),
  );
  assign('joined_on', optionalJoinedOn(input.joined_on));
  assign('department', optionalLabel(input.department, 'Department'));
  assign('designation', optionalLabel(input.designation, 'Designation'));
  assign('info', optionalNotes(input.info));
  for (const key of [
    'salary_basic',
    'salary_allowance',
    'salary_deduction',
    'medical_limit',
    'opd_limit',
  ] as const) {
    if (input[key] === undefined) continue;
    const parsed = Number(input[key]);
    if (!Number.isFinite(parsed) || parsed < 0 || parsed > 100_000_000) {
      throw new HttpError(400, `${key} must be between 0 and 100,000,000`);
    }
    data[key] = parsed;
  }
  if (input.clock_enabled !== undefined) data.clock_enabled = Boolean(input.clock_enabled);
  if (input.login_enabled !== undefined) data.login_enabled = Boolean(input.login_enabled);
  if (input.shift === 'day' || input.shift === 'night') data.shift = input.shift;
  if (input.employment_status === 'active' || input.employment_status === 'resigned') {
    data.employment_status = input.employment_status;
    if (input.employment_status === 'resigned') data.login_enabled = false;
  }
  if (input.left_on !== undefined) data.left_on = optionalJoinedOn(input.left_on);
  if (typeof input.employee_code === 'string') {
    const code = input.employee_code.trim().toUpperCase();
    data.employee_code = code || null;
  }
  const enablingLogin = input.login_enabled === true && target.login_enabled === false;
  if (enablingLogin && (typeof input.password !== 'string' || !input.password)) {
    throw new HttpError(400, 'Set a password before turning sign-in on');
  }
  if (typeof input.password === 'string' && input.password) {
    assertPassword(input.password);
    data.password_hash = await hashPassword(input.password);
    data.password_changed_at = new Date();
  }
  const salaryTouched = (['salary_basic', 'salary_allowance', 'salary_deduction'] as const).some(
    (key) => data[key] !== undefined && data[key] !== target[key],
  );
  if (input.is_active !== undefined) data.is_active = Boolean(input.is_active);
  const user = await prisma.user
    .update({ where: { id: userId }, data, select: publicUserSelect })
    .catch((err: unknown) => {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        const targetFields = err.meta?.target;
        const fields = Array.isArray(targetFields)
          ? targetFields.join(' ')
          : String(targetFields ?? '');
        if (fields.includes('employee_code')) {
          throw new HttpError(409, 'That employee code is already in use');
        }
        if (fields.includes('id_card')) {
          throw new HttpError(409, 'An account with that ID card number already exists');
        }
        throw new HttpError(409, 'An account with that email already exists');
      }
      throw err;
    });
  if (salaryTouched) {
    await prisma.salaryChange.create({
      data: {
        user_id: userId,
        salary_basic: user.salary_basic,
        salary_allowance: user.salary_allowance,
        salary_deduction: user.salary_deduction,
        actor_id: actor.id,
      },
    });
  }
  if (input.is_active === false || data.login_enabled === false) {
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
    benefits: balances,
    leaves,
    salary,
    recentMedical,
    recentLeave,
  };
  if (actor.role === Role.finance) {
    const [pendingMedical, pendingOpd] = await Promise.all([
      prisma.medicalRequest.count({
        where: { status: 'pending', submitted_by: null, kind: BenefitKind.medical },
      }),
      prisma.medicalRequest.count({
        where: { status: 'pending', submitted_by: null, kind: BenefitKind.opd },
      }),
    ]);
    return { ...base, personal, finance: { pendingMedical, pendingOpd } };
  }
  if (actor.role !== Role.hr) return { ...base, personal };
  const [
    employees,
    inactive,
    pendingMedical,
    pendingOpd,
    pendingLeave,
    pendingProfile,
    pendingOvertime,
  ] = await Promise.all([
    prisma.user.count({
      where: { role: { in: [Role.employee, Role.dataview] }, is_active: true },
    }),
    prisma.user.count({
      where: { role: { in: [Role.employee, Role.dataview] }, is_active: false },
    }),
    prisma.medicalRequest.count({
      where: { status: 'pending', kind: BenefitKind.medical, ...hrBenefitQueue },
    }),
    prisma.medicalRequest.count({
      where: { status: 'pending', kind: BenefitKind.opd, ...hrBenefitQueue },
    }),
    prisma.leaveRequest.count({ where: { status: 'pending' } }),
    prisma.profileUpdateRequest.count({ where: { status: 'pending' } }),
    prisma.overtimeRequest.count({ where: { status: 'pending' } }),
  ]);
  return {
    ...base,
    personal,
    hr: {
      total: employees + inactive,
      employees,
      inactive,
      pendingMedical,
      pendingOpd,
      pendingLeave,
      pendingProfile,
      pendingOvertime,
    },
  };
}

export async function assertStaffVisible(actor: AuthUser, userId: string) {
  const target = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true },
  });
  if (!target) throw new HttpError(404, 'User not found');
  if (target.role === Role.super_admin && actor.role !== Role.super_admin) {
    throw new HttpError(403, 'You cannot view a Super Admin account');
  }
  if (
    (actor.role === Role.hr || actor.role === Role.finance) &&
    target.role !== Role.employee &&
    target.role !== Role.dataview
  ) {
    throw new HttpError(403, 'You can only view Employee and DataView accounts');
  }
  return target;
}

export async function employmentProfile(actor: AuthUser, userId: string) {
  await assertStaffVisible(actor, userId);
  if (actor.role === Role.finance) {
    const target = await prisma.user.findUnique({
      where: { id: userId },
      select: financeDirectorySelect,
    });
    if (!target) throw new HttpError(404, 'User not found');
    return { user: target, balances: [] };
  }
  const target = await prisma.user.findUnique({ where: { id: userId }, select: publicUserSelect });
  if (!target) throw new HttpError(404, 'User not found');
  await ensureLeaveBalances(userId);
  const balances = await prisma.leaveBalance.findMany({
    where: { user_id: userId },
    include: { leave_type: true },
    orderBy: { leave_type: { name: 'asc' } },
  });
  return { user: target, balances };
}

const financeDirectorySelect = {
  id: true,
  full_name: true,
  email: true,
  role: true,
  employee_code: true,
  login_enabled: true,
  department: true,
  is_active: true,
} as const;

export async function listPeople(
  actor: AuthUser,
  role: Role | undefined,
  query: string | undefined,
  page: number,
  active?: boolean,
) {
  const pageSize = 20;
  const staff =
    actor.role === Role.hr || actor.role === Role.finance
      ? [Role.employee, Role.dataview]
      : [Role.employee, Role.dataview, Role.hr, Role.finance];
  if (
    role &&
    (actor.role === Role.hr || actor.role === Role.finance) &&
    role !== Role.employee &&
    role !== Role.dataview
  ) {
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
            { employee_code: { contains: query, mode: 'insensitive' } },
          ],
        }
      : {}),
  };
  const [total, users] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      select: actor.role === Role.finance ? financeDirectorySelect : publicUserSelect,
      orderBy: { full_name: 'asc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);
  return { users, total, page, pageSize };
}

export { companySettings };
