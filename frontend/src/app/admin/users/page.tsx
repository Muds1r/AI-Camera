'use client';

import { FormEvent, useEffect, useState } from 'react';
import { apiJson } from '@/lib/api';
import { ROLE_LABELS, ROLES, type Role } from '@/lib/auth/permissions';
import type { SessionUser } from '@/lib/auth/types';
import {
  GENDERS,
  addressError,
  choiceError,
  dateOfBirthError,
  digitsOnly,
  emailError,
  firstError,
  idCardError,
  nameError,
  notesError,
  passwordError,
  phoneError,
  secondaryEmailError,
  withoutDigits,
} from '@/lib/fields';
import {
  buttonClass,
  DataPanel,
  fieldClass,
  formPanelClass,
  PageFrame,
  PageSection,
} from '@/components/page-frame';
import {
  Notice,
  Pagination,
  tableClass,
  tableHeadClass,
  tableRowClass,
  tableWrapClass,
} from '@/components/widgets';
import { PasswordField } from '@/components/password-field';
import { PictureField } from '@/components/picture-field';
import { usePaged } from '@/lib/use-paged';

export default function AccountsPage() {
  const [users, setUsers] = useState<SessionUser[]>([]);
  const accounts = usePaged(users, 8);
  const [me, setMe] = useState<SessionUser | null>(null);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [secondaryEmail, setSecondaryEmail] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [gender, setGender] = useState('');
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
    const employee = role === 'employee';
    const problem = firstError({
      full_name: nameError(fullName),
      email: emailError(email, true),
      phone: phoneError(phone, true),
      secondary_email: secondaryEmailError(secondaryEmail, email, true),
      date_of_birth: dateOfBirthError(dateOfBirth, employee),
      gender: choiceError(
        gender,
        'Gender',
        GENDERS.map((item) => item.value),
        employee,
      ),
      id_card_number: idCardError(idCard, employee),
      address: addressError(address, false),
      info: notesError(info),
      password: passwordError(password, true),
    });
    if (problem) {
      setError(problem);
      return;
    }
    try {
      const created = await apiJson<{ user: SessionUser }>('/api/users', {
        method: 'POST',
        body: JSON.stringify({
          full_name: fullName,
          email,
          phone,
          secondary_email: secondaryEmail,
          date_of_birth: dateOfBirth,
          gender,
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
      setSecondaryEmail('');
      setDateOfBirth('');
      setGender('');
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
    <PageFrame title="Accounts" description="Create an account and assign one of the four roles.">
      <Notice error={error} message={message} />
      <PageSection title="Create account">
        <form onSubmit={createAccount} className={`${formPanelClass} md:grid-cols-2`}>
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
            placeholder="Email"
            maxLength={254}
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
          <input
            required
            className={fieldClass}
            type="tel"
            inputMode="numeric"
            placeholder="Phone, 10–12 digits"
            maxLength={12}
            value={phone}
            onChange={(event) => setPhone(digitsOnly(event.target.value, 12))}
          />
          <input
            required
            className={fieldClass}
            type="email"
            placeholder="Secondary email"
            maxLength={254}
            value={secondaryEmail}
            onChange={(event) => setSecondaryEmail(event.target.value)}
          />
          <input
            className={fieldClass}
            type="date"
            aria-label="Date of birth"
            value={dateOfBirth}
            onChange={(event) => setDateOfBirth(event.target.value)}
          />
          <select
            className={fieldClass}
            aria-label="Gender"
            value={gender}
            onChange={(event) => setGender(event.target.value)}
          >
            <option value="">Gender</option>
            {GENDERS.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
          <input
            className={fieldClass}
            placeholder="Address"
            maxLength={300}
            value={address}
            onChange={(event) => setAddress(event.target.value)}
          />
          <input
            className={fieldClass}
            inputMode="numeric"
            placeholder="ID card, 13 digits"
            maxLength={13}
            value={idCard}
            onChange={(event) => setIdCard(digitsOnly(event.target.value, 13))}
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
            placeholder="Temporary password, letter and number"
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
      </PageSection>

      <PageSection title="All accounts">
        <DataPanel>
          <div className={tableWrapClass}>
            <table className={tableClass}>
              <thead className={tableHeadClass}>
                <tr>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3">Role</th>
                </tr>
              </thead>
              <tbody>
                {accounts.slice.map((user) => (
                  <tr key={user.id} className={tableRowClass}>
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
          {accounts.showPager ? (
            <Pagination
              page={accounts.page}
              totalPages={accounts.totalPages}
              total={accounts.total}
              pageSize={accounts.pageSize}
              onPageChange={accounts.setPage}
            />
          ) : null}
        </DataPanel>
      </PageSection>
    </PageFrame>
  );
}
