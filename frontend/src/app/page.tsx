'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AppShell } from '@/components/app-shell';
import { Badge, Stat } from '@/components/widgets';
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
    pendingMedical: number;
    pendingLeave: number;
    pendingProfile: number;
    activity?: {
      id: string;
      action: string;
      detail: string | null;
      created_at: string;
      actor: { full_name: string } | null;
    }[];
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

  return (
    <AppShell title="Dashboard">
      {error ? <p className="text-danger mb-4 text-sm font-bold">{error}</p> : null}
      {!data ? <p className="text-mute">Loading dashboard…</p> : null}

      {data?.admin ? (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-3">
            <Stat label="HR accounts" value={data.admin.totalHr} />
            <Stat label="Active HR" value={data.admin.activeHr} />
            <Stat label="Inactive HR" value={data.admin.inactiveHr} />
          </div>
          <section className="border-line bg-paper rounded-xl border p-5 shadow-sm">
            <h2 className="mb-3 font-extrabold">Recent HR accounts</h2>
            <ul className="space-y-2 text-sm">
              {data.admin.recentHr.map((person) => (
                <li key={person.id} className="flex justify-between">
                  <span className="font-bold">{person.full_name}</span>
                  <span className="text-mute">{person.email}</span>
                </li>
              ))}
            </ul>
            <Link href="/admin/hr" className="text-teal mt-4 inline-block text-sm font-bold">
              Manage HR accounts
            </Link>
          </section>
        </div>
      ) : null}

      {data?.hr ? (
        <div className="mt-6 space-y-6">
          <div className="grid gap-4 sm:grid-cols-3">
            <Stat
              label="Total people"
              value={data.hr.total ?? data.hr.employees + data.hr.inactive}
            />
            <Stat label="Active employees" value={data.hr.employees} />
            <Stat label="Inactive employees" value={data.hr.inactive} />
            <Stat label="Clocked in now" value={data.hr.clockedIn} />
            <Stat
              label="Today present / late"
              value={`${data.hr.presentToday ?? 0} / ${data.hr.lateToday ?? 0}`}
            />
            <Stat label="Pending medical / OPD" value={data.hr.pendingMedical} />
            <Stat label="Pending leave" value={data.hr.pendingLeave} />
            <Stat label="Pending profile updates" value={data.hr.pendingProfile} />
          </div>
          {data.hr.activity ? (
            <section className="border-line bg-paper rounded-xl border p-5 shadow-sm">
              <h2 className="mb-3 font-extrabold">Recent activity</h2>
              <ul className="space-y-2 text-sm">
                {data.hr.activity.length === 0 ? (
                  <li className="text-mute">No activity yet.</li>
                ) : null}
                {data.hr.activity.map((item) => (
                  <li key={item.id} className="flex justify-between gap-3">
                    <span className="font-bold">
                      {item.actor?.full_name || 'System'} · {item.action}
                    </span>
                    <span className="text-mute">{new Date(item.created_at).toLocaleString()}</span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>
      ) : null}

      {personal && summary ? (
        <div className="mt-6 space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Today" value={personal.attendance.today?.status ?? 'Not clocked in'} />
            {data?.role === 'dataview' ? null : (
              <Stat
                label="Net salary"
                value={personal.salary ? personal.salary.net.toLocaleString() : '—'}
              />
            )}
            {data?.role === 'dataview' ? null : (
              <Stat label="Medical left" value={personal.benefits?.medical.remaining ?? '—'} />
            )}
            {data?.role === 'dataview' ? null : (
              <Stat label="OPD left" value={personal.benefits?.opd.remaining ?? '—'} />
            )}
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <Stat
              label="Working days"
              value={summary.workingDays}
              hint={`${summary.sundays} Sundays`}
            />
            <Stat
              label="Present / late / absent"
              value={`${summary.present} / ${summary.late} / ${summary.absent}`}
            />
            <Stat
              label="Holidays"
              value={summary.gazetted + summary.generalOff}
              hint={`${summary.gazetted} gazetted`}
            />
          </div>
          {data?.role === 'dataview' ? null : (
            <section className="border-line bg-paper rounded-xl border p-5 shadow-sm">
              <h2 className="mb-3 font-extrabold">Leave balances</h2>
              <ul className="grid gap-2 sm:grid-cols-3">
                {personal.leaves.map((item) => (
                  <li key={item.leave_type.name} className="bg-canvas rounded-md px-3 py-2 text-sm">
                    <span className="font-bold">{item.leave_type.name}</span>
                    <span className="text-mute block">
                      {item.allocated - item.used} remaining of {item.allocated}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}
          {data?.role === 'dataview' ? null : (
            <section className="border-line bg-paper rounded-xl border p-5 shadow-sm">
              <h2 className="mb-3 font-extrabold">Recent requests</h2>
              <ul className="space-y-2 text-sm">
                {personal.recentMedical.map((item) => (
                  <li key={item.id} className="flex items-center justify-between">
                    <span className="font-bold">
                      {item.kind} · {item.amount}
                    </span>
                    <Badge status={item.status} />
                  </li>
                ))}
                {personal.recentLeave.map((item) => (
                  <li key={item.id} className="flex items-center justify-between">
                    <span className="font-bold">
                      {item.leave_type.name} · {item.days} days
                    </span>
                    <Badge status={item.status} />
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      ) : null}
    </AppShell>
  );
}
