'use client';

import { useEffect, useState } from 'react';
import { PageFrame, fieldClass } from '@/components/page-frame';
import { PayslipView, type Payslip } from '@/components/payslip-view';
import { Notice } from '@/components/widgets';
import { apiJson } from '@/lib/api';

function currentMonth() {
  return new Date().toISOString().slice(0, 7);
}

export default function SalaryPage() {
  const [month, setMonth] = useState('');
  const [slip, setSlip] = useState<Payslip | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setMonth((current) => current || currentMonth());
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!month) return;
    apiJson<{ payslip: Payslip }>(`/api/payslips/me?month=${month}`)
      .then((data) => {
        setSlip(data.payslip);
        setError('');
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Could not load'));
  }, [month]);

  return (
    <PageFrame
      title="Payslip"
      description="Pay for the selected month, after attendance, unpaid leave, overtime, and approved claims."
      actions={
        <label className="text-mute flex items-center gap-2 text-xs font-medium">
          Month
          <input
            className={`${fieldClass} w-auto`}
            type="month"
            aria-label="Payslip month"
            value={month}
            onChange={(event) => setMonth(event.target.value)}
          />
        </label>
      }
    >
      <Notice error={error} />
      {slip ? <PayslipView slip={slip} /> : null}
    </PageFrame>
  );
}
