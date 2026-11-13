import { MedicalRequestStatus } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { HttpError } from '../lib/http';
import { Permission, roleHasPermission } from '../lib/auth/permissions';
import { AuthUser } from '../lib/auth/session';
import {
  OVERTIME_MULTIPLIER,
  calculatePayslip,
  shiftHours,
  summarizePayDays,
} from '../lib/payroll';

const COMPANY_ID = 'default';

function keyOf(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function eachKey(start: Date, end: Date): string[] {
  const keys: string[] = [];
  for (let cursor = start.getTime(); cursor <= end.getTime(); cursor += 86_400_000) {
    keys.push(keyOf(new Date(cursor)));
  }
  return keys;
}

function parseMonth(value: unknown): { year: number; month: number } {
  const text = typeof value === 'string' && /^\d{4}-\d{2}$/.test(value) ? value : '';
  const now = new Date();
  const year = text ? Number(text.slice(0, 4)) : now.getUTCFullYear();
  const month = text ? Number(text.slice(5, 7)) : now.getUTCMonth() + 1;
  if (month < 1 || month > 12) throw new HttpError(400, 'Month must be YYYY-MM');
  return { year, month };
}

export async function payslipFor(actor: AuthUser, userId: string, monthValue: unknown) {
  if (actor.id !== userId && !roleHasPermission(actor.role, Permission.SalaryManage)) {
    throw new HttpError(403, 'You cannot view this payslip');
  }
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      full_name: true,
      department: true,
      designation: true,
      joined_on: true,
      shift: true,
      salary_basic: true,
      salary_allowance: true,
      salary_deduction: true,
    },
  });
  if (!user) throw new HttpError(404, 'Employee not found');

  const { year, month } = parseMonth(monthValue);
  const company = await prisma.company.upsert({
    where: { id: COMPANY_ID },
    update: {},
    create: { id: COMPANY_ID, name: 'TruckFlow' },
  });
  const weekends = new Set(
    company.weekend_days
      .split(',')
      .map((part) => Number(part.trim()))
      .filter((day) => day >= 0 && day <= 6),
  );
  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 0));
  const nextMonth = new Date(Date.UTC(year, month, 1));
  const holidays = await prisma.holiday.findMany({
    where: { holiday_on: { gte: start, lte: end } },
  });
  const holidayKeys = new Set(holidays.map((holiday) => keyOf(holiday.holiday_on)));
  const dates = Array.from({ length: end.getUTCDate() }, (_, index) => {
    const date = new Date(Date.UTC(year, month - 1, index + 1));
    const key = keyOf(date);
    return { key, working: !weekends.has(date.getUTCDay()) && !holidayKeys.has(key) };
  });
  const workingKeys = new Set(dates.filter((date) => date.working).map((date) => date.key));

  const [leaves, overtime, claims] = await Promise.all([
    prisma.leaveRequest.findMany({
      where: {
        user_id: userId,
        status: MedicalRequestStatus.approved,
        start_date: { lte: end },
        end_date: { gte: start },
      },
      include: { leave_type: true },
    }),
    prisma.overtimeRequest.findMany({
      where: {
        user_id: userId,
        status: MedicalRequestStatus.approved,
        work_date: { gte: start, lte: end },
      },
    }),
    prisma.medicalRequest.findMany({
      where: {
        user_id: userId,
        status: MedicalRequestStatus.approved,
        reviewed_at: { gte: start, lt: nextMonth },
      },
    }),
  ]);

  const paidLeave: string[] = [];
  const unpaidLeave: string[] = [];
  const claimed = new Set<string>();
  for (const leave of leaves) {
    for (const key of eachKey(leave.start_date, leave.end_date)) {
      if (!workingKeys.has(key) || claimed.has(key)) continue;
      claimed.add(key);
      if (leave.leave_type.is_paid) paidLeave.push(key);
      else unpaidLeave.push(key);
    }
  }

  const today = keyOf(
    new Date(
      Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate()),
    ),
  );
  const days = summarizePayDays({
    dates,
    today,
    joinedOn: user.joined_on ? keyOf(user.joined_on) : null,
    attendance: {},
    paidLeave,
    unpaidLeave,
  });
  const hours = shiftHours(
    user.shift === 'night' ? company.night_start : company.work_start,
    user.shift === 'night' ? company.night_end : company.work_end,
  );
  const overtimeHours = overtime.reduce((sum, request) => sum + request.hours, 0);
  const medical = claims
    .filter((claim) => claim.kind === 'medical')
    .reduce((sum, claim) => sum + claim.amount, 0);
  const opd = claims
    .filter((claim) => claim.kind === 'opd')
    .reduce((sum, claim) => sum + claim.amount, 0);
  const amounts = calculatePayslip({
    basic: user.salary_basic,
    allowance: user.salary_allowance,
    standingDeduction: user.salary_deduction,
    workingDays: dates.filter((date) => date.working).length,
    employedWorkingDays: days.employedWorkingDays,
    absent: days.absent,
    unpaidLeave: days.unpaidLeave,
    overtimeHours,
    shiftHours: hours,
    medical,
    opd,
  });

  return {
    month: `${year}-${String(month).padStart(2, '0')}`,
    employee: {
      id: user.id,
      full_name: user.full_name,
      department: user.department,
      designation: user.designation,
    },
    attendance: {
      present: days.present,
      late: days.late,
      paidLeave: days.paidLeave,
      unpaidLeave: days.unpaidLeave,
      absent: days.absent,
    },
    workingDays: dates.filter((date) => date.working).length,
    employedWorkingDays: days.employedWorkingDays,
    overtimeHours,
    overtimeMultiplier: OVERTIME_MULTIPLIER,
    shiftHours: hours,
    basic: user.salary_basic,
    allowance: user.salary_allowance,
    ...amounts,
  };
}
