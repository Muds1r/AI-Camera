import { calculatePayslip, summarizePayDays } from './payroll';

function month(working: number) {
  return Array.from({ length: working }, (_, index) => ({
    key: `2026-11-${String(index + 1).padStart(2, '0')}`,
    working: true,
  }));
}

describe('attendance payslip', () => {
  it('pays the full package when every working day is covered', () => {
    const days = summarizePayDays({
      dates: month(22),
      today: '2026-11-22',
      joinedOn: null,
      attendance: Object.fromEntries(month(22).map((day) => [day.key, 'present' as const])),
      paidLeave: [],
      unpaidLeave: [],
    });
    const slip = calculatePayslip({
      basic: 80000,
      allowance: 20000,
      standingDeduction: 0,
      workingDays: 22,
      employedWorkingDays: days.employedWorkingDays,
      absent: days.absent,
      unpaidLeave: days.unpaidLeave,
      overtimeHours: 0,
      shiftHours: 8,
      medical: 0,
      opd: 0,
    });
    expect(slip.gross).toBe(100000);
    expect(slip.net).toBe(100000);
    expect(slip.lopAmount).toBe(0);
  });

  it('cuts one daily rate for each absence and unpaid leave day', () => {
    const dates = month(22);
    const attendance = Object.fromEntries(
      dates.slice(0, 20).map((day) => [day.key, 'present' as const]),
    );
    const days = summarizePayDays({
      dates,
      today: '2026-11-22',
      joinedOn: null,
      attendance,
      paidLeave: [],
      unpaidLeave: ['2026-11-21'],
    });
    expect(days.unpaidLeave).toBe(1);
    expect(days.absent).toBe(1);
    const slip = calculatePayslip({
      basic: 100000,
      allowance: 0,
      standingDeduction: 0,
      workingDays: 22,
      employedWorkingDays: days.employedWorkingDays,
      absent: days.absent,
      unpaidLeave: days.unpaidLeave,
      overtimeHours: 0,
      shiftHours: 8,
      medical: 0,
      opd: 0,
    });
    expect(slip.perDay).toBe(4545.45);
    expect(slip.lopDays).toBe(2);
    expect(slip.lopAmount).toBe(9090.91);
    expect(slip.net).toBe(90909.09);
  });

  it('adds approved claims and overtime at 1.5 times the hourly rate', () => {
    const slip = calculatePayslip({
      basic: 80000,
      allowance: 20000,
      standingDeduction: 5000,
      workingDays: 20,
      employedWorkingDays: 20,
      absent: 0,
      unpaidLeave: 0,
      overtimeHours: 2,
      shiftHours: 8,
      medical: 3000,
      opd: 1500,
    });
    const hourly = 100000 / 20 / 8;
    expect(slip.overtimeAmount).toBe(Math.round((2 * hourly * 1.5 + Number.EPSILON) * 100) / 100);
    expect(slip.net).toBe(
      Math.round((100000 - 5000 + slip.overtimeAmount + 4500 + Number.EPSILON) * 100) / 100,
    );
  });

  it('does not treat a future working day as absence, and prorates a mid-month joiner', () => {
    const dates = month(10);
    const days = summarizePayDays({
      dates,
      today: '2026-11-04',
      joinedOn: '2026-11-03',
      attendance: { '2026-11-03': 'present', '2026-11-04': 'late' },
      paidLeave: [],
      unpaidLeave: [],
    });
    expect(days.employedWorkingDays).toBe(8);
    expect(days.absent).toBe(0);
    expect(days.present).toBe(1);
    expect(days.late).toBe(1);
  });
});
