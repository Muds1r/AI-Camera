'use client';

import { FormEvent, useEffect, useState } from 'react';
import { PageFrame, buttonClass, fieldClass } from '@/components/page-frame';
import { PasswordField } from '@/components/password-field';
import { PictureField } from '@/components/picture-field';
import { Badge, Notice } from '@/components/widgets';
import { apiJson } from '@/lib/api';
import type { SessionUser } from '@/lib/auth/types';

interface ProfileRequest {
  id: string;
  status: string;
  review_note: string | null;
  changes: Record<string, string | null>;
  created_at: string;
}

export default function ProfilePage() {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [requests, setRequests] = useState<ProfileRequest[]>([]);
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [info, setInfo] = useState('');
  const [department, setDepartment] = useState('');
  const [designation, setDesignation] = useState('');
  const [picture, setPicture] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  function load() {
    return Promise.all([
      apiJson<{ user: SessionUser }>('/api/auth/me'),
      apiJson<{ requests: ProfileRequest[] }>('/api/profile-requests'),
    ]).then(([session, list]) => {
      setUser(session.user);
      setFullName(session.user.full_name);
      setPhone(session.user.phone ?? '');
      setAddress(session.user.address ?? '');
      setInfo(session.user.info ?? '');
      setDepartment(session.user.department ?? '');
      setDesignation(session.user.designation ?? '');
      setPreview(session.user.avatar_url);
      setRequests(list.requests);
    });
  }

  useEffect(() => {
    load().catch((err: unknown) => setError(err instanceof Error ? err.message : 'Could not load'));
  }, []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError('');
    setMessage('');
    try {
      if (newPassword || currentPassword) {
        await apiJson('/api/users/me', {
          method: 'PATCH',
          body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
        });
        setCurrentPassword('');
        setNewPassword('');
      }
      const changes: Record<string, string> = {
        full_name: fullName,
        phone,
        address,
        info,
        department,
        designation,
      };
      if (picture) {
        const form = new FormData();
        form.append('picture', picture);
        const uploaded = await apiJson<{ avatar_url?: string; user?: SessionUser }>(
          '/api/users/me/avatar',
          { method: 'POST', body: form },
        );
        if (uploaded.avatar_url) changes.avatar_url = uploaded.avatar_url;
      }
      if (user?.role === 'super_admin') {
        await apiJson('/api/users/me', { method: 'PATCH', body: JSON.stringify(changes) });
        setMessage('Profile updated.');
      } else {
        await apiJson('/api/profile-requests', {
          method: 'POST',
          body: JSON.stringify({ changes }),
        });
        setMessage('Profile update sent to HR.');
      }
      setPicture(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save');
    }
  }

  return (
    <PageFrame
      title="Profile"
      description="Email stays fixed. Other changes go to HR unless you are a Super Admin."
    >
      <Notice error={error} message={message} />
      <form
        onSubmit={submit}
        className="border-line bg-paper max-w-2xl space-y-4 rounded-xl border p-6 shadow-sm"
      >
        <p className="text-sm font-bold">{user?.email}</p>
        <p className="text-mute text-xs">Email cannot be changed here.</p>
        <PictureField
          preview={preview}
          onFile={(file) => {
            setPicture(file);
            setPreview((current) => {
              if (current?.startsWith('blob:')) URL.revokeObjectURL(current);
              return file ? URL.createObjectURL(file) : (user?.avatar_url ?? null);
            });
          }}
        />
        <label className="block text-xs font-bold uppercase">
          Full name
          <input
            className={`${fieldClass} mt-1`}
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
            required
          />
        </label>
        <label className="block text-xs font-bold uppercase">
          Phone
          <input
            className={`${fieldClass} mt-1`}
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
          />
        </label>
        <label className="block text-xs font-bold uppercase">
          Address
          <input
            className={`${fieldClass} mt-1`}
            value={address}
            onChange={(event) => setAddress(event.target.value)}
          />
        </label>
        <label className="block text-xs font-bold uppercase">
          Department
          <input
            className={`${fieldClass} mt-1`}
            value={department}
            onChange={(event) => setDepartment(event.target.value)}
          />
        </label>
        <label className="block text-xs font-bold uppercase">
          Designation
          <input
            className={`${fieldClass} mt-1`}
            value={designation}
            onChange={(event) => setDesignation(event.target.value)}
          />
        </label>
        <label className="block text-xs font-bold uppercase">
          Info
          <textarea
            className={`${fieldClass} mt-1 min-h-20`}
            value={info}
            onChange={(event) => setInfo(event.target.value)}
          />
        </label>
        <div className="border-line border-t pt-4">
          <p className="mb-3 text-sm font-extrabold">Change password</p>
          <PasswordField
            value={currentPassword}
            onChange={setCurrentPassword}
            placeholder="Current password"
            autoComplete="current-password"
          />
          <div className="mt-3">
            <PasswordField
              value={newPassword}
              onChange={setNewPassword}
              placeholder="New password"
              autoComplete="new-password"
            />
          </div>
        </div>
        <button className={buttonClass} type="submit">
          {user?.role === 'super_admin' ? 'Save profile' : 'Send update request'}
        </button>
      </form>
      <ul className="mt-6 max-w-2xl space-y-2">
        {requests.map((item) => (
          <li
            key={item.id}
            className="border-line bg-paper flex items-center justify-between rounded-xl border px-4 py-3 text-sm"
          >
            <span>
              {new Date(item.created_at).toLocaleDateString()}{' '}
              {item.review_note ? `· ${item.review_note}` : ''}
            </span>
            <Badge status={item.status} />
          </li>
        ))}
      </ul>
    </PageFrame>
  );
}
