'use client';

import { useEffect, useState } from 'react';
import {
  PageFrame,
  buttonDangerClass,
  buttonSuccessClass,
  cardClass,
  fieldClass,
  tabActiveClass,
  tabBarClass,
  tabIdleClass,
  linkMutedClass,
} from '@/components/page-frame';
import { Badge, ConfirmDialog, Notice } from '@/components/widgets';
import { apiJson } from '@/lib/api';

type Tab = 'medical' | 'opd' | 'leave' | 'profile';

interface Row {
  id: string;
  status: string;
  title: string;
  detail: string;
  document_url?: string | null;
  review_note?: string | null;
}

const PROFILE_LABELS: Record<string, string> = {
  full_name: 'Name',
  phone: 'Phone',
  secondary_email: 'Secondary email',
  date_of_birth: 'Date of birth',
  gender: 'Gender',
  blood_group: 'Blood group',
  id_card_number: 'ID card',
  address: 'Address',
  emergency_contact_name: 'Emergency contact',
  emergency_contact_phone: 'Emergency phone',
  department: 'Department',
  designation: 'Designation',
  info: 'Notes',
  avatar_url: 'Picture',
};

function profileChangeDetail(changes: Record<string, string | null>) {
  return Object.entries(changes)
    .map(([key, value]) => {
      const label = PROFILE_LABELS[key] ?? key.replaceAll('_', ' ');
      if (key === 'avatar_url') return `${label}: updated`;
      if (!value) return `${label}: cleared`;
      if (key === 'gender') return `${label}: ${value.charAt(0).toUpperCase()}${value.slice(1)}`;
      return `${label}: ${value}`;
    })
    .join(' · ');
}

const TABS: { id: Tab; label: string }[] = [
  { id: 'medical', label: 'Medical' },
  { id: 'opd', label: 'OPD' },
  { id: 'leave', label: 'Leave' },
  { id: 'profile', label: 'Profile updates' },
];

