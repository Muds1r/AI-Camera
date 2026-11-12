'use client';

import { useEffect, useState } from 'react';
import {
  PageFrame,
  buttonClass,
  buttonSecondaryClass,
  fieldClass,
  formPanelClass,
  labelClass,
} from '@/components/page-frame';
import {
  Badge,
  ListRow,
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
  const [month, setMonth] = useState('');
  const [clockEnabled, setClockEnabled] = useState(true);
  const [hours, setHours] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [shiftLabel, setShiftLabel] = useState('day');
  const [fixDate, setFixDate] = useState('');
  const [fixStatus, setFixStatus] = useState('present');
  const [fixIn, setFixIn] = useState('');
  const [fixOut, setFixOut] = useState('');
  const [fixReason, setFixReason] = useState('');
  const [corrections, setCorrections] = useState<
    {
      id: string;
      work_date: string;
      requested_status: string;
      status: string;
      reason: string;
      review_note: string | null;
    }[]
  >([]);

  function load(next = month) {
    return apiJson<AttendanceView>(`/api/attendance/me?month=${next}`).then(setData);
  }

  useEffect(() => {
    const active = month || new Date().toISOString().slice(0, 7);
    const timer = window.setTimeout(() => {
      setMonth((current) => current || active);
    }, 0);
    if (!month) return () => window.clearTimeout(timer);
    Promise.all([
      apiJson<{ user: { clock_enabled: boolean; shift: 'day' | 'night' } }>('/api/users/me'),
      apiJson<{
        company: { work_start: string; work_end: string; night_start: string; night_end: string };
      }>('/api/company'),
      apiJson<{
        requests: {
          id: string;
          work_date: string;
          requested_status: string;
          status: string;
          reason: string;
          review_note: string | null;
        }[];
      }>('/api/attendance-corrections'),
    ])
      .then(([me, company, corrections]) => {
        setClockEnabled(me.user.clock_enabled);
        setShiftLabel(me.user.shift);
        const window =
          me.user.shift === 'night'
            ? `${company.company.night_start}–${company.company.night_end}`
            : `${company.company.work_start}–${company.company.work_end}`;
        setHours(window);
        setCorrections(corrections.requests);
      })
      .catch(() => undefined);
    load(month).catch((err: unknown) =>
      setError(err instanceof Error ? err.message : 'Could not load'),
    );
    return () => window.clearTimeout(timer);
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
      description={
        hours
          ? `Your ${shiftLabel} shift. Clock in once per day between ${hours}.`
          : 'Clock in once per day during your shift.'
      }
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
              disabled={!data?.today?.clock_in || Boolean(data.today.clock_out)}
              onClick={() => clock('/api/attendance/clock-out')}
            >
              {data?.today?.clock_out ? 'Clocked out' : 'Clock out'}
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
                label: 'Weekends & holidays',
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

      <form
        className={`${formPanelClass} max-w-2xl`}
        onSubmit={(event) => {
          event.preventDefault();
          setError('');
          setMessage('');
          apiJson('/api/attendance-corrections', {
            method: 'POST',
            body: JSON.stringify({
              work_date: fixDate,
              status: fixStatus,
              clock_in: fixIn || undefined,
              clock_out: fixOut || undefined,
              reason: fixReason,
            }),
          })
            .then(() => {
              setMessage('Correction sent to HR.');
              setFixReason('');
              return apiJson<{
                requests: {
                  id: string;
                  work_date: string;
                  requested_status: string;
                  status: string;
                  reason: string;
                  review_note: string | null;
                }[];
              }>('/api/attendance-corrections');
            })
            .then((res) => setCorrections(res.requests))
            .catch((err: unknown) =>
              setError(err instanceof Error ? err.message : 'Could not submit'),
            );
        }}
      >
        <h2 className="text-ink text-sm font-semibold md:col-span-2">Ask HR to correct a day</h2>
        <p className="text-mute text-sm md:col-span-2">
          Use this if you forgot to clock in, forgot to clock out, or clocked in late even though
          you were already there.
        </p>
        <input
          className={fieldClass}
          type="date"
          required
          aria-label="Date to correct"
          value={fixDate}
          onChange={(event) => setFixDate(event.target.value)}
        />
        <select
          className={fieldClass}
          aria-label="Correct status"
          value={fixStatus}
          onChange={(event) => setFixStatus(event.target.value)}
        >
          <option value="present">I was on time</option>
          <option value="late">I was late</option>
          <option value="half_day">Half day</option>
          <option value="absent">I was absent</option>
        </select>
        <input
          className={fieldClass}
          type="time"
          aria-label="Clock in time"
          value={fixIn}
          onChange={(event) => setFixIn(event.target.value)}
        />
        <input
          className={fieldClass}
          type="time"
          aria-label="Clock out time"
          value={fixOut}
          onChange={(event) => setFixOut(event.target.value)}
        />
        <textarea
          className={`${fieldClass} min-h-20 md:col-span-2`}
          required
          placeholder="What happened"
          maxLength={2000}
          value={fixReason}
          onChange={(event) => setFixReason(event.target.value)}
        />
        <button className={buttonClass} type="submit">
          Send to HR
        </button>
      </form>
      {corrections.length > 0 ? (
        <div className="space-y-2">
          {corrections.map((item) => (
            <ListRow
              key={item.id}
              title={`${item.work_date.slice(0, 10)} · ${item.requested_status.replace('_', ' ')}`}
              detail={`${item.reason}${item.review_note ? ` · ${item.review_note}` : ''}`}
              status={item.status}
            />
          ))}
        </div>
      ) : null}
    </PageFrame>
  );
}
