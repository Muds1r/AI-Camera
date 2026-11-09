'use client';

import { useEffect, useState } from 'react';
import { PageFrame } from '@/components/page-frame';
import { MetricStrip, Notice } from '@/components/widgets';
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
  const [leaves, setLeaves] = useState<
    { allocated: number; used: number; leave_type: { name: string } }[]
  >([]);
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
      description="Salary and allowance balances. Submit claims from Requests."
    >
      <Notice error={error} />
      {salary ? (
        <MetricStrip
          items={[
            { label: 'Basic', value: salary.basic.toLocaleString() },
            { label: 'Allowance', value: salary.allowance.toLocaleString() },
            { label: 'Deduction', value: salary.deduction.toLocaleString() },
            { label: 'Net pay', value: salary.net.toLocaleString() },
          ]}
        />
      ) : null}
      {benefits ? (
        <MetricStrip
          items={[
            {
              label: 'Medical remaining',
              value: benefits.medical.remaining,
              hint: `${benefits.medical.used} used of ${benefits.medical.limit}`,
            },
            {
              label: 'OPD remaining',
              value: benefits.opd.remaining,
              hint: `${benefits.opd.used} used of ${benefits.opd.limit}`,
            },
          ]}
        />
      ) : null}
      {leaves.length > 0 ? (
        <MetricStrip
          items={leaves.map((item) => ({
            label: item.leave_type.name,
            value: item.allocated - item.used,
            hint: `${item.used} used of ${item.allocated}`,
          }))}
        />
      ) : null}
    </PageFrame>
  );
}
