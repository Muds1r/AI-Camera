/** Daily rate and loss-of-pay, in the same shape FlowHCM uses for attendance-linked payslips. */
export const OVERTIME_MULTIPLIER = 1.5;

export function money(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function shiftHours(workStart: string, workEnd: string): number {
  const toMinutes = (value: string) => {
    const [hours, minutes] = value.split(':').map(Number);
    return (hours || 0) * 60 + (minutes || 0);
  };
  let minutes = toMinutes(workEnd) - toMinutes(workStart);
  if (minutes <= 0) minutes += 24 * 60;
  return minutes / 60;
}

export type AttendanceMark = 'present' | 'late' | 'half_day' | 'absent';

export function summarizePayDays(input: {
  dates: { key: string; working: boolean }[];
  today: string;
  joinedOn: string | null;
  attendance: Record<string, AttendanceMark | undefined>;
  paidLeave: string[];
  unpaidLeave: string[];
}) {
  const paid = new Set(input.paidLeave);
  const unpaid = new Set(input.unpaidLeave);
  let employedWorkingDays = 0;
  let present = 0;
  let late = 0;
  let paidLeave = 0;
  let unpaidLeave = 0;
  let absent = 0;

  for (const date of input.dates) {
    if (!date.working) continue;
    if (input.joinedOn && date.key < input.joinedOn) continue;
    employedWorkingDays += 1;
    const mark = input.attendance[date.key];
    if (mark === 'present' || mark === 'late' || mark === 'half_day') {
      if (mark === 'late') late += 1;
      else if (mark === 'half_day') {
        present += 0.5;
        absent += 0.5;
      } else present += 1;
      continue;
    }
    if (paid.has(date.key)) {
      paidLeave += 1;
      continue;
    }
    if (unpaid.has(date.key)) {
      unpaidLeave += 1;
      continue;
    }
    if (date.key > input.today) continue;
    absent += 1;
  }

  return { employedWorkingDays, present, late, paidLeave, unpaidLeave, absent };
}

export function calculatePayslip(input: {
  basic: number;
  allowance: number;
  standingDeduction: number;
  workingDays: number;
  employedWorkingDays: number;
  absent: number;
  unpaidLeave: number;
  overtimeHours: number;
  shiftHours: number;
  medical: number;
  opd: number;
}) {
  const gross = money(input.basic + input.allowance);
  const perDay = input.workingDays > 0 ? gross / input.workingDays : 0;
  const lopDays = input.absent + input.unpaidLeave;
  const earned = money(perDay * input.employedWorkingDays);
  const lopAmount = money(perDay * lopDays);
  const hourly = input.shiftHours > 0 ? perDay / input.shiftHours : 0;
  const overtimeAmount = money(input.overtimeHours * hourly * OVERTIME_MULTIPLIER);
  const medical = money(input.medical);
  const opd = money(input.opd);
  const standingDeduction = money(input.standingDeduction);
  const net = money(earned - standingDeduction - lopAmount + overtimeAmount + medical + opd);
  return {
    gross,
    perDay: money(perDay),
    hourly: money(hourly),
    earned,
    lopDays,
    lopAmount,
    overtimeAmount,
    medical,
    opd,
    standingDeduction,
    net,
  };
}
