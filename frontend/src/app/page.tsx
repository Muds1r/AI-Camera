'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AppShell } from '@/components/app-shell';
import { HrWorkspaceDashboard, personalSnapshotFromApi } from '@/components/dashboard/hr-workspace';
import { PageSection, linkMutedClass } from '@/components/page-frame';
import { Card, ListRow, LoadingState, MetricStrip, Notice } from '@/components/widgets';
import { apiJson } from '@/lib/api';

interface DashboardData {
  role: string;
  personal?: {
    salary: { net: number } | null;
    benefits: { medical: { remaining: number }; opd: { remaining: number } } | null;
    attendance: {
      today: { status: string; clock_in: string | null; clock_out: string | null } | null;
      summary: {
        workingDays: number;
        sundays: number;
        gazetted: number;
        generalOff: number;
        present: number;
        late: number;
        absent: number;
      };
    };
    leaves: { allocated: number; used: number; leave_type: { name: string } }[];
    recentMedical: { id: string; kind: string; status: string; amount: number }[];
    recentLeave: { id: string; status: string; days: number; leave_type: { name: string } }[];
  };
  hr?: {
    total?: number;
    employees: number;
    inactive: number;
    clockedIn: number;
    presentToday?: number;
    lateToday?: number;
    absentToday?: number;
    pendingMedical: number;
    pendingLeave: number;
    pendingProfile: number;
  };
  admin?: {
    totalHr: number;
    activeHr: number;
    inactiveHr: number;
    recentHr: { id: string; full_name: string; email: string; is_active: boolean }[];
    logs: { id: string; action: string; detail: string | null; created_at: string }[];
  };
}

export default function HomePage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    apiJson<DashboardData>('/api/dashboard')
      .then(setData)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Could not load'));
  }, []);

  const personal = data?.personal;
  const summary = personal?.attendance.summary;
  const isHr = data?.role === 'hr' && data.hr && personal;

  const recentItems = [
    ...(personal?.recentMedical.map((item) => ({
      id: item.id,
      title: `${item.kind} · ${item.amount}`,
      status: item.status,
    })) ?? []),
    ...(personal?.recentLeave.map((item) => ({
      id: item.id,
      title: `${item.leave_type.name} · ${item.days} days`,
      status: item.status,
    })) ?? []),
  ];

  return (
    <AppShell title="Dashboard" workspaceLabel={isHr ? 'HR workspace' : undefined}>
      <div className="flex flex-col gap-10">
        <Notice error={error} />
        {!data && !error ? <LoadingState label="Loading dashboard…" /> : null}

        {isHr ? (
          <HrWorkspaceDashboard
            hr={{
              employees: data.hr!.employees,
              inactive: data.hr!.inactive,
              presentToday: data.hr!.presentToday ?? 0,
              lateToday: data.hr!.lateToday ?? 0,
              absentToday: data.hr!.absentToday ?? 0,
              pendingMedical: data.hr!.pendingMedical,
              pendingLeave: data.hr!.pendingLeave,
              pendingProfile: data.hr!.pendingProfile,
            }}
            personal={personalSnapshotFromApi({
              attendance: personal!.attendance,
              salary: personal!.salary,
              benefits: personal!.benefits,
            })}
          />
        ) : null}

        {data?.admin ? (
          <PageSection title="Administration">
            <MetricStrip
              items={[
                { label: 'HR accounts', value: data.admin.totalHr },
                { label: 'Active', value: data.admin.activeHr },
                { label: 'Inactive', value: data.admin.inactiveHr },
              ]}
            />
            <Card
              title="Recent HR accounts"
              action={
                <Link href="/admin/hr" className={linkMutedClass}>
                  Manage
                </Link>
              }
            >
              <ul className="divide-line divide-y">
                {data.admin.recentHr.map((person) => (
                  <li
                    key={person.id}
                    className="flex items-center justify-between gap-4 py-2.5 text-sm first:pt-0 last:pb-0"
                  >
                    <span className="font-medium">{person.full_name}</span>
                    <span className="text-mute truncate text-xs">{person.email}</span>
                  </li>
                ))}
              </ul>
            </Card>
          </PageSection>
        ) : null}

        {personal && summary && data?.role !== 'hr' ? (
          <PageSection
            title={data?.role === 'dataview' ? 'Attendance snapshot' : 'Your snapshot'}
            description={
              data?.role === 'dataview'
                ? 'Your clock and monthly record.'
                : 'Pay, benefits, and attendance for your account.'
            }
          >
            <MetricStrip
              items={[
                {
                  label: 'Today',
                  value: personal.attendance.today?.status ?? 'Not clocked in',
                },
                ...(data?.role === 'dataview'
                  ? []
                  : [
                      {
                        label: 'Net pay',
                        value: personal.salary
                          ? `PKR ${personal.salary.net.toLocaleString()}`
                          : '—',
                      },
                      {
                        label: 'Medical',
                        value: personal.benefits?.medical.remaining ?? '—',
                      },
                      {
                        label: 'OPD',
                        value: personal.benefits?.opd.remaining ?? '—',
                      },
                    ]),
                {
                  label: 'This month',
                  value: `${summary.present} present`,
                  hint: `${summary.late} late · ${summary.absent} absent`,
                },
              ]}
            />

            {data?.role !== 'dataview' && recentItems.length > 0 ? (
              <Card
                title="Recent requests"
                action={
                  <Link href="/requests" className={linkMutedClass}>
                    All requests
                  </Link>
                }
              >
                <div className="space-y-2">
                  {recentItems.map((item) => (
                    <ListRow key={item.id} title={item.title} status={item.status} />
                  ))}
                </div>
              </Card>
            ) : null}
          </PageSection>
        ) : null}
      </div>
    </AppShell>
  );
}
