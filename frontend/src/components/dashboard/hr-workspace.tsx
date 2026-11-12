'use client';

import Link from 'next/link';
import { PageSection, linkMutedClass } from '@/components/page-frame';
import { Card, MetricStrip } from '@/components/widgets';

export type HrDashboardSlice = {
  employees: number;
  inactive: number;
  presentToday: number;
  lateToday: number;
  absentToday: number;
  pendingMedical: number;
  pendingLeave: number;
  pendingProfile: number;
};

export type HrPersonalSlice = {
  clockIn: string | null;
  todayStatus: string;
  netSalary: string;
  medicalRemaining: number | string;
  opdRemaining: number | string;
};

export function HrWorkspaceDashboard({
  hr,
  personal,
}: {
  hr: HrDashboardSlice;
  personal: HrPersonalSlice;
}) {
  const pendingTotal = hr.pendingMedical + hr.pendingLeave + hr.pendingProfile;
  const presentPct =
    hr.employees > 0 ? Math.min(100, Math.round((hr.presentToday / hr.employees) * 100)) : 0;

  return (
    <div className="flex flex-col gap-10">
      <PageSection
        title="Workforce overview"
        description="Counts for every employee and DataView account you manage."
      >
        <MetricStrip
          items={[
            { label: 'Employees', value: hr.employees, hint: `${hr.inactive} inactive` },
            { label: 'Present today', value: hr.presentToday },
            { label: 'Late today', value: hr.lateToday },
            { label: 'Pending requests', value: pendingTotal },
          ]}
        />

        <div className="grid gap-4 lg:grid-cols-2">
          <Card
            title="Attendance overview"
            action={<span className="text-mute text-caption text-xs font-medium">Today</span>}
          >
            <div className="space-y-5">
              <div>
                <div className="mb-2 flex items-baseline justify-between gap-2">
                  <span className="text-mute text-sm">Present</span>
                  <span className="text-ink text-2xl font-bold tabular-nums">
                    {hr.presentToday}
                  </span>
                </div>
                <div className="bg-surface h-2.5 overflow-hidden rounded-[var(--app-radius-pill)]">
                  <div
                    className="bg-accent h-full rounded-[var(--app-radius-pill)] transition-[width] duration-500 ease-out"
                    style={{ width: `${presentPct}%` }}
                  />
                </div>
                <p className="text-mute mt-1.5 text-xs">
                  {presentPct}% of {hr.employees} active employees
                </p>
              </div>
              <div className="border-line flex items-baseline justify-between border-t pt-4">
                <span className="text-mute text-sm">Late / Absent</span>
                <span className="text-ink text-lg font-bold tabular-nums">
                  {hr.lateToday}
                  <span className="text-mute px-1 text-sm font-normal">/</span>
                  {hr.absentToday}
                </span>
              </div>
            </div>
          </Card>

          <Card
            title="Pending approvals"
            action={
              <Link
                href={
                  hr.pendingProfile > 0 && hr.pendingMedical + hr.pendingLeave === 0
                    ? '/hr/requests?tab=profile'
                    : '/hr/requests'
                }
                className={linkMutedClass}
              >
                Review
              </Link>
            }
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-mute text-sm leading-relaxed">
                  Medical, leave, and profile updates waiting for your decision.
                </p>
                <ul className="text-mute mt-3 space-y-1.5 text-xs">
                  <li className="flex justify-between gap-4">
                    <span>Medical &amp; OPD</span>
                    <span className="text-ink font-semibold tabular-nums">{hr.pendingMedical}</span>
                  </li>
                  <li className="flex justify-between gap-4">
                    <span>Leave</span>
                    <span className="text-ink font-semibold tabular-nums">{hr.pendingLeave}</span>
                  </li>
                  <li className="flex justify-between gap-4">
                    <Link href="/hr/requests?tab=profile" className={linkMutedClass}>
                      Profile updates
                    </Link>
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

        <Card
          title="Recent activity"
          action={
            <Link href="/hr/attendance" className={linkMutedClass}>
              View all →
            </Link>
          }
        >
          <p className="text-mute text-sm">
            Team attendance and approval history live under{' '}
            <Link href="/hr/attendance" className={linkMutedClass}>
              Attendance
            </Link>{' '}
            and{' '}
            <Link href="/hr/requests" className={linkMutedClass}>
              Approvals
            </Link>
            .
          </p>
        </Card>
      </PageSection>

      <PageSection
        title="Personal snapshot"
        description="Your own clock-in, pay, and allowances — not team totals."
      >
        <MetricStrip
          items={[
            {
              label: 'Clock-in',
              value: personal.clockIn ?? '—',
            },
            {
              label: 'My attendance',
              value: personal.todayStatus,
            },
            {
              label: 'Net salary',
              value: personal.netSalary,
            },
            {
              label: 'Medical / OPD left',
              value: `${personal.medicalRemaining} / ${personal.opdRemaining}`,
            },
          ]}
        />
        <p className="text-mute text-sm">
          Submit claims or leave from{' '}
          <Link href="/requests" className={linkMutedClass}>
            Requests
          </Link>{' '}
          · full breakdown on{' '}
          <Link href="/salary" className={linkMutedClass}>
            Pay &amp; Benefits
          </Link>
          .
        </p>
      </PageSection>
    </div>
  );
}

function formatClockIn(iso: string | null | undefined): string | null {
  if (!iso) return null;
  return new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

export function personalSnapshotFromApi(personal: {
  attendance: {
    today: { status: string; clock_in: string | null } | null;
  };
  salary: { net: number } | null;
  benefits: { medical: { remaining: number }; opd: { remaining: number } } | null;
}): HrPersonalSlice {
  return {
    clockIn: formatClockIn(personal.attendance.today?.clock_in),
    todayStatus: personal.attendance.today?.status ?? 'Not clocked in',
    netSalary: personal.salary ? `PKR ${personal.salary.net.toLocaleString()}` : '—',
    medicalRemaining: personal.benefits?.medical.remaining ?? '—',
    opdRemaining: personal.benefits?.opd.remaining ?? '—',
  };
}
