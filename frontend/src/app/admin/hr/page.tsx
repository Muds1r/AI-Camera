'use client';

import { FormEvent, useEffect, useState } from 'react';
import { PageFrame, buttonClass, fieldClass } from '@/components/page-frame';
import { PasswordField } from '@/components/password-field';
import { ConfirmDialog, Notice } from '@/components/widgets';
import { apiJson } from '@/lib/api';
import type { SessionUser } from '@/lib/auth/types';

export default function HrAccountsPage() {
  const [users, setUsers] = useState<SessionUser[]>([]);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [selected, setSelected] = useState<SessionUser | null>(null);
  const [phone, setPhone] = useState('');
  const [department, setDepartment] = useState('');
  const [designation, setDesignation] = useState('');
  const [confirming, setConfirming] = useState<SessionUser | null>(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  function load() {
    return apiJson<{ users: SessionUser[] }>('/api/users?role=hr').then((data) =>
      setUsers(data.users),
    );
  }

  useEffect(() => {
    load().catch((err: unknown) => setError(err instanceof Error ? err.message : 'Could not load'));
  }, []);

  async function create(event: FormEvent) {
    event.preventDefault();
    setError('');
    try {
      await apiJson('/api/users', {
        method: 'POST',
        body: JSON.stringify({ full_name: fullName, email, password, role: 'hr' }),
      });
      setMessage('HR account created.');
      setFullName('');
      setEmail('');
      setPassword('');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create');
    }
  }

  async function toggle(person: SessionUser) {
    await apiJson(`/api/users/${person.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ is_active: !person.is_active }),
    });
    setConfirming(null);
    setMessage(person.is_active ? 'HR account deactivated.' : 'HR account activated.');
    await load();
  }

  async function saveHr(event: FormEvent) {
    event.preventDefault();
    if (!selected) return;
    setError('');
    try {
      await apiJson(`/api/users/${selected.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          full_name: selected.full_name,
          phone,
          department,
          designation,
        }),
      });
      setMessage('HR account updated.');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update');
    }
  }

  return (
    <PageFrame title="HR accounts" description="Only a Super Admin can create or deactivate HR.">
      <Notice error={error} message={message} />
      <form
        onSubmit={create}
        className="border-line bg-paper mb-6 grid gap-3 rounded-xl border p-5 shadow-sm md:grid-cols-2"
      >
        <input
          required
          className={fieldClass}
          placeholder="Full name"
          value={fullName}
          onChange={(event) => setFullName(event.target.value)}
        />
        <input
          required
          type="email"
          className={fieldClass}
          placeholder="Email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
        <PasswordField
          required
          value={password}
          onChange={setPassword}
          placeholder="Temporary password"
        />
        <button className={buttonClass} type="submit">
          Create HR account
        </button>
      </form>
      <ul className="space-y-2">
        {users.map((person) => (
          <li
            key={person.id}
            className="border-line bg-paper flex items-center justify-between rounded-xl border px-4 py-3 text-sm"
          >
            <button
              type="button"
              className="text-left font-bold"
              onClick={() => {
                setSelected(person);
                setPhone(person.phone || '');
                setDepartment(person.department || '');
                setDesignation(person.designation || '');
              }}
            >
              {person.full_name}
              <span className="text-mute block font-medium">{person.email}</span>
            </button>
            <button type="button" className="font-bold" onClick={() => setConfirming(person)}>
              {person.is_active ? 'Deactivate' : 'Activate'}
            </button>
          </li>
        ))}
      </ul>
      {selected ? (
        <form onSubmit={saveHr} className="border-line bg-paper mt-6 grid gap-3 rounded-xl border p-5 shadow-sm md:grid-cols-2">
          <h2 className="font-extrabold md:col-span-2">Update {selected.email}</h2>
          <input className={fieldClass} value={selected.full_name} onChange={(event) => setSelected({ ...selected, full_name: event.target.value })} />
          <input className={fieldClass} placeholder="Phone" value={phone} onChange={(event) => setPhone(event.target.value)} />
          <input className={fieldClass} placeholder="Department" value={department} onChange={(event) => setDepartment(event.target.value)} />
          <input className={fieldClass} placeholder="Designation" value={designation} onChange={(event) => setDesignation(event.target.value)} />
          <button className={buttonClass} type="submit">
            Save HR account
          </button>
        </form>
      ) : null}
      <ConfirmDialog
        open={Boolean(confirming)}
        title={confirming?.is_active ? 'Deactivate this HR account?' : 'Activate this HR account?'}
        detail={confirming?.full_name}
        confirmLabel={confirming?.is_active ? 'Deactivate' : 'Activate'}
        onClose={() => setConfirming(null)}
        onConfirm={() => {
          if (confirming) toggle(confirming).catch(() => undefined);
        }}
      />
    </PageFrame>
  );
}
