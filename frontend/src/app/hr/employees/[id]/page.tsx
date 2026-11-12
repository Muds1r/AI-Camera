'use client';

import { FormEvent, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  PageFrame,
  buttonClass,
  buttonSecondaryClass,
  cardClass,
  fieldClass,
  formPanelClass,
  labelClass,
  tabActiveClass,
  tabBarClass,
  tabIdleClass,
} from '@/components/page-frame';
import { PasswordField } from '@/components/password-field';
import { PayslipView, type Payslip } from '@/components/payslip-view';
import { LoadingState, Notice } from '@/components/widgets';
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
  firstError,
  idCardError,
  joinedOnError,
  labelError,
  nameError,
  notesError,
  phoneError,
  secondaryEmailError,
  withoutDigits,
} from '@/lib/fields';

interface Balance {
  id: string;
  allocated: number;
  used: number;
  leave_type: { code: string; name: string };
}

type Section = 'details' | 'payslip';

function money(value: number) {
  return `PKR ${value.toLocaleString('en-US')}`;
}

function text(value: string | null | undefined) {
  const clean = value?.trim();
  return clean ? clean : '—';
}

function choiceLabel(value: string | null, options: readonly { value: string; label: string }[]) {
  if (!value) return '—';
  return options.find((item) => item.value === value)?.label ?? value;
}

function Readout({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-mute text-xs font-medium">{label}</dt>
      <dd className="text-ink mt-1 text-sm break-words">{value}</dd>
    </div>
  );
}

