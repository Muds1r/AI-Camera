'use client';

import { useEffect, useState } from 'react';
import { PageFrame, buttonClass, buttonSecondaryClass, fieldClass } from '@/components/page-frame';
import { Badge, Notice, Stat } from '@/components/widgets';
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
      .then((data) => setClockEnabled(data.user.clock_enabled))
      .catch(() => undefined);
    load(month).catch((err: unknown) =>
      setError(err instanceof Error ? err.message : 'Could not load'),
    );
    // Month changes reload the history. The clock flag is read once with that load.
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
      title="My attendance"
      description="Clock in once per day between 9:00 AM and 5:00 PM (optional clock out). HR can see your clock-in time on the team report."
    >
      <Notice error={error} message={message} />
      <input
        className={`${fieldClass} mb-4 max-w-48`}
        type="month"
        value={month}
        onChange={(event) => setMonth(event.target.value)}
      />
      {clockEnabled ? (
        <div className="mb-4 flex gap-2">
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
        <p className="text-mute mb-4 text-sm">Clock in is not enabled for this account.</p>
      )}
      {data ? (
        <>
          <div className="mb-6 grid gap-4 sm:grid-cols-4">
            <Stat label="Today" value={data.today?.status ?? 'Not clocked in'} />
            <Stat label="Working days" value={data.summary.workingDays} />
            <Stat
              label="Sundays"
              value={data.summary.sundays}
              hint={`${data.summary.gazetted} gazetted · ${data.summary.generalOff} off`}
            />
            <Stat
              label="Present / late / absent"
              value={`${data.summary.present} / ${data.summary.late} / ${data.summary.absent}`}
            />
          </div>
          <div className="border-line bg-paper overflow-hidden rounded-xl border shadow-sm">
            <table className="w-full text-left text-sm">
              <thead className="bg-surface text-mute text-xs font-bold uppercase">
                <tr>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">In</th>
                  <th className="px-4 py-3">Out</th>
                </tr>
              </thead>
              <tbody>
                {data.records.map((row) => (
                  <tr key={row.id} className="border-line border-t">
                    <td className="px-4 py-3 font-bold">{row.work_date.slice(0, 10)}</td>
                    <td className="px-4 py-3">
                      <Badge status={row.status} />
                    </td>
                    <td className="px-4 py-3">
                      {row.clock_in ? new Date(row.clock_in).toLocaleTimeString() : '—'}
                    </td>
                    <td className="px-4 py-3">
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
