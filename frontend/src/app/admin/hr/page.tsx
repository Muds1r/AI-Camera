'use client';

import { FormEvent, useEffect, useState } from 'react';
import {
  PageFrame,
  buttonClass,
  fieldClass,
  formPanelClass,
  cardClass,
} from '@/components/page-frame';
import { PasswordField } from '@/components/password-field';
import { Notice, Switch } from '@/components/widgets';
import { apiJson } from '@/lib/api';
import type { SessionUser } from '@/lib/auth/types';
import {
  digitsOnly,
  emailError,
  firstError,
  labelError,
  nameError,
  passwordError,
  phoneError,
  secondaryEmailError,
  withoutDigits,
} from '@/lib/fields';

export default function HrAccountsPage() {
  const [users, setUsers] = useState<SessionUser[]>([]);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [accountPhone, setAccountPhone] = useState('');
  const [accountSecondaryEmail, setAccountSecondaryEmail] = useState('');
  const [password, setPassword] = useState('');
  const [selected, setSelected] = useState<SessionUser | null>(null);
  const [phone, setPhone] = useState('');
  const [secondaryEmail, setSecondaryEmail] = useState('');
  const [department, setDepartment] = useState('');
  const [designation, setDesignation] = useState('');
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
    const problem = firstError({
      full_name: nameError(fullName),
      email: emailError(email, true),
      phone: phoneError(accountPhone, true),
      secondary_email: secondaryEmailError(accountSecondaryEmail, email, true),
      password: passwordError(password, true),
    });
    if (problem) {
      setError(problem);
      return;
    }
    try {
      await apiJson('/api/users', {
        method: 'POST',
        body: JSON.stringify({
          full_name: fullName,
          email,
          phone: accountPhone,
          secondary_email: accountSecondaryEmail,
          password,
          role: 'hr',
        }),
      });
      setMessage('HR account created.');
      setFullName('');
      setEmail('');
      setAccountPhone('');
      setAccountSecondaryEmail('');
      setPassword('');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create');
    }
  }

  async function setActive(person: SessionUser, isActive: boolean) {
    if (person.is_active === isActive) return;
    setError('');
    try {
      await apiJson(`/api/users/${person.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ is_active: isActive }),
      });
      setMessage(isActive ? 'HR account activated.' : 'HR account deactivated.');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update status');
    }
  }

  async function saveHr(event: FormEvent) {
    event.preventDefault();
    if (!selected) return;
    setError('');
    const problem = firstError({
      full_name: nameError(selected.full_name),
      phone: phoneError(phone, true),
      secondary_email: secondaryEmailError(secondaryEmail, selected.email, true),
      department: labelError(department, 'Department'),
      designation: labelError(designation, 'Designation'),
    });
    if (problem) {
      setError(problem);
      return;
    }
    try {
      await apiJson(`/api/users/${selected.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          full_name: selected.full_name,
          phone,
          secondary_email: secondaryEmail,
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
    <PageFrame title="HR accounts" description="Create HR accounts and turn them on or off.">
      <Notice error={error} message={message} />
      <form onSubmit={create} className={`${formPanelClass} mb-6 md:grid-cols-2`}>
        <input
          required
          className={fieldClass}
          placeholder="Full name"
          maxLength={80}
          value={fullName}
          onChange={(event) => setFullName(withoutDigits(event.target.value))}
        />
        <input
          required
          type="email"
          className={fieldClass}
          placeholder="Login email"
          maxLength={254}
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
        <input
          required
          type="tel"
          inputMode="numeric"
          className={fieldClass}
          placeholder="Phone, 10–12 digits"
          maxLength={12}
          value={accountPhone}
          onChange={(event) => setAccountPhone(digitsOnly(event.target.value, 12))}
        />
        <input
          required
          type="email"
          className={fieldClass}
          placeholder="Secondary email"
          value={accountSecondaryEmail}
          onChange={(event) => setAccountSecondaryEmail(event.target.value)}
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
            className={`${cardClass} flex items-center justify-between px-4 py-3 text-sm`}
          >
            <button
              type="button"
              className="text-left font-bold"
              onClick={() => {
                setSelected(person);
                setPhone(person.phone || '');
                setSecondaryEmail(person.secondary_email || '');
                setDepartment(person.department || '');
                setDesignation(person.designation || '');
              }}
            >
              {person.full_name}
              <span className="text-mute block font-medium">{person.email}</span>
            </button>
            <div className="flex items-center gap-2.5">
              <Switch
                checked={person.is_active}
                onChange={(next) => setActive(person, next).catch(() => undefined)}
                label={`${person.full_name} active`}
              />
              <span className="text-mute text-xs font-medium">
                {person.is_active ? 'Active' : 'Inactive'}
              </span>
            </div>
          </li>
        ))}
      </ul>
      {selected ? (
        <form onSubmit={saveHr} className={`${formPanelClass} mt-6 md:grid-cols-2`}>
          <h2 className="text-ink text-sm font-medium md:col-span-2">Update {selected.email}</h2>
          <input
            className={fieldClass}
            maxLength={80}
            value={selected.full_name}
            onChange={(event) =>
              setSelected({ ...selected, full_name: withoutDigits(event.target.value) })
            }
          />
          <input
            className={fieldClass}
            type="tel"
            inputMode="numeric"
            placeholder="Phone, 10–12 digits"
            maxLength={12}
            value={phone}
            onChange={(event) => setPhone(digitsOnly(event.target.value, 12))}
          />
          <input
            className={fieldClass}
            type="email"
            placeholder="Secondary email"
            value={secondaryEmail}
            onChange={(event) => setSecondaryEmail(event.target.value)}
          />
          <input
            className={fieldClass}
            placeholder="Department"
            value={department}
            onChange={(event) => setDepartment(event.target.value)}
          />
          <input
            className={fieldClass}
            placeholder="Designation"
            value={designation}
            onChange={(event) => setDesignation(event.target.value)}
          />
          <button className={buttonClass} type="submit">
            Save HR account
          </button>
        </form>
      ) : null}
    </PageFrame>
  );
}
