'use client';

import { useEffect, useState } from 'react';
import { PageFrame } from '@/components/page-frame';
import { Stat } from '@/components/widgets';
import { apiJson } from '@/lib/api';

export default function SalaryPage() {
  const [salary, setSalary] = useState<{
    basic: number;
    allowance: number;
    deduction: number;
    net: number;
  } | null>(null);
  const [benefits, setBenefits] = useState<{
    medical: { limit: number; used: number; remaining: number };
    opd: { limit: number; used: number; remaining: number };
  } | null>(null);
  const [leaves, setLeaves] = useState<{ allocated: number; used: number; leave_type: { name: string } }[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([
      apiJson<{ salary: { basic: number; allowance: number; deduction: number; net: number } }>(
        '/api/salary/me',
      ),
      apiJson<{
        medical: { limit: number; used: number; remaining: number };
        opd: { limit: number; used: number; remaining: number };
      }>('/api/benefits/balances'),
      apiJson<{ balances: { allocated: number; used: number; leave_type: { name: string } }[] }>(
        '/api/leave/balances',
      ),
    ])
      .then(([pay, allowance, leave]) => {
        setSalary(pay.salary);
        setBenefits(allowance);
        setLeaves(leave.balances);
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Could not load'));
  }, []);

  return (
    <PageFrame
      title="Pay & Benefits"
      description="Your salary and the medical allowance HR assigned. Claims are submitted under Requests."
    >
      {error ? <p className="text-danger text-sm font-bold">{error}</p> : null}
      {salary ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Basic" value={salary.basic.toLocaleString()} />
          <Stat label="Allowance" value={salary.allowance.toLocaleString()} />
          <Stat label="Deduction" value={salary.deduction.toLocaleString()} />
          <Stat label="Net pay" value={salary.net.toLocaleString()} />
        </div>
      ) : null}
      {benefits ? (
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Stat
            label="Medical remaining"
            value={benefits.medical.remaining}
            hint={`${benefits.medical.used} used of ${benefits.medical.limit}`}
          />
          <Stat
            label="OPD remaining"
            value={benefits.opd.remaining}
            hint={`${benefits.opd.used} used of ${benefits.opd.limit}`}
          />
        </div>
      ) : null}
      {leaves.length > 0 ? (
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          {leaves.map((item) => (
            <Stat
              key={item.leave_type.name}
              label={item.leave_type.name}
              value={item.allocated - item.used}
              hint={`${item.used} used of ${item.allocated}`}
            />
          ))}
        </div>
      ) : null}
    </PageFrame>
  );
}
