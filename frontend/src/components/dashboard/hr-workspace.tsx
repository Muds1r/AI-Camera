'use client';

import Link from 'next/link';
import { cardClass, linkMutedClass } from '@/components/page-frame';

export type HrDashboardSlice = {
  employees: number;
  inactive: number;
  pendingMedical: number;
  pendingOpd: number;
  pendingLeave: number;
  pendingOvertime: number;
  pendingProfile: number;
};

const QUEUES = [
  {
    key: 'leave',
    label: 'Leave',
    detail: 'Time off waiting on HR',
    href: '/hr/requests?tab=leave',
  },
  {
    key: 'overtime',
    label: 'Overtime',
    detail: 'Extra hours waiting on HR',
    href: '/hr/requests?tab=overtime',
  },
  {
    key: 'profile',
    label: 'Profile updates',
    detail: 'Changes staff sent for review',
    href: '/hr/requests?tab=profile',
  },
  {
    key: 'medical',
    label: 'Finance medical',
    detail: 'Medical claims from finance staff',
    href: '/hr/requests?tab=medical',
  },
  {
    key: 'opd',
    label: 'Finance OPD',
    detail: 'OPD claims from finance staff',
    href: '/hr/requests?tab=opd',
  },
] as const;

function leftLabel(count: number) {
  if (count === 0) return 'None left';
  if (count === 1) return '1 left';
  return `${count} left`;
}

export function HrWorkspaceDashboard({ hr }: { hr: HrDashboardSlice }) {
  const counts: Record<(typeof QUEUES)[number]['key'], number> = {
    leave: hr.pendingLeave,
    overtime: hr.pendingOvertime,
    profile: hr.pendingProfile,
    medical: hr.pendingMedical,
    opd: hr.pendingOpd,
  };

          <Card
            title="Pending approvals"
            action={
              <Link href="/hr/requests" className={linkMutedClass}>
                Review
              </Link>
            }
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-mute text-sm leading-relaxed">
                  Leave, overtime, attendance, and profile updates, plus medical and OPD claims from
                  finance staff. Employees and HR send their own medical and OPD claims to Finance.
                </p>
                <ul className="text-mute mt-3 space-y-1.5 text-xs">
                  <li className="flex justify-between gap-4">
                    <span>Finance medical &amp; OPD</span>
                    <span className="text-ink font-semibold tabular-nums">{hr.pendingMedical}</span>
                  </li>
                  <li className="flex justify-between gap-4">
                    <span>Leave</span>
                    <span className="text-ink font-semibold tabular-nums">{hr.pendingLeave}</span>
                  </li>
                  <li className="flex justify-between gap-4">
                    <span>Overtime</span>
                    <span className="text-ink font-semibold tabular-nums">
                      {hr.pendingOvertime}
                    </span>
                  </li>
                  <li className="flex justify-between gap-4">
                    <span>Profile updates</span>
                    <span className="text-ink font-semibold tabular-nums">{hr.pendingProfile}</span>
                  </li>
                </ul>
              </div>
              {pendingTotal > 0 ? (
                <span className="bg-warning/15 text-warning shrink-0 rounded-[var(--app-radius-pill)] px-2.5 py-1 text-xs font-semibold">
                  {pendingTotal} pending
                </span>
              ) : (
                <span className="bg-success-soft text-success shrink-0 rounded-[var(--app-radius-pill)] px-2.5 py-1 text-xs font-semibold">
                  All clear
                </span>
              )}
            </div>
          </Card>
        </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-5">
        {QUEUES.map((item) => {
          const count = counts[item.key];
          return (
            <Link
              key={item.key}
              href={item.href}
              className={`${cardClass} hover:shadow-card-hover flex min-h-32 flex-col justify-between p-4 transition-shadow`}
            >
              <span className="text-ink text-sm font-medium">{item.label}</span>
              <span>
                <span className="text-ink block text-3xl font-semibold tabular-nums">{count}</span>
                <span className="text-mute mt-1 block text-xs">{leftLabel(count)}</span>
                <span className="text-mute mt-1 block text-xs leading-snug">{item.detail}</span>
              </span>
            </Link>
          );
        })}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className={`${cardClass} p-4`}>
          <p className="text-mute text-xs font-medium">Active employees</p>
          <p className="text-ink mt-1 text-2xl font-semibold tabular-nums">{hr.employees}</p>
          <p className="text-mute mt-1 text-xs">On the employee directory</p>
        </div>
        <div className={`${cardClass} p-4`}>
          <p className="text-mute text-xs font-medium">Inactive</p>
          <p className="text-ink mt-1 text-2xl font-semibold tabular-nums">{hr.inactive}</p>
          <p className="text-mute mt-1 text-xs">Accounts turned off</p>
        </div>
      </div>
    </section>
  );
}