export default function ApprovalsPage() {
  const [tab, setTab] = useState<Tab>('medical');
  const [rows, setRows] = useState<Row[]>([]);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [pending, setPending] = useState<{ id: string; status: 'approved' | 'rejected' } | null>(
    null,
  );
  const [note, setNote] = useState('');

  function load(next = tab, filters = { query, status, from, to }) {
    const params = new URLSearchParams({ scope: 'queue' });
    if (filters.status) params.set('status', filters.status);
    if (filters.query) params.set('q', filters.query);
    if (filters.from) params.set('from', filters.from);
    if (filters.to) params.set('to', filters.to);
    if (next === 'medical' || next === 'opd') {
      params.set('kind', next);
      return apiJson<{
        requests: {
          id: string;
          status: string;
          kind: string;
          amount: number;
          reason: string;
          document_url: string | null;
          review_note: string | null;
          requester: { full_name: string };
        }[];
      }>(`/api/benefits?${params}`).then((data) =>
        setRows(
          data.requests.map((item) => ({
            id: item.id,
            status: item.status,
            title: `${item.requester.full_name} · ${item.amount}`,
            detail: item.reason,
            document_url: item.document_url,
            review_note: item.review_note,
          })),
        ),
      );
    }
    if (next === 'leave') {
      return apiJson<{
        requests: {
          id: string;
          status: string;
          days: number;
          reason: string;
          review_note: string | null;
          start_date: string;
          requester: { full_name: string };
          leave_type: { name: string };
        }[];
      }>(`/api/leave?${params}`).then((data) =>
        setRows(
          data.requests.map((item) => ({
            id: item.id,
            status: item.status,
            title: `${item.requester.full_name} · ${item.leave_type.name} · ${item.days} days`,
            detail: `${item.start_date.slice(0, 10)} · ${item.reason}`,
            review_note: item.review_note,
          })),
        ),
      );
    }
    return apiJson<{
      requests: {
        id: string;
        status: string;
        review_note: string | null;
        requester: { full_name: string };
        changes: Record<string, string | null>;
      }[];
    }>(`/api/profile-requests?${params}`).then((data) =>
      setRows(
        data.requests.map((item) => ({
          id: item.id,
          status: item.status,
          title: item.requester.full_name,
          detail: profileChangeDetail(item.changes),
          review_note: item.review_note,
        })),
      ),
    );
  }

  useEffect(() => {
    load('medical', { query: '', status: '', from: '', to: '' }).catch((err: unknown) =>
      setError(err instanceof Error ? err.message : 'Could not load'),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function review() {
    if (!pending) return;
    setError('');
    setMessage('');
    const path =
      tab === 'medical' || tab === 'opd'
        ? `/api/benefits/${pending.id}`
        : tab === 'leave'
          ? `/api/leave/${pending.id}`
          : `/api/profile-requests/${pending.id}`;
    try {
      await apiJson(path, {
        method: 'PATCH',
        body: JSON.stringify({ status: pending.status, review_note: note }),
      });
      setMessage(`Request ${pending.status}.`);
      setPending(null);
      setNote('');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not review');
    }
  }

  return (
    <PageFrame
      title="Requests & Approvals"
      description="Review medical, leave, and profile updates. You cannot approve your own."
    >
      <Notice error={error} message={message} />
      <div className={tabBarClass}>
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            className={tab === item.id ? tabActiveClass : tabIdleClass}
            onClick={() => {
              setTab(item.id);
              load(item.id).catch(() => undefined);
            }}
          >
            {item.label}
          </button>
        ))}
      </div>
      <div className="mb-4 flex flex-wrap gap-2">
        <input
          className={`${fieldClass} max-w-xs`}
          placeholder="Employee name"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            load(tab, { query: event.target.value, status, from, to }).catch(() => undefined);
          }}
        />
        <select
          className={`${fieldClass} max-w-40`}
          value={status}
          onChange={(event) => {
            setStatus(event.target.value);
            load(tab, { query, status: event.target.value, from, to }).catch(() => undefined);
          }}
        >
          <option value="">Any status</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
        </select>
        <input
          className={`${fieldClass} max-w-40`}
          type="date"
          aria-label="From date"
          value={from}
          onChange={(event) => {
            setFrom(event.target.value);
            load(tab, { query, status, from: event.target.value, to }).catch(() => undefined);
          }}
        />
        <input
          className={`${fieldClass} max-w-40`}
          type="date"
          aria-label="To date"
          value={to}
          onChange={(event) => {
            setTo(event.target.value);
            load(tab, { query, status, from, to: event.target.value }).catch(() => undefined);
          }}
        />
      </div>
      {rows.length === 0 ? (
        <p className="text-mute text-sm">No requests match these filters.</p>
      ) : null}
      <ul className="space-y-2">
        {rows.map((row) => (
          <li key={row.id} className={`${cardClass} p-4 text-sm`}>
            <div className="flex items-center justify-between gap-3">
              <p className="font-medium">{row.title}</p>
              <Badge status={row.status} />
            </div>
            <p className="text-mute mt-1">{row.detail}</p>
            {row.review_note ? <p className="mt-1 text-sm">Note: {row.review_note}</p> : null}
            {row.document_url ? (
              <a className={`${linkMutedClass} mt-1 inline-block`} href={row.document_url}>
                View document
              </a>
            ) : null}
            {row.status === 'pending' ? (
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  className={`${buttonSuccessClass} px-3 py-1.5 text-xs`}
                  onClick={() => {
                    setNote('');
                    setPending({ id: row.id, status: 'approved' });
                  }}
                >
                  Approve
                </button>
                <button
                  type="button"
                  className={`${buttonDangerClass} px-3 py-1.5 text-xs`}
                  onClick={() => {
                    setNote('');
                    setPending({ id: row.id, status: 'rejected' });
                  }}
                >
                  Reject
                </button>
              </div>
            ) : null}
          </li>
        ))}
      </ul>
      <ConfirmDialog
        open={Boolean(pending)}
        title={pending?.status === 'rejected' ? 'Reject this request?' : 'Approve this request?'}
        detail={
          pending?.status === 'rejected'
            ? 'A reason is required. Their balance and profile stay as they are.'
            : 'Approved medical and leave requests update the remaining balances.'
        }
        confirmLabel={pending?.status === 'rejected' ? 'Reject' : 'Approve'}
        tone={pending?.status === 'rejected' ? 'danger' : 'teal'}
        onClose={() => setPending(null)}
        onConfirm={() => review()}
      >
        {pending?.status === 'rejected' ? (
          <textarea
            className={`${fieldClass} mt-3 min-h-20`}
            placeholder="Rejection reason"
            value={note}
            onChange={(event) => setNote(event.target.value)}
          />
        ) : null}
      </ConfirmDialog>
    </PageFrame>
  );
}
