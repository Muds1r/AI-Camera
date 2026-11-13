'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AppShell } from '@/components/app-shell';
import { HrWorkspaceDashboard } from '@/components/dashboard/hr-workspace';
import { cardClass, linkMutedClass } from '@/components/page-frame';
import { Badge, Card, LoadingState, Notice, Pagination } from '@/components/widgets';
import { AnnouncementsPanel } from '@/components/announcements';
import { PoliciesPanel } from '@/components/policies-panel';
import { usePaged } from '@/lib/use-paged';
import { apiJson } from '@/lib/api';

interface DashboardData {
  role: string;
  personal?: {
    salary: { basic: number; allowance: number; net: number } | null;
    benefits: { medical: { remaining: number }; opd: { remaining: number } } | null;
    leaves: { allocated: number; used: number; leave_type: { name: string } }[];
    recentMedical: { id: string; kind: string; status: string; amount: number }[];
    recentLeave: { id: string; status: string; days: number; leave_type: { name: string } }[];
  };
  hr?: {
    total?: number;
    employees: number;
    inactive: number;
    pendingMedical: number;
    pendingOpd: number;
    pendingLeave: number;
    pendingOvertime: number;
    pendingProfile: number;
  };
  admin?: {
    totalHr: number;
    activeHr: number;
    inactiveHr: number;
    recentHr: { id: string; full_name: string; email: string; is_active: boolean }[];
    logs: {
      id: string;
      action: string;
      detail: string | null;
      created_at: string;
      actor?: { full_name: string } | null;
    }[];
  };
  finance?: {
    pendingMedical: number;
    pendingOpd: number;
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

  const recent = usePaged(recentItems, 4);
  const [showSalary, setShowSalary] = useState(false);
  const showPay = Boolean(personal && data?.role !== 'dataview');

  return (
    <AppShell title="Dashboard" workspaceLabel={isHr ? 'HR workspace' : undefined}>
      <div className="flex flex-col gap-4">
        <Notice error={error} />
        {!data && !error ? <LoadingState label="Loading dashboard…" /> : null}

        <div className="grid items-stretch gap-4 lg:grid-cols-2">
          <div className={showPay ? 'flex h-full' : 'flex h-full lg:col-span-2'}>
            <AnnouncementsPanel />
          </div>
          {showPay ? (
            <SalaryAllowance
              salary={personal?.salary ?? null}
              revealed={showSalary}
              onToggle={() => setShowSalary((current) => !current)}
            />
          ) : null}
        </div>

        {showPay ? (
          <div className="grid items-stretch gap-4 lg:grid-cols-2">
            <section className="flex h-full flex-col gap-3">
              <h2 className="text-display text-ink flex min-h-8 items-center text-base font-semibold">
                Leave balances
              </h2>
              <div className={`${cardClass} flex-1 p-4`}>
                {personal && personal.leaves.length > 0 ? (
                  <ul className="divide-line divide-y">
                    {personal.leaves.map((item) => (
                      <li
                        key={item.leave_type.name}
                        className="flex items-center justify-between gap-3 py-2.5 text-sm first:pt-0 last:pb-0"
                      >
                        <span className="text-ink font-medium">{item.leave_type.name}</span>
                        <span className="text-mute tabular-nums">
                          {item.allocated - item.used} left
                          <span className="text-mute"> · {item.used} used</span>
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-mute text-sm">No leave balances yet.</p>
                )}
              </div>
            </section>
            <section className="flex h-full flex-col gap-3">
              <div className="flex min-h-8 items-center justify-between gap-3">
                <h2 className="text-display text-ink text-base font-semibold">
                  {isHr ? 'Recent approvals' : 'Recent requests'}
                </h2>
                <Link href={isHr ? '/hr/requests' : '/requests'} className={linkMutedClass}>
                  {isHr ? 'Open queue' : 'All requests'}
                </Link>
              </div>
              <div className={`${cardClass} flex-1 p-4`}>
                {recentItems.length > 0 ? (
                  <ul className="divide-line divide-y">
                    {recent.slice.map((item) => (
                      <li
                        key={item.id}
                        className="flex items-center justify-between gap-3 py-2.5 text-sm first:pt-0 last:pb-0"
                      >
                        <span className="text-ink min-w-0 truncate font-medium">{item.title}</span>
                        <Badge status={item.status} />
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-mute text-sm">Nothing recent yet.</p>
                )}
                {recent.showPager ? (
                  <Pagination
                    page={recent.page}
                    totalPages={recent.totalPages}
                    total={recent.total}
                    pageSize={recent.pageSize}
                    onPageChange={recent.setPage}
                  />
                ) : null}
              </div>
            </section>
          </div>
        ) : null}

        <PoliciesPanel />

        {isHr ? (
          <HrWorkspaceDashboard
            hr={{
              employees: data.hr!.employees,
              inactive: data.hr!.inactive,
              pendingMedical: data.hr!.pendingMedical,
              pendingOpd: data.hr!.pendingOpd ?? 0,
              pendingLeave: data.hr!.pendingLeave,
              pendingOvertime: data.hr!.pendingOvertime,
              pendingProfile: data.hr!.pendingProfile,
            }}
          />
        ) : null}

        {data?.finance || data?.admin || data?.role === 'dataview' ? (
          <div className="grid items-stretch gap-4 lg:grid-cols-2">
            <div className="flex flex-col gap-4">
              {data?.admin && data.admin.recentHr.length > 0 ? (
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
              ) : null}
            </div>
            <div className="flex flex-col gap-4">
              {data?.finance ? (
                <div className={`${cardClass} p-4`}>
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <h2 className="text-ink text-sm font-semibold">Claims waiting</h2>
                    <Link href="/finance/claims" className={linkMutedClass}>
                      Open
                    </Link>
                  </div>
                  <dl className="grid grid-cols-2 gap-3">
                    <div>
                      <dt className="text-mute text-xs">Medical</dt>
                      <dd className="text-ink mt-1 text-xl font-semibold tabular-nums">
                        {data.finance.pendingMedical}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-mute text-xs">OPD</dt>
                      <dd className="text-ink mt-1 text-xl font-semibold tabular-nums">
                        {data.finance.pendingOpd}
                      </dd>
                    </div>
                  </dl>
                </div>
              ) : null}

              {data?.admin ? (
                <div className={`${cardClass} p-4`}>
                  <h2 className="text-ink text-sm font-semibold">HR accounts</h2>
                  <dl className="mt-3 grid grid-cols-3 gap-2">
                    <div>
                      <dt className="text-mute text-xs">Total</dt>
                      <dd className="text-ink mt-1 text-lg font-semibold">{data.admin.totalHr}</dd>
                    </div>
                    <div>
                      <dt className="text-mute text-xs">Active</dt>
                      <dd className="text-ink mt-1 text-lg font-semibold">{data.admin.activeHr}</dd>
                    </div>
                    <div>
                      <dt className="text-mute text-xs">Inactive</dt>
                      <dd className="text-ink mt-1 text-lg font-semibold">
                        {data.admin.inactiveHr}
                      </dd>
                    </div>
                  </dl>
                </div>
              ) : null}

              {data?.role === 'dataview' ? (
                <div className={`${cardClass} p-4`}>
                  <h2 className="text-ink text-sm font-semibold">Camera operations</h2>
                  <p className="mt-3 flex flex-col gap-2 text-sm">
                    <Link href="/cameras" className={linkMutedClass}>
                      Cameras
                    </Link>
                    <Link href="/operations" className={linkMutedClass}>
                      Detections and alerts
                    </Link>
                  </p>
                </div>
              ) : null}

              {data?.admin && data.admin.logs.length > 0 ? (
                <Card
                  title="Recent activity"
                  action={
                    <Link href="/admin/logs" className={linkMutedClass}>
                      All logs
                    </Link>
                  }
                >
                  <ul className="divide-line divide-y">
                    {data.admin.logs.slice(0, 6).map((log) => (
                      <li key={log.id} className="py-2.5 text-sm first:pt-0 last:pb-0">
                        <p className="text-ink font-medium">{log.action}</p>
                        <p className="text-mute text-xs">
                          {[log.actor?.full_name, log.detail].filter(Boolean).join(' · ')}
                        </p>
                      </li>
                    ))}
                  </ul>
                </Card>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>
    </AppShell>
  );
}

function money(amount: number) {
  return `PKR ${Number(amount).toLocaleString()}`;
}

function SalaryAllowance({
  salary,
  revealed,
  onToggle,
}: {
  salary: { basic: number; allowance: number; net: number } | null;
  revealed: boolean;
  onToggle: () => void;
}) {
  const rows = [
    ['Basic salary', salary ? money(salary.basic) : '—'],
    ['Allowance', salary ? money(salary.allowance) : '—'],
    ['Net pay', salary ? money(salary.net) : '—'],
  ] as const;

  return (
    <section className="flex h-full flex-col gap-3">
      <div className="flex min-h-8 items-center justify-between gap-3">
        <h2 className="text-display text-ink text-base font-semibold">Salary & Allowance</h2>
        <button
          type="button"
          onClick={onToggle}
          aria-pressed={revealed}
          aria-label={revealed ? 'Hide salary' : 'Show salary'}
          className="text-mute hover:text-ink hover:bg-surface focus-visible:outline-primary inline-flex h-8 w-8 items-center justify-center rounded-full focus-visible:outline focus-visible:outline-2"
        >
          {revealed ? <EyeIcon /> : <EyeOffIcon />}
        </button>
      </div>
      <div className={`${cardClass} flex-1 p-4`}>
        <dl className="grid h-full content-center gap-4">
          {rows.map(([label, value]) => (
            <div key={label} className="flex items-center justify-between gap-3">
              <dt className="text-mute text-sm">{label}</dt>
              <dd className="text-ink text-sm font-semibold tabular-nums">
                {revealed ? value : '••••••'}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}

function EyeOffIcon() {
  return (
    <svg
      className="h-[18px] w-[18px]"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.75}
        d="M3.98 8.223A10.48 10.48 0 0 0 2 12c1.29 4.34 5.31 7.5 10 7.5.99 0 1.95-.14 2.86-.4M6.23 6.23A10.45 10.45 0 0 1 12 4.5c4.69 0 8.71 3.16 10 7.5a10.52 10.52 0 0 1-4.29 5.77M6.23 6.23 3 3m3.23 3.23 3.65 3.65m7.89 7.89L21 21m-3.23-3.23-3.65-3.65m0 0a3 3 0 1 0-4.24-4.24m4.24 4.24L9.88 9.88"
      />
    </svg>
  );
}

function EyeIcon() {
  return (
    <svg
      className="h-[18px] w-[18px]"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.75}
        d="M2.04 12.32a1 1 0 0 1 0-.64C3.42 7.51 7.36 4.5 12 4.5s8.57 3.01 9.96 7.18a1 1 0 0 1 0 .64C20.58 16.49 16.64 19.5 12 19.5s-8.57-3.01-9.96-7.18Z"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.75}
        d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"
      />
    </svg>
  );
}
