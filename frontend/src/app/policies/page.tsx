'use client';

import { FormEvent, useEffect, useState } from 'react';
import {
  PageFrame,
  buttonClass,
  buttonDangerClass,
  cardClass,
  fieldClass,
  formPanelClass,
  labelClass,
} from '@/components/page-frame';
import { EmptyState, Notice } from '@/components/widgets';
import { apiJson } from '@/lib/api';
import type { SessionUser } from '@/lib/auth/types';

interface Policy {
  id: string;
  title: string;
  body: string;
  updated_at: string;
  author: { full_name: string } | null;
}

export default function PoliciesPage() {
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [canManage, setCanManage] = useState(false);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [editing, setEditing] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  function load() {
    return apiJson<{ policies: Policy[] }>('/api/policies').then((data) =>
      setPolicies(data.policies),
    );
  }

  useEffect(() => {
    load().catch((err: unknown) =>
      setError(err instanceof Error ? err.message : 'Could not load policies'),
    );
    apiJson<{ user: SessionUser }>('/api/auth/me', undefined, { silent: true })
      .then((data) => setCanManage(data.user.role === 'hr' || data.user.role === 'super_admin'))
      .catch(() => setCanManage(false));
  }, []);

  async function save(event: FormEvent) {
    event.preventDefault();
    setError('');
    setMessage('');
    try {
      if (editing) {
        await apiJson(`/api/policies/${editing}`, {
          method: 'PATCH',
          body: JSON.stringify({ title, body }),
        });
        setMessage('Policy updated.');
      } else {
        await apiJson('/api/policies', {
          method: 'POST',
          body: JSON.stringify({ title, body }),
        });
        setMessage('Policy published.');
      }
      setTitle('');
      setBody('');
      setEditing(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the policy');
    }
  }

  async function remove(id: string) {
    setError('');
    setMessage('');
    try {
      await apiJson(`/api/policies/${id}`, { method: 'DELETE' });
      if (editing === id) {
        setEditing(null);
        setTitle('');
        setBody('');
      }
      setMessage('Policy removed.');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not remove the policy');
    }
  }

  return (
    <PageFrame
      title="Policies"
      description="Company policies and SOPs. Everyone signed in can read them. HR publishes and updates them."
    >
      <Notice error={error} message={message} />
      {canManage ? (
        <form className={formPanelClass} onSubmit={save}>
          <h2 className="text-ink text-sm font-semibold md:col-span-2">
            {editing ? 'Edit policy' : 'Add a policy'}
          </h2>
          <label className="block md:col-span-2">
            <span className={labelClass}>Title</span>
            <input
              className={fieldClass}
              required
              minLength={3}
              maxLength={160}
              value={title}
              onChange={(event) => setTitle(event.target.value)}
            />
          </label>
          <label className="block md:col-span-2">
            <span className={labelClass}>Policy</span>
            <textarea
              className={`${fieldClass} min-h-40`}
              required
              minLength={3}
              maxLength={20000}
              value={body}
              onChange={(event) => setBody(event.target.value)}
            />
          </label>
          <div className="flex gap-2">
            <button className={buttonClass} type="submit">
              {editing ? 'Save changes' : 'Publish'}
            </button>
            {editing ? (
              <button
                className={buttonDangerClass}
                type="button"
                onClick={() => {
                  setEditing(null);
                  setTitle('');
                  setBody('');
                }}
              >
                Cancel
              </button>
            ) : null}
          </div>
        </form>
      ) : null}

      {policies.length === 0 ? (
        <EmptyState>No policies yet.</EmptyState>
      ) : (
        <div className="flex flex-col gap-4">
          {policies.map((policy) => (
            <article key={policy.id} className={`${cardClass} p-6`}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-ink text-base font-semibold">{policy.title}</h2>
                  <p className="text-mute mt-1 text-xs">
                    {policy.author?.full_name ? `${policy.author.full_name} · ` : ''}
                    Updated {policy.updated_at.slice(0, 10)}
                  </p>
                </div>
                {canManage ? (
                  <div className="flex gap-2">
                    <button
                      type="button"
                      className="text-primary text-sm font-medium"
                      onClick={() => {
                        setEditing(policy.id);
                        setTitle(policy.title);
                        setBody(policy.body);
                      }}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className="text-danger text-sm font-medium"
                      onClick={() => remove(policy.id)}
                    >
                      Remove
                    </button>
                  </div>
                ) : null}
              </div>
              <p className="text-ink mt-4 text-sm leading-relaxed whitespace-pre-wrap">
                {policy.body}
              </p>
            </article>
          ))}
        </div>
      )}
    </PageFrame>
  );
}
