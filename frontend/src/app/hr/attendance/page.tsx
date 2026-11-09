'use client';

import { FormEvent, useEffect, useState } from 'react';
import {
  PageFrame,
  buttonClass,
  buttonSecondaryClass,
  fieldClass,
  formPanelClass,
  cardClass,
  tabActiveClass,
  tabBarClass,
  tabIdleClass,
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

type Tab = 'team' | 'mine' | 'holidays';

interface Row {
  id: string;
  work_date: string;
  status: string;
  clock_in: string | null;
  clock_out: string | null;
  user: { full_name: string; department: string | null };
}

interface Mine {
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

interface Holiday {
  id: string;
  holiday_on: string;
  name: string;
  kind: 'gazetted' | 'general_off';
}

const TABS: { id: Tab; label: string }[] = [
  { id: 'team', label: 'Team' },
  { id: 'mine', label: 'My attendance' },
  { id: 'holidays', label: 'Gazette & holidays' },
];

export default function TeamAttendancePage() {
  const [tab, setTab] = useState<Tab>('team');
  const [rows, setRows] = useState<Row[]>([]);
  const [clockedIn, setClockedIn] = useState(0);
  const [query, setQuery] = useState('');
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [status, setStatus] = useState('');
  const [range, setRange] = useState<'month' | 'week' | 'today'>('month');
  const [mine, setMine] = useState<Mine | null>(null);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [date, setDate] = useState('');
  const [name, setName] = useState('');
  const [kind, setKind] = useState<'gazetted' | 'general_off'>('gazetted');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  function loadTeam(q = query, nextMonth = month) {
    return apiJson<{ records: Row[]; clockedIn: Row[] }>(
      `/api/attendance?month=${nextMonth}&q=${encodeURIComponent(q)}`,
    ).then((data) => {
      setRows(data.records);
      setClockedIn(data.clockedIn.length);
    });
  }

  useEffect(() => {
    Promise.all([
      loadTeam(''),
      apiJson<Mine>('/api/attendance/me').then(setMine),
      apiJson<{ holidays: Holiday[] }>('/api/holidays').then((data) => setHolidays(data.holidays)),
    ]).catch((err: unknown) => setError(err instanceof Error ? err.message : 'Could not load'));
    // Initial load only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function clock(path: string) {
    setError('');
    setMessage('');
    try {
      await apiJson(path, { method: 'POST' });
      setMessage(path.endsWith('clock-in') ? 'Clocked in.' : 'Clocked out.');
      setMine(await apiJson<Mine>('/api/attendance/me'));
      await loadTeam();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update attendance');
    }
  }

  async function saveHoliday(event: FormEvent) {
    event.preventDefault();
    setError('');
    try {
      await apiJson('/api/holidays', {
        method: 'POST',
        body: JSON.stringify({ date, name, kind }),
      });
      setMessage('Holiday saved.');
      setName('');
      const data = await apiJson<{ holidays: Holiday[] }>('/api/holidays');
      setHolidays(data.holidays);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save');
    }
  }

  return (
    <PageFrame
      title="Attendance"
      description="Team records, your own clock in and out, and gazette or general off days."
    >
      <Notice error={error} message={message} />
      <div className={tabBarClass}>
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id)}
            className={tab === item.id ? tabActiveClass : tabIdleClass}
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === 'team' ? (
        <>
          <MetricStrip items={[{ label: 'Clocked in now', value: clockedIn }]} />
          <div className="mb-4 flex flex-wrap gap-2">
            <input
              className={`${fieldClass} max-w-48`}
              type="month"
              value={month}
              onChange={(event) => {
                setMonth(event.target.value);
                loadTeam(query, event.target.value).catch(() => undefined);
              }}
            />
            <select
              className={`${fieldClass} max-w-40`}
              value={range}
              onChange={(event) => setRange(event.target.value as 'month' | 'week' | 'today')}
            >
              <option value="month">This month</option>
              <option value="week">This week</option>
              <option value="today">Today</option>
            </select>
            <select
              className={`${fieldClass} max-w-40`}
              value={status}
              onChange={(event) => setStatus(event.target.value)}
            >
              <option value="">Any status</option>
              <option value="present">Present</option>
              <option value="late">Late</option>
              <option value="absent">Absent</option>
            </select>
          </div>
          <input
            className={`${fieldClass} mb-4 max-w-sm`}
            placeholder="Search employee"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              loadTeam(event.target.value).catch(() => undefined);
            }}
          />
          <div className={tableWrapClass}>
            <table className={tableClass}>
              <thead className={tableHeadClass}>
                <tr>
                  <th className="px-4 py-3">Employee</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">In / out</th>
                </tr>
              </thead>
              <tbody>
                {rows
                  .filter((row) => !status || row.status === status)
                  .filter((row) => {
                    const day = row.work_date.slice(0, 10);
                    const today = new Date().toISOString().slice(0, 10);
                    if (range === 'today') return day === today;
                    if (range === 'week') {
                      const date = new Date(`${day}T00:00:00Z`);
                      const now = new Date();
                      const start = new Date(
                        Date.UTC(
                          now.getUTCFullYear(),
                          now.getUTCMonth(),
                          now.getUTCDate() - now.getUTCDay(),
                        ),
                      );
                      return date >= start;
                    }
                    return true;
                  })
                  .map((row) => (
                    <tr key={row.id} className={tableRowClass}>
                      <td className="px-4 py-3 font-bold">
                        {row.user.full_name}
                        <span className="text-mute block font-medium">
                          {row.user.department || ''}
                        </span>
                      </td>
                      <td className="px-4 py-3">{row.work_date.slice(0, 10)}</td>
                      <td className="px-4 py-3">
                        <Badge status={row.status} />
                      </td>
                      <td className="px-4 py-3">
                        {row.clock_in ? new Date(row.clock_in).toLocaleTimeString() : '—'} /{' '}
                        {row.clock_out ? new Date(row.clock_out).toLocaleTimeString() : '—'}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </>
      ) : null}

      {tab === 'mine' && mine ? (
        <>
          <div className="mb-4 flex gap-2">
            <button
              className={buttonClass}
              type="button"
              disabled={Boolean(mine.today?.clock_in)}
              onClick={() => clock('/api/attendance/clock-in')}
            >
              {mine.today?.clock_in ? 'Clocked in today' : 'Clock in'}
            </button>
            <button
              className={buttonSecondaryClass}
              type="button"
              onClick={() => clock('/api/attendance/clock-out')}
            >
              Clock out
            </button>
          </div>
          <MetricStrip
            items={[
              { label: 'Today', value: mine.today?.status ?? 'Not clocked in' },
              { label: 'Working days', value: mine.summary.workingDays },
              {
                label: 'Sundays',
                value: mine.summary.sundays,
                hint: `${mine.summary.gazetted} gazetted · ${mine.summary.generalOff} off`,
              },
              {
                label: 'Present / late / absent',
                value: `${mine.summary.present} / ${mine.summary.late} / ${mine.summary.absent}`,
              },
            ]}
          />
        </>
      ) : null}

      {tab === 'holidays' ? (
        <>
          <form onSubmit={saveHoliday} className={`${formPanelClass} mb-6 md:grid-cols-4`}>
            <input
              className={fieldClass}
              type="date"
              required
              value={date}
              onChange={(event) => setDate(event.target.value)}
            />
            <input
              className={fieldClass}
              required
              placeholder="Name"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
            <select
              className={fieldClass}
              value={kind}
              onChange={(event) => setKind(event.target.value as 'gazetted' | 'general_off')}
            >
              <option value="gazetted">Gazetted</option>
              <option value="general_off">General off</option>
            </select>
            <button className={buttonClass} type="submit">
              Save
            </button>
          </form>
          <ul className="space-y-2">
            {holidays.map((holiday) => (
              <li
                key={holiday.id}
                className={`${cardClass} flex justify-between px-4 py-3 text-sm`}
              >
                <span className="font-bold">
                  {holiday.holiday_on.slice(0, 10)} · {holiday.name}
                </span>
                <span className="flex items-center gap-3">
                  <span className="text-mute">
                    {holiday.kind === 'gazetted' ? 'Gazetted' : 'General off'}
                  </span>
                  <button
                    type="button"
                    className="text-danger font-bold"
                    onClick={() => {
                      apiJson(`/api/holidays/${holiday.id}`, { method: 'DELETE' })
                        .then(() => apiJson<{ holidays: Holiday[] }>('/api/holidays'))
                        .then((data) => setHolidays(data.holidays))
                        .catch((err: unknown) =>
                          setError(err instanceof Error ? err.message : 'Could not remove'),
                        );
                    }}
                  >
                    Remove
                  </button>
                </span>
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </PageFrame>
  );
}
