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

  return (
    <section className="flex flex-col gap-4">
      <div className="flex min-h-8 items-center justify-between gap-3">
        <h2 className="text-display text-ink text-base font-semibold">Pending approvals</h2>
        <Link href="/hr/requests" className={linkMutedClass}>
          Open queue
        </Link>
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
