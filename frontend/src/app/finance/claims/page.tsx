'use client';

import { FormEvent, Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  PageFrame,
  buttonClass,
  buttonDangerClass,
  buttonSuccessClass,
  fieldClass,
  formPanelClass,
  labelClass,
  tabActiveClass,
  tabBarClass,
  tabIdleClass,
} from '@/components/page-frame';
import { Badge, ConfirmDialog, EmptyState, Notice, Pagination } from '@/components/widgets';
import { apiJson } from '@/lib/api';
import { documentFileError } from '@/lib/fields';
import { usePaged } from '@/lib/use-paged';

type Tab = 'medical' | 'opd';

interface Person {
  id: string;
  full_name: string;
  email: string;
  employee_code: string | null;
  login_enabled: boolean;
}

interface Claim {
  id: string;
  status: string;
  kind: string;
  amount: number;
  reason: string;
  document_url: string | null;
  review_note: string | null;
  requester: { full_name: string; email: string };
}

export default function FinanceClaimsPage() {
  return (
    <Suspense fallback={<PageFrame title="Claims">{null}</PageFrame>}>
      <FinanceClaimsContent />
    </Suspense>
  );
}

function FinanceClaimsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tab: Tab = searchParams.get('tab') === 'opd' ? 'opd' : 'medical';
  const [people, setPeople] = useState<Person[]>([]);
  const [personQuery, setPersonQuery] = useState('');
  const [userId, setUserId] = useState('');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [ownAmount, setOwnAmount] = useState('');
  const [ownReason, setOwnReason] = useState('');
  const [ownFile, setOwnFile] = useState<File | null>(null);
  const [ownClaims, setOwnClaims] = useState<Claim[]>([]);
  const [claims, setClaims] = useState<Claim[]>([]);
  const [status, setStatus] = useState('pending');
  const [statusTab, setStatusTab] = useState<Tab>(tab);
  const shownStatus = statusTab === tab ? status : 'pending';
  const ownPage = usePaged(ownClaims, 4);
  const reviewPage = usePaged(claims, 6, `${tab}|${shownStatus}`);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [pending, setPending] = useState<{ id: string; status: 'approved' | 'rejected' } | null>(
    null,
  );
  const [note, setNote] = useState('');

  function loadPeople(query: string) {
    const params = new URLSearchParams({ active: 'true', q: query });
    return apiJson<{ users: Person[] }>(`/api/users?${params}`).then((data) =>
      setPeople(data.users),
    );
  }

  function loadClaims(next = tab, nextStatus = status) {
    const params = new URLSearchParams({ scope: 'queue', kind: next });
    if (nextStatus) params.set('status', nextStatus);
    return apiJson<{ requests: Claim[] }>(`/api/benefits?${params}`).then((data) =>
      setClaims(data.requests),
    );
  }

  function loadOwn(next = tab) {
    return apiJson<{ requests: Claim[] }>(`/api/benefits?kind=${next}`).then((data) =>
      setOwnClaims(data.requests),
    );
  }

  useEffect(() => {
    loadPeople('').catch((err: unknown) =>
      setError(err instanceof Error ? err.message : 'Could not load employees'),
    );
  }, []);

  useEffect(() => {
    loadClaims(tab, 'pending').catch((err: unknown) =>
      setError(err instanceof Error ? err.message : 'Could not load claims'),
    );
    loadOwn(tab).catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  async function submitFor(event: FormEvent) {
    event.preventDefault();
    setError('');
    setMessage('');
    if (!userId) {
      setError('Choose the employee this claim is for');
      return;
    }
    if (file) {
      const fileProblem = documentFileError(file);
      if (fileProblem) {
        setError(fileProblem);
        return;
      }
    }
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
      await apiJson('/api/benefits/for', {
        method: 'POST',
        body: JSON.stringify({
          user_id: userId,
          kind: tab,
          amount: Number(amount),
          reason,
          document_url: documentUrl,
        }),
      });
      setAmount('');
      setReason('');
      setFile(null);
      setMessage('Claim saved and approved.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not file the claim');
    }
  }

  async function submitOwn(event: FormEvent) {
    event.preventDefault();
    setError('');
    setMessage('');
    if (ownFile) {
      const fileProblem = documentFileError(ownFile);
      if (fileProblem) {
        setError(fileProblem);
        return;
      }
    }
    try {
      let documentUrl: string | undefined;
      if (ownFile) {
        const form = new FormData();
        form.append('document', ownFile);
        const uploaded = await apiJson<{ document_url: string }>('/api/benefits/document', {
          method: 'POST',
          body: form,
        });
        documentUrl = uploaded.document_url;
      }
      await apiJson('/api/benefits', {
        method: 'POST',
        body: JSON.stringify({
          kind: tab,
          amount: Number(ownAmount),
          reason: ownReason,
          document_url: documentUrl,
        }),
      });
      setOwnAmount('');
      setOwnReason('');
      setOwnFile(null);
      setMessage('Your claim was sent to HR.');
      await loadOwn();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not file your claim');
    }
  }

  async function review() {
    if (!pending) return;
    setError('');
    setMessage('');
    try {
      await apiJson(`/api/benefits/${pending.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: pending.status, review_note: note }),
      });
      setMessage(`Claim ${pending.status}.`);
      setPending(null);
      setNote('');
      await loadClaims();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not review');
    }
  }

  return (
    <PageFrame
      title="Claims"
      description="Approve medical and OPD claims from employees and HR. A claim you file for someone else is approved as soon as you save it. Your own claim still goes to HR."
    >
      <Notice error={error} message={message} />
      <div className={tabBarClass}>
        {(['medical', 'opd'] as const).map((item) => (
          <button
            key={item}
            type="button"
            className={tab === item ? tabActiveClass : tabIdleClass}
            onClick={() => {
              setStatus('pending');
              setStatusTab(item);
              router.replace(`/finance/claims?tab=${item}`);
            }}
          >
            {item === 'opd' ? 'OPD' : 'Medical'}
          </button>
        ))}
      </div>

      <form className={formPanelClass} onSubmit={submitFor}>
        <h2 className="text-ink text-sm font-semibold md:col-span-2">
          File a {tab === 'opd' ? 'OPD' : 'medical'} claim for someone else
        </h2>
        <p className="text-mute text-sm md:col-span-2">
          This is approved when you save it. It is added to that person&apos;s payslip.
        </p>
        <label className="block md:col-span-2">
          <span className={labelClass}>Employee</span>
          <input
            className={fieldClass}
            placeholder="Search by name, email, or employee code"
            value={personQuery}
            onChange={(event) => {
              const value = event.target.value;
              setPersonQuery(value);
              loadPeople(value).catch(() => undefined);
            }}
          />
        </label>
        <select
          className={fieldClass}
          required
          value={userId}
          onChange={(event) => setUserId(event.target.value)}
        >
          <option value="">Select employee</option>
          {people.map((person) => (
            <option key={person.id} value={person.id}>
              {person.full_name}
              {person.employee_code ? ` · ${person.employee_code}` : ''}
              {person.login_enabled ? '' : ' · record only'}
            </option>
          ))}
        </select>
        <input
          className={fieldClass}
          required
          inputMode="decimal"
          placeholder="Amount"
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
        />
        <textarea
          className={`${fieldClass} min-h-20 md:col-span-2`}
          required
          minLength={3}
          maxLength={2000}
          placeholder="Reason"
          value={reason}
          onChange={(event) => setReason(event.target.value)}
        />
        <input
          className={`${fieldClass} md:col-span-2`}
          type="file"
          accept="image/jpeg,image/png,image/webp,application/pdf"
          onChange={(event) => setFile(event.target.files?.[0] ?? null)}
        />
        <button className={buttonClass} type="submit">
          Save claim
        </button>
      </form>

      <form className={formPanelClass} onSubmit={submitOwn}>
        <h2 className="text-ink text-sm font-semibold md:col-span-2">
          Your own {tab === 'opd' ? 'OPD' : 'medical'} claim
        </h2>
        <p className="text-mute text-sm md:col-span-2">
          HR approves this. It does not appear in your review list.
        </p>
        <input
          className={fieldClass}
          required
          inputMode="decimal"
          placeholder="Amount"
          value={ownAmount}
          onChange={(event) => setOwnAmount(event.target.value)}
        />
        <textarea
          className={`${fieldClass} min-h-20 md:col-span-2`}
          required
          minLength={3}
          maxLength={2000}
          placeholder="Reason"
          value={ownReason}
          onChange={(event) => setOwnReason(event.target.value)}
        />
        <input
          className={`${fieldClass} md:col-span-2`}
          type="file"
          accept="image/jpeg,image/png,image/webp,application/pdf"
          onChange={(event) => setOwnFile(event.target.files?.[0] ?? null)}
        />
        <button className={buttonClass} type="submit">
          Send your claim to HR
        </button>
      </form>

      {ownClaims.length > 0 ? (
        <ul className="divide-line divide-y">
          {ownClaims.map((claim) => (
            <li key={claim.id} className="flex items-center justify-between gap-3 py-2 text-sm">
              <span>
                Your claim · {claim.amount}
                <span className="text-mute block text-xs">{claim.reason}</span>
              </span>
              <Badge status={claim.status} />
            </li>
          ))}
        </ul>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <select
          className={`${fieldClass} max-w-40`}
          value={shownStatus}
          onChange={(event) => {
            setStatus(event.target.value);
            setStatusTab(tab);
            loadClaims(tab, event.target.value).catch(() => undefined);
          }}
        >
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
          <option value="">All</option>
        </select>
      </div>

      {claims.length === 0 ? (
        <EmptyState>No claims in this list.</EmptyState>
      ) : (
        <ul className="divide-line divide-y">
          {reviewPage.slice.map((claim) => (
            <li key={claim.id} className="flex flex-wrap items-start justify-between gap-3 py-3">
              <div className="min-w-0">
                <p className="text-ink text-sm font-medium">
                  {claim.requester.full_name} · {claim.amount}
                </p>
                <p className="text-mute mt-1 text-sm">{claim.reason}</p>
                {claim.review_note ? (
                  <p className="text-mute mt-1 text-xs">{claim.review_note}</p>
                ) : null}
                {claim.document_url ? (
                  <a className="text-primary mt-1 inline-block text-xs" href={claim.document_url}>
                    Document
                  </a>
                ) : null}
              </div>
              <div className="flex items-center gap-2">
                <Badge status={claim.status} />
                {claim.status === 'pending' ? (
                  <>
                    <button
                      type="button"
                      className={buttonSuccessClass}
                      onClick={() => setPending({ id: claim.id, status: 'approved' })}
                    >
                      Approve
                    </button>
                    <button
                      type="button"
                      className={buttonDangerClass}
                      onClick={() => setPending({ id: claim.id, status: 'rejected' })}
                    >
                      Reject
                    </button>
                  </>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
      {reviewPage.showPager ? (
        <Pagination
          page={reviewPage.page}
          totalPages={reviewPage.totalPages}
          total={reviewPage.total}
          pageSize={reviewPage.pageSize}
          onPageChange={reviewPage.setPage}
        />
      ) : null}

      <ConfirmDialog
        open={Boolean(pending)}
        title={pending?.status === 'approved' ? 'Approve this claim?' : 'Reject this claim?'}
        confirmLabel={pending?.status === 'approved' ? 'Approve' : 'Reject'}
        tone={pending?.status === 'approved' ? 'teal' : 'danger'}
        onConfirm={review}
        onClose={() => setPending(null)}
      >
        <textarea
          className={`${fieldClass} mt-3 min-h-20`}
          placeholder={pending?.status === 'rejected' ? 'Rejection reason' : 'Note (optional)'}
          value={note}
          onChange={(event) => setNote(event.target.value)}
        />
      </ConfirmDialog>
    </PageFrame>
  );
}
