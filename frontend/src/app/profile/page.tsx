'use client';

import { FormEvent, ReactNode, useEffect, useRef, useState } from 'react';
import {
  PageFrame,
  buttonClass,
  buttonSecondaryClass,
  cardClass,
  fieldClass,
  labelClass,
} from '@/components/page-frame';
import { PasswordField } from '@/components/password-field';
import { PictureField } from '@/components/picture-field';
import { Card, ListRow, Notice } from '@/components/widgets';
import { apiJson } from '@/lib/api';
import { ROLE_LABELS, type Role } from '@/lib/auth/permissions';
import type { SessionUser } from '@/lib/auth/types';
import {
  BLOOD_GROUPS,
  GENDERS,
  addressError,
  choiceError,
  dateInputValue,
  dateOfBirthError,
  digitsOnly,
  idCardError,
  labelError,
  nameError,
  notesError,
  passwordError,
  phoneError,
  secondaryEmailError,
  withoutDigits,
} from '@/lib/fields';

interface ProfileRequest {
  id: string;
  status: string;
  review_note: string | null;
  changes: Record<string, string | null>;
  created_at: string;
}

function yearsAgo(years: number) {
  const date = new Date();
  date.setFullYear(date.getFullYear() - years);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

function Field({
  label,
  hint,
  error,
  children,
  className,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={`block ${className ?? ''}`}>
      <span className={labelClass}>{label}</span>
      {children}
      {error ? (
        <span className="text-danger mt-1 block text-xs">{error}</span>
      ) : hint ? (
        <span className="text-mute mt-1 block text-xs">{hint}</span>
      ) : null}
    </label>
  );
}

export default function ProfilePage() {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [requests, setRequests] = useState<ProfileRequest[]>([]);
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [secondaryEmail, setSecondaryEmail] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [gender, setGender] = useState('');
  const [bloodGroup, setBloodGroup] = useState('');
  const [idCard, setIdCard] = useState('');
  const [address, setAddress] = useState('');
  const [emergencyName, setEmergencyName] = useState('');
  const [emergencyPhone, setEmergencyPhone] = useState('');
  const [info, setInfo] = useState('');
  const [department, setDepartment] = useState('');
  const [designation, setDesignation] = useState('');
  const [picture, setPicture] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [passwordOpen, setPasswordOpen] = useState(false);
  const dobRef = useRef<HTMLInputElement>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [passwordErrors, setPasswordErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const savesDirectly = user?.role === 'super_admin' || user?.role === 'hr';

  function applyUser(next: SessionUser) {
    setUser(next);
    setFullName(next.full_name);
    setPhone(digitsOnly(next.phone ?? '', 12));
    setSecondaryEmail(next.secondary_email ?? '');
    setDateOfBirth(dateInputValue(next.date_of_birth));
    setGender(next.gender ?? '');
    setBloodGroup(next.blood_group ?? '');
    setIdCard(digitsOnly(next.id_card_number ?? '', 13));
    setAddress(next.address ?? '');
    setEmergencyName(next.emergency_contact_name ?? '');
    setEmergencyPhone(digitsOnly(next.emergency_contact_phone ?? '', 12));
    setInfo(next.info ?? '');
    setDepartment(next.department ?? '');
    setDesignation(next.designation ?? '');
    setPreview(next.avatar_url);
  }

  function load() {
    return Promise.all([
      apiJson<{ user: SessionUser }>('/api/auth/me'),
      apiJson<{ requests: ProfileRequest[] }>('/api/profile-requests'),
    ]).then(([session, list]) => {
      applyUser(session.user);
      setRequests(list.requests);
    });
  }

  useEffect(() => {
    const input = dobRef.current;
    if (input) {
      input.min = yearsAgo(80);
      input.max = yearsAgo(16);
    }
    load().catch((err: unknown) => setError(err instanceof Error ? err.message : 'Could not load'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function detailErrors() {
    const loginEmail = user?.email ?? '';
    return {
      full_name: nameError(fullName),
      phone: phoneError(phone, true),
      secondary_email: secondaryEmailError(secondaryEmail, loginEmail, true),
      date_of_birth: dateOfBirthError(dateOfBirth, true),
      gender: choiceError(
        gender,
        'Gender',
        GENDERS.map((item) => item.value),
        true,
      ),
      blood_group: choiceError(bloodGroup, 'Blood group', BLOOD_GROUPS, false),
      id_card_number: idCardError(idCard, true),
      address: addressError(address, true),
      emergency_contact_name: nameError(emergencyName, 'Emergency contact'),
      emergency_contact_phone: phoneError(emergencyPhone, true, 'Emergency phone'),
      department: labelError(department, 'Department'),
      designation: labelError(designation, 'Designation'),
      info: notesError(info),
    };
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError('');
    setMessage('');
    const nextErrors = detailErrors();
    setFieldErrors(nextErrors);
    if (Object.values(nextErrors).some(Boolean)) return;
    try {
      const changes: Record<string, string> = {
        full_name: fullName.trim().replace(/\s+/g, ' '),
        phone,
        secondary_email: secondaryEmail.trim(),
        date_of_birth: dateOfBirth,
        gender,
        blood_group: bloodGroup,
        id_card_number: idCard,
        address: address.trim(),
        emergency_contact_name: emergencyName.trim().replace(/\s+/g, ' '),
        emergency_contact_phone: emergencyPhone,
        info,
        department,
        designation,
      };
      for (const [key, value] of Object.entries(nextValues)) {
        if (value !== current[key]) changes[key] = value;
      }
    } else {
      Object.assign(changes, nextValues);
    }

    try {
      if (picture) {
        const form = new FormData();
        form.append('picture', picture);
        const uploaded = await apiJson<{ avatar_url?: string; user?: SessionUser }>(
          '/api/users/me/avatar',
          { method: 'POST', body: form },
        );
        if (uploaded.avatar_url) changes.avatar_url = uploaded.avatar_url;
      }
      if (savesDirectly) {
        await apiJson('/api/users/me', { method: 'PATCH', body: JSON.stringify(changes) });
        setMessage('Profile updated.');
      } else {
        await apiJson('/api/profile-requests', {
          method: 'POST',
          body: JSON.stringify({ changes }),
        });
        setMessage('Profile update sent to HR for approval.');
      }
      setPicture(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save');
    }
  }

  async function submitPassword(event: FormEvent) {
    event.preventDefault();
    setError('');
    setMessage('');
    const nextErrors = {
      current_password: currentPassword ? '' : 'Current password is required',
      new_password: passwordError(newPassword, true),
    };
    setPasswordErrors(nextErrors);
    if (Object.values(nextErrors).some(Boolean)) {
      setPasswordOpen(true);
      return;
    }
    try {
      await apiJson('/api/users/me', {
        method: 'PATCH',
        body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
      });
      setCurrentPassword('');
      setNewPassword('');
      setPasswordOpen(false);
      setMessage('Password updated.');
    } catch (err) {
      setPasswordOpen(true);
      setError(err instanceof Error ? err.message : 'Could not update the password');
    }
  }

  const roleLabel = user ? ROLE_LABELS[user.role as Role] : '';

  return (
    <PageFrame title="Profile">
      <Notice error={error} message={message} />
      <div className="grid items-start gap-6 xl:grid-cols-[17.5rem_minmax(0,1fr)]">
        <aside className={`${cardClass} overflow-hidden`}>
          <div className="p-6">
            <div className="flex flex-col items-center text-center">
              {preview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={preview}
                  alt=""
                  className="border-line h-28 w-28 rounded-full border object-cover"
                />
              ) : (
                <div className="bg-primary text-primary-on flex h-28 w-28 items-center justify-center rounded-full text-2xl font-semibold">
                  {(fullName || user?.email || '?').slice(0, 1).toUpperCase()}
                </div>
              )}
              <p className="text-ink mt-4 text-base font-semibold">{fullName || 'Your profile'}</p>
              <p className="text-mute mt-1 text-sm break-all">{user?.email}</p>
              {roleLabel ? <p className="text-mute mt-1 text-xs font-medium">{roleLabel}</p> : null}
              {user?.joined_on ? (
                <p className="text-mute mt-3 text-xs">Joined {dateInputValue(user.joined_on)}</p>
              ) : null}
            </div>
            <div className="border-line mt-6 border-t pt-5">
              <PictureField
                preview={null}
                previewClassName="hidden"
                onFile={(file) => {
                  setPicture(file);
                  setPreview((current) => {
                    if (current?.startsWith('blob:')) URL.revokeObjectURL(current);
                    return file ? URL.createObjectURL(file) : (user?.avatar_url ?? null);
                  });
                }}
              />
            </div>
          </div>
          <div className="border-line border-t">
            <button
              type="button"
              className="flex w-full items-center justify-between gap-3 px-6 py-4 text-left"
              aria-expanded={passwordOpen}
              onClick={() => setPasswordOpen((open) => !open)}
            >
              <span className="text-ink text-sm font-semibold">Change password</span>
              <span className="text-mute text-xs font-medium">
                {passwordOpen ? 'Hide' : 'Show'}
              </span>
            </button>
            {passwordOpen ? (
              <form onSubmit={submitPassword} className="px-6 pb-6" noValidate>
                <p className="text-mute text-xs">8 to 72 characters, with a letter and a number.</p>
                <div className="mt-4 grid gap-4">
                  <Field label="Current password" error={passwordErrors.current_password}>
                    <div className="mt-1">
                      <PasswordField
                        value={currentPassword}
                        onChange={setCurrentPassword}
                        placeholder="Current password"
                        autoComplete="current-password"
                      />
                    </div>
                  </Field>
                  <Field label="New password" error={passwordErrors.new_password}>
                    <div className="mt-1">
                      <PasswordField
                        value={newPassword}
                        onChange={setNewPassword}
                        placeholder="New password"
                        autoComplete="new-password"
                      />
                    </div>
                  </Field>
                </div>
                <button className={`${buttonSecondaryClass} mt-4 w-full`} type="submit">
                  Update password
                </button>
              </form>
            ) : null}
          </div>
        </aside>

        <div className="flex min-w-0 flex-col gap-6">
          <form onSubmit={submit} className={`${cardClass} p-6`} noValidate>
            <div className="mb-5">
              <h2 className="text-ink text-base font-semibold">Personal details</h2>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Full name" error={fieldErrors.full_name}>
                <input
                  className={`${fieldClass} mt-1`}
                  value={fullName}
                  maxLength={80}
                  autoComplete="name"
                  onChange={(event) => setFullName(withoutDigits(event.target.value))}
                  required
                />
              </Field>
              <Field label="Phone number" hint="10 to 12 digits" error={fieldErrors.phone}>
                <input
                  className={`${fieldClass} mt-1`}
                  type="tel"
                  inputMode="numeric"
                  autoComplete="tel"
                  maxLength={12}
                  value={phone}
                  onChange={(event) => setPhone(digitsOnly(event.target.value, 12))}
                  required
                />
              </Field>
              <Field
                label="Secondary email"
                hint="Used later for a password reset code"
                error={fieldErrors.secondary_email}
              >
                <input
                  className={`${fieldClass} mt-1`}
                  type="email"
                  autoComplete="email"
                  maxLength={254}
                  value={secondaryEmail}
                  onChange={(event) => setSecondaryEmail(event.target.value)}
                  required
                />
              </Field>
              <Field label="Date of birth" error={fieldErrors.date_of_birth}>
                <input
                  ref={dobRef}
                  className={`${fieldClass} mt-1`}
                  type="date"
                  value={dateOfBirth}
                  onChange={(event) => setDateOfBirth(event.target.value)}
                  required
                />
              </Field>
              <Field label="Gender" error={fieldErrors.gender}>
                <select
                  className={`${fieldClass} mt-1`}
                  value={gender}
                  onChange={(event) => setGender(event.target.value)}
                  required
                >
                  <option value="">Select</option>
                  {GENDERS.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Blood group" error={fieldErrors.blood_group}>
                <select
                  className={`${fieldClass} mt-1`}
                  value={bloodGroup}
                  onChange={(event) => setBloodGroup(event.target.value)}
                >
                  <option value="">Not set</option>
                  {BLOOD_GROUPS.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="ID card number" hint="13 digits" error={fieldErrors.id_card_number}>
                <input
                  className={`${fieldClass} mt-1`}
                  inputMode="numeric"
                  autoComplete="off"
                  maxLength={13}
                  value={idCard}
                  onChange={(event) => setIdCard(digitsOnly(event.target.value, 13))}
                  required
                />
              </Field>
              <Field label="Address" className="sm:col-span-2" error={fieldErrors.address}>
                <textarea
                  className={`${fieldClass} mt-1 min-h-20`}
                  maxLength={300}
                  value={address}
                  onChange={(event) => setAddress(event.target.value)}
                  required
                />
              </Field>
            </div>

            <h3 className="text-ink mt-8 mb-4 text-sm font-semibold">Emergency contact</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Contact name" error={fieldErrors.emergency_contact_name}>
                <input
                  className={`${fieldClass} mt-1`}
                  maxLength={80}
                  value={emergencyName}
                  onChange={(event) => setEmergencyName(withoutDigits(event.target.value))}
                  required
                />
              </Field>
              <Field
                label="Contact phone"
                hint="10 to 12 digits"
                error={fieldErrors.emergency_contact_phone}
              >
                <input
                  className={`${fieldClass} mt-1`}
                  type="tel"
                  inputMode="numeric"
                  maxLength={12}
                  value={emergencyPhone}
                  onChange={(event) => setEmergencyPhone(digitsOnly(event.target.value, 12))}
                  required
                />
              </Field>
            </div>

            <h3 className="text-ink mt-8 mb-4 text-sm font-semibold">Work</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Department" error={fieldErrors.department}>
                <input
                  className={`${fieldClass} mt-1`}
                  maxLength={80}
                  value={department}
                  onChange={(event) => setDepartment(event.target.value)}
                />
              </Field>
              <Field label="Designation" error={fieldErrors.designation}>
                <input
                  className={`${fieldClass} mt-1`}
                  maxLength={80}
                  value={designation}
                  onChange={(event) => setDesignation(event.target.value)}
                />
              </Field>
              <Field label="Joining date">
                <input
                  className={`${fieldClass} mt-1`}
                  value={dateInputValue(user?.joined_on)}
                  disabled
                />
              </Field>
              <Field label="Notes" className="sm:col-span-2" error={fieldErrors.info}>
                <textarea
                  className={`${fieldClass} mt-1 min-h-20`}
                  maxLength={2000}
                  value={info}
                  onChange={(event) => setInfo(event.target.value)}
                />
              </Field>
            </div>

            <div className="border-line mt-6 flex justify-end border-t pt-5">
              <button className={`${buttonClass} w-full sm:w-auto`} type="submit">
                {savesDirectly ? 'Save profile' : 'Send to HR'}
              </button>
            </div>
          </form>

          {requests.length > 0 ? (
            <Card title="Update requests">
              <div className="space-y-2">
                {requests.map((item) => (
                  <ListRow
                    key={item.id}
                    title={new Date(item.created_at).toLocaleDateString()}
                    detail={item.review_note ?? undefined}
                    status={item.status}
                  />
                ))}
              </div>
            </Card>
          ) : null}
        </div>
      </div>
    </PageFrame>
  );
}
