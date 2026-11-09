'use client';

import { useEffect, useState } from 'react';
import {
  PageFrame,
  buttonClass,
  buttonSecondaryClass,
  fieldClass,
  labelClass,
} from '@/components/page-frame';
import {
  Badge,
  MetricStrip,
  Notice,
  tableClass,
  tableHeadClass,
  tableRowClass,
  tableWrapClass,
} from '@/components/widgets';
import { apiJson } from '@/lib/api';

interface AttendanceView {
  summary: {
    workingDays: number;
    sundays: number;
    gazetted: number;
    generalOff: number;
    present: number;
    late: number;
    absent: number;
  };
  today: { status: string; clock_in: string | null; clock_out: string | null } | null;
  records: {
    id: string;
    work_date: string;
    status: string;
    clock_in: string | null;
    clock_out: string | null;
  }[];
}

export default function AttendancePage() {
  const [data, setData] = useState<AttendanceView | null>(null);
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [clockEnabled, setClockEnabled] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  function load(next = month) {
    return apiJson<AttendanceView>(`/api/attendance/me?month=${next}`).then(setData);
  }

  useEffect(() => {
    apiJson<{ user: { clock_enabled: boolean } }>('/api/users/me')
      .then((res) => setClockEnabled(res.user.clock_enabled))
      .catch(() => undefined);
    load(month).catch((err: unknown) =>
      setError(err instanceof Error ? err.message : 'Could not load'),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month]);

  async function clock(path: string) {
    setError('');
    setMessage('');
    try {
      await apiJson(path, { method: 'POST' });
      setMessage(path.endsWith('clock-in') ? 'Clocked in.' : 'Clocked out.');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update attendance');
    }
  }

  return (
    <PageFrame
      title="Attendance"
      description="Clock in once per day between 9:00 AM and 5:00 PM. HR can view your clock-in on the team report."
    >
      <Notice error={error} message={message} />

      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className={labelClass}>Month</label>
          <input
            className={`${fieldClass} w-40`}
            type="month"
            value={month}
            onChange={(event) => setMonth(event.target.value)}
          />
        </div>
        {clockEnabled ? (
          <div className="flex gap-2 pb-0.5">
            <button
              className={buttonClass}
              type="button"
              disabled={Boolean(data?.today?.clock_in)}
              onClick={() => clock('/api/attendance/clock-in')}
            >
              {data?.today?.clock_in ? 'Clocked in today' : 'Clock in'}
            </button>
            <button
              className={buttonSecondaryClass}
              type="button"
              onClick={() => clock('/api/attendance/clock-out')}
            >
              Clock out
            </button>
          </div>
        ) : (
          <p className="text-mute text-sm">Clock in is not enabled for this account.</p>
        )}
      </div>

      {data ? (
        <>
          <MetricStrip
            items={[
              { label: 'Today', value: data.today?.status ?? 'Not clocked in' },
              { label: 'Working days', value: data.summary.workingDays },
              {
                label: 'Sundays & holidays',
                value: data.summary.sundays + data.summary.gazetted + data.summary.generalOff,
                hint: `${data.summary.gazetted} gazetted · ${data.summary.generalOff} general off`,
              },
              {
                label: 'Present / late / absent',
                value: `${data.summary.present} / ${data.summary.late} / ${data.summary.absent}`,
              },
            ]}
          />

          <div className={tableWrapClass}>
            <table className={tableClass}>
              <thead className={tableHeadClass}>
                <tr>
                  <th className="px-4 py-2.5 font-medium">Date</th>
                  <th className="px-4 py-2.5 font-medium">Status</th>
                  <th className="px-4 py-2.5 font-medium">In</th>
                  <th className="px-4 py-2.5 font-medium">Out</th>
                </tr>
              </thead>
              <tbody>
                {data.records.map((row) => (
                  <tr key={row.id} className={tableRowClass}>
                    <td className="px-4 py-2.5">{row.work_date.slice(0, 10)}</td>
                    <td className="px-4 py-2.5">
                      <Badge status={row.status} />
                    </td>
                    <td className="text-mute px-4 py-2.5 tabular-nums">
                      {row.clock_in ? new Date(row.clock_in).toLocaleTimeString() : '—'}
                    </td>
                    <td className="text-mute px-4 py-2.5 tabular-nums">
                      {row.clock_out ? new Date(row.clock_out).toLocaleTimeString() : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : null}
    </PageFrame>
  );
}
