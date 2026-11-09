'use client';

import { FormEvent, useEffect, useState } from 'react';
import { apiJson } from '@/lib/api';
import { ROLE_LABELS, ROLES, type Role } from '@/lib/auth/permissions';
import type { SessionUser } from '@/lib/auth/types';
import { buttonClass, fieldClass, PageFrame } from '@/components/page-frame';
import { PasswordField } from '@/components/password-field';
import { PictureField } from '@/components/picture-field';

export default function AccountsPage() {
  const [users, setUsers] = useState<SessionUser[]>([]);
  const [me, setMe] = useState<SessionUser | null>(null);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [idCard, setIdCard] = useState('');
  const [info, setInfo] = useState('');
  const [password, setPassword] = useState('');
  const [picture, setPicture] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [role, setRole] = useState<Role>('employee');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function load() {
    const [list, session] = await Promise.all([
      apiJson<{ users: SessionUser[] }>('/api/users'),
      apiJson<{ user: SessionUser }>('/api/auth/me'),
    ]);
    return { users: list.users, me: session.user };
  }

  useEffect(() => {
    load()
      .then((data) => {
        setUsers(data.users);
        setMe(data.me);
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Could not load'));
  }, []);

  async function createAccount(event: FormEvent) {
    event.preventDefault();
    setMessage('');
    setError('');
    try {
      const created = await apiJson<{ user: SessionUser }>('/api/users', {
        method: 'POST',
        body: JSON.stringify({
          full_name: fullName,
          email,
          phone,
          address,
          id_card_number: idCard,
          info,
          password,
          role,
        }),
      });
      if (picture) {
        const form = new FormData();
        form.append('picture', picture);
        await apiJson(`/api/users/${created.user.id}/avatar`, { method: 'POST', body: form });
      }
      setFullName('');
      setEmail('');
      setPhone('');
      setAddress('');
      setIdCard('');
      setInfo('');
      setPassword('');
      setPicture(null);
      setPreview(null);
      setRole('employee');
      setMessage('Account created.');
      const data = await load();
      setUsers(data.users);
      setMe(data.me);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create the account');
    }
  }

  async function changeRole(user: SessionUser, nextRole: Role) {
    setMessage('');
    setError('');
    try {
      await apiJson(`/api/users/${user.id}/role`, {
        method: 'PATCH',
        body: JSON.stringify({ role: nextRole }),
      });
      setMessage(`${user.full_name} is now ${ROLE_LABELS[nextRole]}.`);
      const data = await load();
      setUsers(data.users);
      setMe(data.me);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not change the role');
    }
  }

  return (
    <PageFrame
      title="Accounts"
      description="Super Admin can create any account type and assign any of the four roles."
    >
      {message ? <p className="text-brand mb-4 text-sm">{message}</p> : null}
      {error ? <p className="text-brand mb-4 text-sm font-medium">{error}</p> : null}
      <form
        onSubmit={createAccount}
        className="border-mute/25 bg-paper mb-8 grid gap-3 rounded-xl border p-5 md:grid-cols-2"
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
        <input
          className={fieldClass}
          placeholder="Phone"
          value={phone}
          onChange={(event) => setPhone(event.target.value)}
        />
        <input
          className={fieldClass}
          placeholder="Address"
          value={address}
          onChange={(event) => setAddress(event.target.value)}
        />
        <input
          className={fieldClass}
          placeholder="ID card number"
          value={idCard}
          onChange={(event) => setIdCard(event.target.value)}
        />
        <textarea
          className={`${fieldClass} min-h-20 md:col-span-2`}
          placeholder="Basic info"
          value={info}
          onChange={(event) => setInfo(event.target.value)}
        />
        <PasswordField
          required
          autoComplete="new-password"
          placeholder="Temporary password"
          value={password}
          onChange={setPassword}
        />
        <PictureField
          preview={preview}
          onFile={(file) => {
            setPicture(file);
            setPreview((current) => {
              if (current?.startsWith('blob:')) URL.revokeObjectURL(current);
              return file ? URL.createObjectURL(file) : null;
            });
          }}
        />
        <select
          className={fieldClass}
          value={role}
          onChange={(event) => setRole(event.target.value as Role)}
        >
          {ROLES.map((item) => (
            <option key={item} value={item}>
              {ROLE_LABELS[item]}
            </option>
          ))}
        </select>
        <button className={`${buttonClass} md:col-span-2 md:w-fit`} type="submit">
          Create account
        </button>
      </form>

      <div className="border-mute/25 bg-paper overflow-hidden rounded-xl border">
        <table className="w-full text-left text-sm">
          <thead className="bg-surface text-mute text-xs tracking-wider uppercase">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Role</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id} className="border-mute/25 border-t">
                <td className="px-4 py-3">{user.full_name}</td>
                <td className="text-mute px-4 py-3">{user.email}</td>
                <td className="px-4 py-3">
                  <select
                    className={fieldClass}
                    value={user.role}
                    disabled={user.id === me?.id}
                    onChange={(event) => changeRole(user, event.target.value as Role)}
                  >
                    {ROLES.map((item) => (
                      <option key={item} value={item}>
                        {ROLE_LABELS[item]}
                      </option>
                    ))}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </PageFrame>
  );
}