export default function EmployeePage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const [section, setSection] = useState<Section>('details');
  const [editing, setEditing] = useState(false);
  const [person, setPerson] = useState<SessionUser | null>(null);
  const [balances, setBalances] = useState<Balance[]>([]);
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [secondaryEmail, setSecondaryEmail] = useState('');
  const [idCard, setIdCard] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [gender, setGender] = useState('');
  const [bloodGroup, setBloodGroup] = useState('');
  const [emergencyName, setEmergencyName] = useState('');
  const [emergencyPhone, setEmergencyPhone] = useState('');
  const [joinedOn, setJoinedOn] = useState('');
  const [address, setAddress] = useState('');
  const [info, setInfo] = useState('');
  const [department, setDepartment] = useState('');
  const [designation, setDesignation] = useState('');
  const [salary, setSalary] = useState('');
  const [allowance, setAllowance] = useState('');
  const [deduction, setDeduction] = useState('');
  const [medical, setMedical] = useState('');
  const [opd, setOpd] = useState('');
  const [clockEnabled, setClockEnabled] = useState(true);
  const [shift, setShift] = useState<'day' | 'night'>('day');
  const [loginEnabled, setLoginEnabled] = useState(true);
  const [employmentStatus, setEmploymentStatus] = useState<'active' | 'resigned'>('active');
  const [employeeCode, setEmployeeCode] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [payMonth, setPayMonth] = useState('');
  const [payslip, setPayslip] = useState<Payslip | null>(null);
  const [payslipError, setPayslipError] = useState('');
  const [history, setHistory] = useState<
    { id: string; at: string; label: string; detail: string | null }[]
  >([]);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loadedId, setLoadedId] = useState<string | null>(null);

  function fill(user: SessionUser, nextBalances: Balance[]) {
    setPerson(user);
    setBalances(nextBalances);
    setFullName(user.full_name);
    setPhone(user.phone || '');
    setSecondaryEmail(user.secondary_email || '');
    setIdCard(digitsOnly(user.id_card_number || '', 13));
    setDateOfBirth(dateInputValue(user.date_of_birth));
    setGender(user.gender || '');
    setBloodGroup(user.blood_group || '');
    setEmergencyName(user.emergency_contact_name || '');
    setEmergencyPhone(digitsOnly(user.emergency_contact_phone || '', 12));
    setJoinedOn(dateInputValue(user.joined_on));
    setAddress(user.address || '');
    setInfo(user.info || '');
    setDepartment(user.department || '');
    setDesignation(user.designation || '');
    setSalary(user.salary_basic ? String(user.salary_basic) : '');
    setAllowance(user.salary_allowance ? String(user.salary_allowance) : '');
    setDeduction(user.salary_deduction ? String(user.salary_deduction) : '');
    setMedical(user.medical_limit ? String(user.medical_limit) : '');
    setOpd(user.opd_limit ? String(user.opd_limit) : '');
    setClockEnabled(user.clock_enabled);
    setShift(user.shift || 'day');
    setLoginEnabled(user.login_enabled);
    setEmploymentStatus(user.employment_status || 'active');
    setEmployeeCode(user.employee_code || '');
    setLoginPassword('');
  }

  function loadProfile() {
    return apiJson<{ user: SessionUser; balances: Balance[] }>(`/api/users/${id}`).then((data) => {
      fill(data.user, data.balances);
      return data.user;
    });
  }

  useEffect(() => {
    let ignore = false;
    apiJson<{ user: SessionUser; balances: Balance[] }>(`/api/users/${id}`)
      .then((data) => {
        if (!ignore) {
          fill(data.user, data.balances);
          setLoadedId(id);
        }
      })
      .catch((err: unknown) => {
        if (!ignore) setError(err instanceof Error ? err.message : 'Could not load this person');
      });
    apiJson<{ activity: { id: string; at: string; label: string; detail: string | null }[] }>(
      `/api/users/${id}/activity`,
    )
      .then((data) => {
        if (!ignore) setHistory(data.activity);
      })
      .catch(() => {
        if (!ignore) setHistory([]);
      });
    return () => {
      ignore = true;
    };
  }, [id]);

  useEffect(() => {
    if (payMonth) return;
    const timer = window.setTimeout(() => {
      setPayMonth(new Date().toISOString().slice(0, 7));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [payMonth]);

  useEffect(() => {
    if (section !== 'payslip' || !payMonth) return;
    let ignore = false;
    apiJson<{ payslip: Payslip }>(`/api/payslips/${id}?month=${payMonth}`)
      .then((data) => {
        if (!ignore) {
          setPayslip(data.payslip);
          setPayslipError('');
        }
      })
      .catch(() => {
        if (!ignore) {
          setPayslip(null);
          setPayslipError('Could not load this payslip.');
        }
      });
    return () => {
      ignore = true;
    };
  }, [id, payMonth, section]);

  function closeEdit() {
    if (person) fill(person, balances);
    setEditing(false);
    setError('');
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!person) return;
    setError('');
    setMessage('');
    const employee = person.role === 'employee';
    const problem = firstError({
      full_name: nameError(fullName),
      phone: phoneError(phone, true),
      secondary_email: secondaryEmailError(secondaryEmail, person.email, true),
      id_card_number: idCardError(idCard, employee),
      date_of_birth: dateOfBirthError(dateOfBirth, employee),
      gender: choiceError(
        gender,
        'Gender',
        GENDERS.map((item) => item.value),
        employee,
      ),
      blood_group: choiceError(bloodGroup, 'Blood group', BLOOD_GROUPS, false),
      emergency_contact_name: emergencyName.trim()
        ? nameError(emergencyName, 'Emergency contact')
        : '',
      emergency_contact_phone: phoneError(emergencyPhone, false, 'Emergency phone'),
      joined_on: joinedOnError(joinedOn),
      address: addressError(address, false),
      department: labelError(department, 'Department'),
      designation: labelError(designation, 'Designation'),
      info: notesError(info),
    });
    if (problem) {
      setError(problem);
      return;
    }
    if (loginEnabled && !person.login_enabled && !loginPassword) {
      setError('Set a password before turning sign-in on');
      return;
    }
    const amount = (value: string) => (value.trim() ? Number(value) : 0);
    try {
      await apiJson(`/api/users/${person.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          full_name: fullName,
          phone,
          secondary_email: secondaryEmail,
          id_card_number: idCard,
          date_of_birth: dateOfBirth,
          gender,
          blood_group: bloodGroup,
          emergency_contact_name: emergencyName,
          emergency_contact_phone: emergencyPhone,
          joined_on: joinedOn,
          address,
          info,
          department,
          designation,
          salary_basic: amount(salary),
          salary_allowance: amount(allowance),
          salary_deduction: amount(deduction),
          medical_limit: amount(medical),
          opd_limit: amount(opd),
          clock_enabled: clockEnabled,
          ...(!person.login_enabled ? { login_enabled: loginEnabled } : {}),
          shift,
          employment_status: employmentStatus,
          employee_code: employeeCode,
          ...(loginPassword ? { password: loginPassword } : {}),
          leave_allocations: Object.fromEntries(
            balances.map((item) => [item.leave_type.code, item.allocated]),
          ),
        }),
      });
      await loadProfile();
      setEditing(false);
      setMessage('Saved.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save');
    }
  }

  const roleLabel = person ? (ROLE_LABELS[person.role as Role] ?? person.role) : 'Employee';

  return (
    <PageFrame
      title={person?.full_name || 'Employee'}
      description={person ? `${roleLabel} · ${person.email}` : undefined}
      actions={
        <Link href="/hr/employees" className={buttonSecondaryClass}>
          All employees
        </Link>
      }
    >
      <Notice error={error} message={message} />
      {loadedId !== id && !error ? <LoadingState label="Loading employee…" /> : null}
      {loadedId !== id && error ? (
        <p className="text-mute text-sm">This person could not be opened.</p>
      ) : null}

      {person && loadedId === id ? (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className={tabBarClass}>
              <button
                type="button"
                className={section === 'details' ? tabActiveClass : tabIdleClass}
                onClick={() => setSection('details')}
              >
                Details
              </button>
              <button
                type="button"
                className={section === 'payslip' ? tabActiveClass : tabIdleClass}
                onClick={() => setSection('payslip')}
              >
                Payslip
              </button>
            </div>
            {section === 'details' && !editing ? (
              <button type="button" className={buttonClass} onClick={() => setEditing(true)}>
                Edit
              </button>
            ) : null}
            {editing ? (
              <div className="flex gap-2">
                <button type="button" className={buttonSecondaryClass} onClick={closeEdit}>
                  Close
                </button>
                <button type="submit" form="employee-edit" className={buttonClass}>
                  Save
                </button>
              </div>
            ) : null}
          </div>

          {section === 'payslip' ? (
            <section className="flex flex-col gap-4">
              <label className={`${labelClass} max-w-xs`}>
                Month
                <input
                  className={`${fieldClass} mt-1`}
                  type="month"
                  value={payMonth}
                  onChange={(event) => setPayMonth(event.target.value)}
                />
              </label>
              {payslipError ? (
                <p className="text-mute text-sm">{payslipError}</p>
              ) : payslip ? (
                <PayslipView slip={payslip} />
              ) : (
                <LoadingState label="Loading payslip…" />
              )}
            </section>
          ) : null}

          {section === 'details' && !editing ? (
            <div className="flex flex-col gap-4">
              <section className={`${cardClass} grid gap-5 p-6 sm:grid-cols-2 lg:grid-cols-3`}>
                <Readout label="Employee code" value={text(person.employee_code)} />
                <Readout label="Role" value={roleLabel} />
                <Readout label="Department" value={text(person.department)} />
                <Readout label="Designation" value={text(person.designation)} />
                <Readout label="Shift" value={person.shift === 'night' ? 'Night' : 'Day'} />
                <Readout
                  label="Employment"
                  value={person.employment_status === 'resigned' ? 'Resigned' : 'Employed'}
                />
                <Readout label="Account" value={person.is_active ? 'Active' : 'Inactive'} />
                <Readout label="Sign-in" value={person.login_enabled ? 'Enabled' : 'Record only'} />
                <Readout label="Clock in" value={person.clock_enabled ? 'Enabled' : 'Off'} />
              </section>
              <section className={`${cardClass} grid gap-5 p-6 sm:grid-cols-2 lg:grid-cols-3`}>
                <Readout label="Phone" value={text(person.phone)} />
                <Readout label="Secondary email" value={text(person.secondary_email)} />
                <Readout label="Address" value={text(person.address)} />
                <Readout label="Emergency contact" value={text(person.emergency_contact_name)} />
                <Readout label="Emergency phone" value={text(person.emergency_contact_phone)} />
                <Readout label="Joined" value={text(dateInputValue(person.joined_on))} />
              </section>
              <section className={`${cardClass} grid gap-5 p-6 sm:grid-cols-2 lg:grid-cols-3`}>
                <Readout label="Date of birth" value={text(dateInputValue(person.date_of_birth))} />
                <Readout label="Gender" value={choiceLabel(person.gender, GENDERS)} />
                <Readout label="Blood group" value={text(person.blood_group)} />
                <Readout label="ID card" value={text(person.id_card_number)} />
                <Readout label="Notes" value={text(person.info)} />
              </section>
              <section className={`${cardClass} grid gap-5 p-6 sm:grid-cols-2 lg:grid-cols-3`}>
                <Readout label="Basic salary" value={money(person.salary_basic)} />
                <Readout label="Allowance" value={money(person.salary_allowance)} />
                <Readout label="Deduction" value={money(person.salary_deduction)} />
                <Readout label="Medical limit" value={money(person.medical_limit)} />
                <Readout label="OPD limit" value={money(person.opd_limit)} />
              </section>
              {balances.length > 0 ? (
                <section className={`${cardClass} p-6`}>
                  <h2 className="text-ink mb-3 text-sm font-semibold">Leave</h2>
                  <ul className="divide-line divide-y">
                    {balances.map((item) => (
                      <li key={item.id} className="flex justify-between gap-4 py-2 text-sm">
                        <span>{item.leave_type.name}</span>
                        <span className="text-mute">
                          {item.used} used of {item.allocated}
                        </span>
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}
              {history.length > 0 ? (
                <section className={`${cardClass} p-6`}>
                  <h2 className="text-ink mb-3 text-sm font-semibold">Recent activity</h2>
                  <ul className="space-y-2">
                    {history.slice(0, 8).map((item) => (
                      <li key={item.id} className="text-sm">
                        <span className="text-ink capitalize">{item.label}</span>
                        <span className="text-mute block text-xs">
                          {item.at.slice(0, 16).replace('T', ' ')}
                          {item.detail ? ` · ${item.detail}` : ''}
                        </span>
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}
            </div>
          ) : null}

          {section === 'details' && editing ? (
            <form id="employee-edit" onSubmit={save} className={`${formPanelClass} md:grid-cols-2`}>
              <label className={labelClass}>
                Full name
                <input
                  className={`${fieldClass} mt-1`}
                  maxLength={80}
                  value={fullName}
                  onChange={(event) => setFullName(withoutDigits(event.target.value))}
                />
              </label>
              <label className={labelClass}>
                Phone
                <input
                  className={`${fieldClass} mt-1`}
                  inputMode="numeric"
                  maxLength={12}
                  value={phone}
                  onChange={(event) => setPhone(digitsOnly(event.target.value, 12))}
                />
              </label>
              <label className={labelClass}>
                Secondary email
                <input
                  className={`${fieldClass} mt-1`}
                  type="email"
                  maxLength={254}
                  value={secondaryEmail}
                  onChange={(event) => setSecondaryEmail(event.target.value)}
                />
              </label>
              <label className={labelClass}>
                ID card
                <input
                  className={`${fieldClass} mt-1`}
                  inputMode="numeric"
                  maxLength={13}
                  value={idCard}
                  onChange={(event) => setIdCard(digitsOnly(event.target.value, 13))}
                />
              </label>
              <label className={labelClass}>
                Date of birth
                <input
                  className={`${fieldClass} mt-1`}
                  type="date"
                  value={dateOfBirth}
                  onChange={(event) => setDateOfBirth(event.target.value)}
                />
              </label>
              <label className={labelClass}>
                Gender
                <select
                  className={`${fieldClass} mt-1`}
                  value={gender}
                  onChange={(event) => setGender(event.target.value)}
                >
                  <option value="">Select</option>
                  {GENDERS.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className={labelClass}>
                Blood group
                <select
                  className={`${fieldClass} mt-1`}
                  value={bloodGroup}
                  onChange={(event) => setBloodGroup(event.target.value)}
                >
                  <option value="">Select</option>
                  {BLOOD_GROUPS.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </label>
              <label className={labelClass}>
                Emergency contact
                <input
                  className={`${fieldClass} mt-1`}
                  maxLength={80}
                  value={emergencyName}
                  onChange={(event) => setEmergencyName(withoutDigits(event.target.value))}
                />
              </label>
              <label className={labelClass}>
                Emergency phone
                <input
                  className={`${fieldClass} mt-1`}
                  inputMode="numeric"
                  maxLength={12}
                  value={emergencyPhone}
                  onChange={(event) => setEmergencyPhone(digitsOnly(event.target.value, 12))}
                />
              </label>
              <label className={labelClass}>
                Joining date
                <input
                  className={`${fieldClass} mt-1`}
                  type="date"
                  value={joinedOn}
                  onChange={(event) => setJoinedOn(event.target.value)}
                />
              </label>
              <label className={`${labelClass} md:col-span-2`}>
                Address
                <input
                  className={`${fieldClass} mt-1`}
                  value={address}
                  onChange={(event) => setAddress(event.target.value)}
                />
              </label>
              <label className={labelClass}>
                Department
                <input
                  className={`${fieldClass} mt-1`}
                  value={department}
                  onChange={(event) => setDepartment(event.target.value)}
                />
              </label>
              <label className={labelClass}>
                Designation
                <input
                  className={`${fieldClass} mt-1`}
                  value={designation}
                  onChange={(event) => setDesignation(event.target.value)}
                />
              </label>
              <label className={`${labelClass} md:col-span-2`}>
                Notes
                <input
                  className={`${fieldClass} mt-1`}
                  value={info}
                  onChange={(event) => setInfo(event.target.value)}
                />
              </label>
              <label className={labelClass}>
                Basic salary
                <input
                  className={`${fieldClass} mt-1`}
                  type="number"
                  min="0"
                  value={salary}
                  onChange={(event) => setSalary(event.target.value)}
                />
              </label>
              <label className={labelClass}>
                Allowance
                <input
                  className={`${fieldClass} mt-1`}
                  type="number"
                  min="0"
                  value={allowance}
                  onChange={(event) => setAllowance(event.target.value)}
                />
              </label>
              <label className={labelClass}>
                Deduction
                <input
                  className={`${fieldClass} mt-1`}
                  type="number"
                  min="0"
                  value={deduction}
                  onChange={(event) => setDeduction(event.target.value)}
                />
              </label>
              <label className={labelClass}>
                Medical limit
                <input
                  className={`${fieldClass} mt-1`}
                  type="number"
                  min="0"
                  value={medical}
                  onChange={(event) => setMedical(event.target.value)}
                />
              </label>
              <label className={labelClass}>
                OPD limit
                <input
                  className={`${fieldClass} mt-1`}
                  type="number"
                  min="0"
                  value={opd}
                  onChange={(event) => setOpd(event.target.value)}
                />
              </label>
              <label className={labelClass}>
                Employee code
                <input
                  className={`${fieldClass} mt-1`}
                  value={employeeCode}
                  onChange={(event) => setEmployeeCode(event.target.value.toUpperCase())}
                />
              </label>
              <label className={labelClass}>
                Shift
                <select
                  className={`${fieldClass} mt-1`}
                  value={shift}
                  onChange={(event) => setShift(event.target.value as 'day' | 'night')}
                >
                  <option value="day">Day</option>
                  <option value="night">Night</option>
                </select>
              </label>
              <label className={labelClass}>
                Employment
                <select
                  className={`${fieldClass} mt-1`}
                  value={employmentStatus}
                  onChange={(event) =>
                    setEmploymentStatus(event.target.value as 'active' | 'resigned')
                  }
                >
                  <option value="active">Employed</option>
                  <option value="resigned">Resigned</option>
                </select>
              </label>
              <label className="text-ink flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={clockEnabled}
                  onChange={(event) => setClockEnabled(event.target.checked)}
                />
                Clock in enabled
              </label>
              {person.login_enabled ? (
                <div>
                  <span className={labelClass}>Update password</span>
                  <PasswordField
                    value={loginPassword}
                    onChange={setLoginPassword}
                    placeholder="Leave blank to keep the current password"
                  />
                </div>
              ) : (
                <>
                  <label className="text-ink flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={loginEnabled}
                      onChange={(event) => setLoginEnabled(event.target.checked)}
                    />
                    Can sign in
                  </label>
                  {loginEnabled ? (
                    <PasswordField
                      value={loginPassword}
                      onChange={setLoginPassword}
                      placeholder="Password, letter and number"
                    />
                  ) : (
                    <p className="text-mute text-sm md:col-span-2">
                      This person is a record only. Turn sign-in on and set a password to create
                      their login.
                    </p>
                  )}
                </>
              )}
              {balances.map((item) => (
                <label key={item.id} className={labelClass}>
                  {item.leave_type.name} allocated
                  <input
                    className={`${fieldClass} mt-1`}
                    type="number"
                    min="0"
                    value={item.allocated === 0 ? '' : item.allocated}
                    onChange={(event) => {
                      const raw = event.target.value;
                      const next = raw.trim() === '' ? 0 : Number(raw);
                      setBalances((current) =>
                        current.map((balance) =>
                          balance.id === item.id ? { ...balance, allocated: next } : balance,
                        ),
                      );
                    }}
                  />
                </label>
              ))}
            </form>
          ) : null}
        </>
      ) : null}
    </PageFrame>
  );
}
