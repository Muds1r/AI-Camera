import { cardClass } from '@/components/page-frame';
import { MetricStrip } from '@/components/widgets';

export type Payslip = {
  month: string;
  employee: {
    id: string;
    full_name: string;
    department: string | null;
    designation: string | null;
  };
  attendance: {
    present: number;
    late: number;
    paidLeave: number;
    unpaidLeave: number;
    absent: number;
  };
  workingDays: number;
  employedWorkingDays: number;
  overtimeHours: number;
  overtimeMultiplier: number;
  shiftHours: number;
  basic: number;
  allowance: number;
  gross: number;
  perDay: number;
  hourly: number;
  earned: number;
  lopDays: number;
  lopAmount: number;
  overtimeAmount: number;
  medical: number;
  opd: number;
  standingDeduction: number;
  net: number;
};

function pkr(value: number) {
  const sign = value < 0 ? '−' : '';
  return `${sign}PKR ${Math.abs(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function Row({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="border-line flex items-start justify-between gap-4 border-b py-2.5 last:border-b-0">
      <div>
        <p className="text-ink text-sm">{label}</p>
        {hint ? <p className="text-mute mt-0.5 text-xs">{hint}</p> : null}
      </div>
      <p className="shrink-0 text-sm tabular-nums">{value}</p>
    </div>
  );
}

export function PayslipView({ slip }: { slip: Payslip }) {
  const role = [slip.employee.department, slip.employee.designation].filter(Boolean).join(' · ');
  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="text-ink text-sm font-semibold">{slip.employee.full_name}</p>
        <p className="text-mute text-xs">{role || 'Payslip'}</p>
      </div>
      <MetricStrip
        items={[
          {
            label: 'Working days',
            value: slip.workingDays,
            hint: 'Excludes weekends and holidays',
          },
          { label: 'Daily rate', value: pkr(slip.perDay) },
          { label: 'Present', value: slip.attendance.present },
          { label: 'Late', value: slip.attendance.late, hint: 'Paid in full' },
          { label: 'Paid leave', value: slip.attendance.paidLeave },
          {
            label: 'Loss of pay',
            value: slip.lopDays,
            hint: `${slip.attendance.unpaidLeave} unpaid · ${slip.attendance.absent} absent`,
          },
        ]}
      />
      <div className={`${cardClass} px-4`}>
        <Row label="Basic" value={pkr(slip.basic)} />
        <Row label="Allowance" value={pkr(slip.allowance)} />
        <Row
          label="Earned this month"
          value={pkr(slip.earned)}
          hint={
            slip.employedWorkingDays === slip.workingDays
              ? 'Full month package'
              : `${slip.employedWorkingDays} working days from the joining date`
          }
        />
        <Row
          label="Loss of pay"
          value={pkr(-slip.lopAmount)}
          hint={`${slip.lopDays} day${slip.lopDays === 1 ? '' : 's'} × ${pkr(slip.perDay)}`}
        />
        <Row label="Standing deduction" value={pkr(-slip.standingDeduction)} />
        <Row
          label="Overtime"
          value={pkr(slip.overtimeAmount)}
          hint={`${slip.overtimeHours} h at ${slip.overtimeMultiplier}× ${pkr(slip.hourly)} / hour`}
        />
        <Row label="Medical claims" value={pkr(slip.medical)} hint="Approved this month" />
        <Row label="OPD claims" value={pkr(slip.opd)} hint="Approved this month" />
        <div className="flex items-center justify-between gap-4 py-3">
          <p className="text-ink font-semibold">Net pay</p>
          <p className="text-ink text-lg font-semibold tabular-nums">{pkr(slip.net)}</p>
        </div>
      </div>
      <p className="text-mute max-w-2xl text-sm leading-relaxed">
        The daily rate is the monthly package divided by this month&apos;s working days. Absence and
        approved unpaid leave each remove one daily rate. Days still ahead this month stay in the
        pay until they are missed. Approved medical and OPD claims are added, and overtime is paid
        at {slip.overtimeMultiplier} times the hourly rate.
      </p>
    </div>
  );
}
