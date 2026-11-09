'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { PageFrame, linkMutedClass } from '@/components/page-frame';
import { Stat } from '@/components/widgets';
import { apiJson } from '@/lib/api';

export default function HrHome() {
  const [hr, setHr] = useState<{
    employees: number;
    inactive: number;
    clockedIn: number;
    pendingMedical: number;
    pendingLeave: number;
    pendingProfile: number;
  } | null>(null);

  useEffect(() => {
    apiJson<{
      hr?: {
        employees: number;
        inactive: number;
        clockedIn: number;
        pendingMedical: number;
        pendingLeave: number;
        pendingProfile: number;
      };
    }>('/api/dashboard').then((data) => setHr(data.hr ?? null));
  }, []);

  return (
    <PageFrame title="HR desk" description="People, attendance, and the requests waiting on you.">
      {hr ? (
        <div className="grid gap-4 sm:grid-cols-3">
          <Stat label="Active employees" value={hr.employees} />
          <Stat label="Inactive" value={hr.inactive} />
          <Stat label="Clocked in" value={hr.clockedIn} />
          <Stat label="Medical / OPD pending" value={hr.pendingMedical} />
          <Stat label="Leave pending" value={hr.pendingLeave} />
          <Stat label="Profile updates" value={hr.pendingProfile} />
        </div>
      ) : (
        <p className="text-mute">Loading…</p>
      )}
      <div className="mt-6 flex flex-wrap gap-3 text-sm font-bold">
        <Link className={linkMutedClass} href="/hr/employees">
          Employees
        </Link>
        <Link className={linkMutedClass} href="/hr/attendance">
          Attendance
        </Link>
        <Link className={linkMutedClass} href="/hr/holidays">
          Holidays
        </Link>
        <Link className={linkMutedClass} href="/hr/requests">
          Approvals
        </Link>
        <Link className={linkMutedClass} href="/hr/company">
          Company
        </Link>
      </div>
    </PageFrame>
  );
}
