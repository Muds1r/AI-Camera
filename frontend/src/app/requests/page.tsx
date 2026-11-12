'use client';

import { FormEvent, useEffect, useState } from 'react';
import { DateField } from '@/components/date-field';
import {
  PageFrame,
  buttonClass,
  fieldClass,
  formPanelClass,
  labelClass,
  tabActiveClass,
  tabBarClass,
  tabIdleClass,
} from '@/components/page-frame';
import { EmptyState, ListRow, MetricStrip, Notice } from '@/components/widgets';
import { apiJson } from '@/lib/api';
import { documentFileError } from '@/lib/fields';

type Tab = 'benefits' | 'leave';

interface Benefit {
  id: string;
  kind: string;
  amount: number;
  reason: string;
  status: string;
  review_note: string | null;
  document_url: string | null;
}

interface Allowance {
  medical: { limit: number; used: number; remaining: number };
  opd: { limit: number; used: number; remaining: number };
}

interface Balance {
  id: string;
  allocated: number;
  used: number;
  leave_type: { id: string; name: string };
}

interface LeaveItem {
  id: string;
  days: number;
  reason: string;
  status: string;
  start_date: string;
  end_date: string;
  review_note: string | null;
  leave_type: { name: string };
}

export default function RequestsPage() {
  const [tab, setTab] = useState<Tab>('benefits');
  const [benefits, setBenefits] = useState<Benefit[]>([]);
  const [allowance, setAllowance] = useState<Allowance | null>(null);
  const [balances, setBalances] = useState<Balance[]>([]);
  const [leaves, setLeaves] = useState<LeaveItem[]>([]);
  const [kind, setKind] = useState<'medical' | 'opd'>('medical');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [typeId, setTypeId] = useState('');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  function load() {
    return Promise.all([
      apiJson<{ requests: Benefit[] }>('/api/benefits'),
      apiJson<Allowance>('/api/benefits/balances'),
      apiJson<{ balances: Balance[] }>('/api/leave/balances'),
      apiJson<{ requests: LeaveItem[] }>('/api/leave'),
    ]).then(([claims, remaining, leaveBalances, leaveRequests]) => {
      setBenefits(claims.requests);
      setAllowance(remaining);
      setBalances(leaveBalances.balances);
      setTypeId((current) => current || leaveBalances.balances[0]?.leave_type.id || '');
      setLeaves(leaveRequests.requests);
    });
  }

  useEffect(() => {
    load().catch((err: unknown) => setError(err instanceof Error ? err.message : 'Could not load'));
  }, []);

  async function submitClaim(event: FormEvent) {
    event.preventDefault();
    setError('');
    setMessage('');
    try {
      let documentUrl: string | undefined;
      if (file) {
        const form = new FormData();
        form.append('document', file);
        const uploaded = await apiJson<{ document_url: string }>('/api/benefits/document', {
          method: 'POST',
          body: form,
        });
        documentUrl = uploaded.document_url;
      }
      await apiJson('/api/benefits', {
        method: 'POST',
        body: JSON.stringify({
          kind,
          amount: Number(amount),
          reason,
          document_url: documentUrl,
        }),
      });
      setAmount('');
      setReason('');
      setFile(null);
      setMessage('Request submitted.');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not submit');
    }
  }

  async function submitLeave(event: FormEvent) {
    event.preventDefault();
    setError('');
    setMessage('');
    try {
      await apiJson('/api/leave', {
        method: 'POST',
        body: JSON.stringify({ leave_type_id: typeId, start_date: start, end_date: end, reason }),
      });
      setReason('');
      setMessage('Leave request submitted.');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not submit');
    }
  }

  const visible = benefits.filter((item) => item.kind === kind);

  return (
    <PageFrame
      title="Requests"
      description="Medical, OPD, and leave requests for your own account."
    >
      <Notice error={error} message={message} />
      <div className={tabBarClass}>
        {(
          [
            ['benefits', 'Medical & OPD'],
            ['leave', 'Leave'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={tab === id ? tabActiveClass : tabIdleClass}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'leave' ? (
        <>
          {balances.length > 0 ? (
            <MetricStrip
              items={balances.map((item) => ({
                label: item.leave_type.name,
                value: item.allocated - item.used,
                hint: `${item.used} used of ${item.allocated}`,
              }))}
            />
          ) : null}
          <form onSubmit={submitLeave} className={`${formPanelClass} mb-6 md:grid-cols-2`}>
            <select
              className={fieldClass}
              value={typeId}
              onChange={(event) => setTypeId(event.target.value)}
            >
              {balances.map((item) => (
                <option key={item.leave_type.id} value={item.leave_type.id}>
                  {item.leave_type.name}
                </option>
              ))}
            </select>
            <DateField
              required
              placeholder="Enter leave start date"
              value={start}
              onChange={setStart}
            />
            <DateField required placeholder="Enter leave end date" value={end} onChange={setEnd} />
            <textarea
              className={`${fieldClass} min-h-20 md:col-span-2`}
              required
              placeholder="Enter reason"
              maxLength={2000}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            />
            <button className={buttonClass} type="submit">
              Submit leave
            </button>
          </form>
          <History
            rows={leaves.map((item) => ({
              id: item.id,
              title: `${item.leave_type.name} · ${item.days} days`,
              detail: `${item.start_date.slice(0, 10)} to ${item.end_date.slice(0, 10)}${item.review_note ? ` · ${item.review_note}` : ''}`,
              status: item.status,
            }))}
          />
        </>
      ) : (
        <>
          {allowance ? (
            <MetricStrip
              items={[
                {
                  label: 'Medical remaining',
                  value: allowance.medical.remaining,
                  hint: `${allowance.medical.used} used of ${allowance.medical.limit}`,
                },
                {
                  label: 'OPD remaining',
                  value: allowance.opd.remaining,
                  hint: `${allowance.opd.used} used of ${allowance.opd.limit}`,
                },
              ]}
            />
          ) : null}
          <form onSubmit={submitClaim} className={`${formPanelClass} mb-6 md:grid-cols-2`}>
            <select
              className={fieldClass}
              value={kind}
              onChange={(event) => setKind(event.target.value as 'medical' | 'opd')}
            >
              <option value="medical">Medical</option>
              <option value="opd">OPD</option>
            </select>
            <input
              className={fieldClass}
              type="number"
              min="1"
              required
              placeholder="Amount"
              max={10000000}
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
            />
            <textarea
              className={`${fieldClass} min-h-20 md:col-span-2`}
              required
              placeholder="Reason"
              maxLength={2000}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            />
            <label className={`${labelClass} md:col-span-2`}>
              Supporting document
              <input
                className={`${fieldClass} mt-1`}
                type="file"
                accept="image/jpeg,image/png,image/webp,application/pdf,.jpg,.jpeg,.png,.webp,.pdf"
                onChange={(event) => {
                  const next = event.target.files?.[0] ?? null;
                  if (!next) {
                    setFile(null);
                    return;
                  }
                  const message = documentFileError(next);
                  if (message) {
                    setError(message);
                    event.target.value = '';
                    setFile(null);
                    return;
                  }
                  setError('');
                  setFile(next);
                }}
              />
            </label>
            <button className={buttonClass} type="submit">
              Submit {kind === 'opd' ? 'OPD' : 'medical'} request
            </button>
          </form>
          <History
            rows={visible.map((item) => ({
              id: item.id,
              title: `${item.kind} · ${item.amount}`,
              detail: `${item.reason}${item.review_note ? ` · ${item.review_note}` : ''}`,
              status: item.status,
              href: item.document_url,
            }))}
          />
        </>
      )}
    </PageFrame>
  );
}

function History({
  rows,
}: {
  rows: { id: string; title: string; detail: string; status: string; href?: string | null }[];
}) {
  if (rows.length === 0) return <EmptyState>No requests yet.</EmptyState>;
  return (
    <div className="space-y-2">
      {rows.map((row) => (
        <ListRow
          key={row.id}
          title={row.title}
          detail={row.detail}
          status={row.status}
          href={row.href}
        />
      ))}
    </div>
  );
}
