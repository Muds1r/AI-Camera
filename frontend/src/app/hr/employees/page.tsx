'use client';

import { FormEvent, useEffect, useState } from 'react';
import {
  DataPanel,
  PageFrame,
  PageSection,
  PageToolbar,
  buttonClass,
  fieldClass,
  formPanelClass,
  labelClass,
} from '@/components/page-frame';
import { PasswordField } from '@/components/password-field';
import { PayslipView, type Payslip } from '@/components/payslip-view';
import {
  Notice,
  Pagination,
  Switch,
  tableClass,
  tableHeadClass,
  tableRowClass,
  tableWrapClass,
} from '@/components/widgets';
import { apiJson } from '@/lib/api';
import type { SessionUser } from '@/lib/auth/types';
import {
  BLOOD_GROUPS,
  GENDERS,
  choiceError,
  dateInputValue,
  dateOfBirthError,
  digitsOnly,
  emailError,
  firstError,
  idCardError,
  joinedOnError,
  labelError,
  nameError,
  notesError,
  addressError,
  passwordError,
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

function formatAmount(value: number) {
  return value === 0 ? '' : String(value);
}

function parseAmount(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return 0;
  return Number(trimmed);
}

export default function EmployeesPage() {
  const [users, setUsers] = useState<SessionUser[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState('');
  const [role, setRole] = useState('');
  const [activeFilter, setActiveFilter] = useState('true');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [accountPhone, setAccountPhone] = useState('');
  const [accountSecondaryEmail, setAccountSecondaryEmail] = useState('');
  const [accountIdCard, setAccountIdCard] = useState('');
  const [accountDob, setAccountDob] = useState('');
  const [accountGender, setAccountGender] = useState('');
  const [accountJoined, setAccountJoined] = useState('');
  const [password, setPassword] = useState('');
  const [giveLogin, setGiveLogin] = useState(true);
  const [newRole, setNewRole] = useState<'employee' | 'dataview'>('employee');
  const [department, setDepartment] = useState('');
  const [designation, setDesignation] = useState('');
  const [salary, setSalary] = useState('');
  const [allowance, setAllowance] = useState('');
  const [medical, setMedical] = useState('');
  const [opd, setOpd] = useState('');
  const [selected, setSelected] = useState<SessionUser | null>(null);
  const [payMonth, setPayMonth] = useState('');
  const [payslip, setPayslip] = useState<Payslip | null>(null);
  const [history, setHistory] = useState<
    { id: string; at: string; label: string; detail: string | null }[]
  >([]);
  const [balances, setBalances] = useState<Balance[]>([]);
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
  const [editDepartment, setEditDepartment] = useState('');
  const [editDesignation, setEditDesignation] = useState('');
  const [editSalary, setEditSalary] = useState('');
  const [editAllowance, setEditAllowance] = useState('');
  const [editDeduction, setEditDeduction] = useState('');
  const [editMedical, setEditMedical] = useState('');
  const [editOpd, setEditOpd] = useState('');
  const [clockEnabled, setClockEnabled] = useState(true);
  const [shift, setShift] = useState<'day' | 'night'>('day');
  const [loginEnabled, setLoginEnabled] = useState(true);
  const [employmentStatus, setEmploymentStatus] = useState<'active' | 'resigned'>('active');
  const [employeeCode, setEmployeeCode] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  function load(nextPage = page, q = query, nextRole = role, nextActive = activeFilter) {
    const params = new URLSearchParams({ q, page: String(nextPage) });
    if (nextRole) params.set('role', nextRole);
    if (nextActive) params.set('active', nextActive);
    return apiJson<{ users: SessionUser[]; total: number }>(`/api/users?${params}`).then((data) => {
      setUsers(data.users);
      setTotal(data.total);
    });
  }

  useEffect(() => {
    load(1, '', '', 'true').catch((err: unknown) =>
      setError(err instanceof Error ? err.message : 'Could not load'),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (payMonth) return;
    const timer = window.setTimeout(() => {
      setPayMonth(new Date().toISOString().slice(0, 7));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [payMonth]);

  useEffect(() => {
    const employeeId = selected?.id;
    if (!employeeId || !payMonth) return;
    let ignore = false;
    apiJson<{ payslip: Payslip }>(`/api/payslips/${employeeId}?month=${payMonth}`)
      .then((data) => {
        if (!ignore) setPayslip(data.payslip);
      })
      .catch(() => {
        if (!ignore) setPayslip(null);
      });
    apiJson<{ activity: { id: string; at: string; label: string; detail: string | null }[] }>(
      `/api/users/${employeeId}/activity`,
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
  }, [selected?.id, payMonth]);

  async function create(event: FormEvent) {
    event.preventDefault();
    setError('');
    setMessage('');
    const employee = newRole === 'employee';
    const problem = firstError({
      full_name: nameError(fullName),
      email: emailError(email, true),
      phone: phoneError(accountPhone, true),
      secondary_email: secondaryEmailError(accountSecondaryEmail, email, true),
      id_card_number: idCardError(accountIdCard, employee),
      date_of_birth: dateOfBirthError(accountDob, employee),
      gender: choiceError(
        accountGender,
        'Gender',
        GENDERS.map((item) => item.value),
        employee,
      ),
      joined_on: joinedOnError(accountJoined),
      department: labelError(department, 'Department'),
      designation: labelError(designation, 'Designation'),
      password: giveLogin ? passwordError(password, true) : '',
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
          id_card_number: accountIdCard,
          date_of_birth: accountDob,
          gender: accountGender,
          joined_on: accountJoined,
          login_enabled: giveLogin,
          ...(giveLogin ? { password } : {}),
          role: newRole,
          department,
          designation,
          salary_basic: parseAmount(salary),
          salary_allowance: parseAmount(allowance),
          medical_limit: parseAmount(medical),
          opd_limit: parseAmount(opd),
        }),
      });
      setMessage('Account created.');
      setFullName('');
      setEmail('');
      setAccountPhone('');
      setAccountSecondaryEmail('');
      setAccountIdCard('');
      setAccountDob('');
      setAccountGender('');
      setAccountJoined('');
      setPassword('');
      setDepartment('');
      setDesignation('');
      setSalary('');
      setAllowance('');
      setMedical('');
      setOpd('');
      await load(1);
      setPage(1);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create');
    }
  }

  async function openPerson(person: SessionUser) {
    setError('');
    const data = await apiJson<{ user: SessionUser; balances: Balance[] }>(
      `/api/users/${person.id}`,
    );
    setSelected(data.user);
    setBalances(data.balances);
    setPhone(data.user.phone || '');
    setSecondaryEmail(data.user.secondary_email || '');
    setIdCard(digitsOnly(data.user.id_card_number || '', 13));
    setDateOfBirth(dateInputValue(data.user.date_of_birth));
    setGender(data.user.gender || '');
    setBloodGroup(data.user.blood_group || '');
    setEmergencyName(data.user.emergency_contact_name || '');
    setEmergencyPhone(digitsOnly(data.user.emergency_contact_phone || '', 12));
    setJoinedOn(dateInputValue(data.user.joined_on));
    setAddress(data.user.address || '');
    setInfo(data.user.info || '');
    setEditDepartment(data.user.department || '');
    setEditDesignation(data.user.designation || '');
    setEditSalary(formatAmount(data.user.salary_basic));
    setEditAllowance(formatAmount(data.user.salary_allowance));
    setEditDeduction(formatAmount(data.user.salary_deduction));
    setEditMedical(formatAmount(data.user.medical_limit));
    setEditOpd(formatAmount(data.user.opd_limit));
    setClockEnabled(data.user.clock_enabled);
    setShift(data.user.shift || 'day');
    setLoginEnabled(data.user.login_enabled);
    setEmploymentStatus(data.user.employment_status || 'active');
    setEmployeeCode(data.user.employee_code || '');
  }

  async function savePerson(event: FormEvent) {
    event.preventDefault();
    if (!selected) return;
    setError('');
    setMessage('');
    const employee = selected.role === 'employee';
    const problem = firstError({
      full_name: nameError(selected.full_name),
      phone: phoneError(phone, true),
      secondary_email: secondaryEmailError(secondaryEmail, selected.email, true),
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
      department: labelError(editDepartment, 'Department'),
      designation: labelError(editDesignation, 'Designation'),
      info: notesError(info),
    });
    if (problem) {
      setError(problem);
      return;
    }
    if (loginEnabled && !selected.login_enabled && !loginPassword) {
      setError('Set a password before turning sign-in on');
      return;
    }
    const leave_allocations = Object.fromEntries(
      balances.map((item) => [item.leave_type.code, item.allocated]),
    );
    try {
      await apiJson(`/api/users/${selected.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          full_name: selected.full_name,
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
          department: editDepartment,
          designation: editDesignation,
          salary_basic: parseAmount(editSalary),
          salary_allowance: parseAmount(editAllowance),
          salary_deduction: parseAmount(editDeduction),
          medical_limit: parseAmount(editMedical),
          opd_limit: parseAmount(editOpd),
          clock_enabled: clockEnabled,
          login_enabled: loginEnabled,
          shift,
          employment_status: employmentStatus,
          employee_code: employeeCode,
          ...(loginPassword ? { password: loginPassword } : {}),
          leave_allocations,
        }),
      });
      setMessage('Employee updated.');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update');
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
      setMessage(isActive ? 'Account activated.' : 'Account deactivated.');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update status');
    }
  }

  const pages = Math.max(1, Math.ceil(total / 20));

  return (
    <PageFrame title="Employees">
      <Notice error={error} message={message} />

      <PageSection
        title="New account"
        description="Employees also need a 13-digit ID card, date of birth, and gender. Phone numbers are 10 to 12 digits."
      >
        <form onSubmit={create} className={`${formPanelClass} md:grid-cols-2`}>
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
            autoComplete="off"
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
            autoComplete="off"
            maxLength={12}
            value={accountPhone}
            onChange={(event) => setAccountPhone(digitsOnly(event.target.value, 12))}
          />
          <input
            required
            type="email"
            className={fieldClass}
            placeholder="Secondary email"
            autoComplete="off"
            maxLength={254}
            value={accountSecondaryEmail}
            onChange={(event) => setAccountSecondaryEmail(event.target.value)}
          />
          <input
            className={fieldClass}
            inputMode="numeric"
            placeholder="ID card, 13 digits"
            maxLength={13}
            value={accountIdCard}
            onChange={(event) => setAccountIdCard(digitsOnly(event.target.value, 13))}
          />
          <input
            className={fieldClass}
            type="date"
            aria-label="Date of birth"
            value={accountDob}
            onChange={(event) => setAccountDob(event.target.value)}
          />
          <select
            className={fieldClass}
            aria-label="Gender"
            value={accountGender}
            onChange={(event) => setAccountGender(event.target.value)}
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
            type="date"
            aria-label="Joining date"
            value={accountJoined}
            onChange={(event) => setAccountJoined(event.target.value)}
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
          <input
            className={fieldClass}
            type="number"
            min="0"
            placeholder="Basic salary"
            value={salary}
            onChange={(event) => setSalary(event.target.value)}
          />
          <input
            className={fieldClass}
            type="number"
            min="0"
            placeholder="Allowance"
            value={allowance}
            onChange={(event) => setAllowance(event.target.value)}
          />
          <input
            className={fieldClass}
            type="number"
            min="0"
            placeholder="Medical limit"
            value={medical}
            onChange={(event) => setMedical(event.target.value)}
          />
          <input
            className={fieldClass}
            type="number"
            min="0"
            placeholder="OPD limit"
            value={opd}
            onChange={(event) => setOpd(event.target.value)}
          />
          <select
            className={fieldClass}
            value={newRole}
            onChange={(event) => setNewRole(event.target.value as 'employee' | 'dataview')}
          >
            <option value="employee">Employee</option>
            <option value="dataview">DataView</option>
          </select>
          <label className="text-ink flex items-center gap-2 text-sm md:col-span-2">
            <input
              type="checkbox"
              checked={giveLogin}
              onChange={(event) => setGiveLogin(event.target.checked)}
            />
            Give this person a login
          </label>
          {giveLogin ? (
            <PasswordField
              required
              value={password}
              onChange={setPassword}
              placeholder="Password, letter and number"
            />
          ) : (
            <p className="text-mute text-sm md:col-span-2">
              Saved as an employee record only. You can turn sign-in on later.
            </p>
          )}
          <button className={buttonClass} type="submit">
            Create account
          </button>
        </form>
      </PageSection>

      <PageSection title="Directory" description="Search, filter, and open an account to edit.">
        <PageToolbar>
          <input
            className={`${fieldClass} max-w-sm flex-1`}
            placeholder="Search name, email, department"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setPage(1);
              load(1, event.target.value).catch(() => undefined);
            }}
          />
          <select
            className={`${fieldClass} max-w-40`}
            value={role}
            onChange={(event) => {
              setRole(event.target.value);
              setPage(1);
              load(1, query, event.target.value).catch(() => undefined);
            }}
          >
            <option value="">All roles</option>
            <option value="employee">Employee</option>
            <option value="dataview">DataView</option>
          </select>
          <select
            className={`${fieldClass} max-w-44`}
            value={activeFilter}
            onChange={(event) => {
              setActiveFilter(event.target.value);
              setPage(1);
              load(1, query, role, event.target.value).catch(() => undefined);
            }}
            aria-label="Filter by account status"
          >
            <option value="">All statuses</option>
            <option value="true">Active</option>
            <option value="false">Inactive</option>
          </select>
        </PageToolbar>

        <DataPanel
          footer={
            <Pagination
              page={page}
              totalPages={pages}
              total={total}
              pageSize={20}
              onPageChange={(next) => {
                setPage(next);
                load(next).catch(() => undefined);
              }}
            />
          }
        >
          <div className={tableWrapClass}>
            <table className={tableClass}>
              <thead className={tableHeadClass}>
                <tr>
                  <th className="px-4 py-3.5">Name</th>
                  <th className="px-4 py-3.5">Role</th>
                  <th className="px-4 py-3.5">Department</th>
                  <th className="px-4 py-3.5">Status</th>
                </tr>
              </thead>
              <tbody>
                {users.length === 0 ? (
                  <tr>
                    <td className="text-mute px-4 py-6" colSpan={4}>
                      No accounts match these filters.
                    </td>
                  </tr>
                ) : null}
                {users.map((person) => (
                  <tr key={person.id} className={tableRowClass}>
                    <td className="px-4 py-3 font-semibold">
                      <button
                        type="button"
                        className="text-left"
                        onClick={() => openPerson(person).catch(() => undefined)}
                      >
                        {person.full_name}
                        <span className="text-mute block font-medium">
                          {person.email}
                          {person.employee_code ? ` · ${person.employee_code}` : ''}
                        </span>
                      </button>
                    </td>
                    <td className="px-4 py-3 capitalize">{person.role}</td>
                    <td className="px-4 py-3">
                      {person.department || '—'} · {person.designation || '—'}
                    </td>
                    <td className="px-4 py-3">
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
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </DataPanel>
      </PageSection>

      {selected ? (
        <PageSection title="Edit account" description={selected.email}>
          <div className="mb-6 flex max-w-xs flex-col gap-2">
            <label className={labelClass}>
              Payslip month
              <input
                className={`${fieldClass} mt-1`}
                type="month"
                value={payMonth}
                onChange={(event) => setPayMonth(event.target.value)}
              />
            </label>
          </div>
          {payslip ? (
            <div className="mb-8">
              <PayslipView slip={payslip} />
            </div>
          ) : null}
          {history.length > 0 ? (
            <div className="mb-8">
              <h2 className="text-ink mb-2 text-sm font-semibold">Recent activity</h2>
              <ul className="space-y-1">
                {history.slice(0, 6).map((item) => (
                  <li key={item.id} className="text-sm">
                    <span className="text-ink capitalize">{item.label}</span>
                    <span className="text-mute block text-xs">
                      {new Date(item.at).toLocaleString()}
                      {item.detail ? ` · ${item.detail}` : ''}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          <form onSubmit={savePerson} className={`${formPanelClass} md:grid-cols-2`}>
            <h2 className="text-ink text-sm font-medium md:col-span-2">{selected.full_name}</h2>
            <p className="text-mute text-sm md:col-span-2">{selected.email}</p>
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
              maxLength={254}
              value={secondaryEmail}
              onChange={(event) => setSecondaryEmail(event.target.value)}
            />
            <input
              className={fieldClass}
              inputMode="numeric"
              placeholder="ID card, 13 digits"
              maxLength={13}
              value={idCard}
              onChange={(event) => setIdCard(digitsOnly(event.target.value, 13))}
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
            <select
              className={fieldClass}
              aria-label="Blood group"
              value={bloodGroup}
              onChange={(event) => setBloodGroup(event.target.value)}
            >
              <option value="">Blood group</option>
              {BLOOD_GROUPS.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
            <input
              className={fieldClass}
              placeholder="Emergency contact name"
              maxLength={80}
              value={emergencyName}
              onChange={(event) => setEmergencyName(withoutDigits(event.target.value))}
            />
            <input
              className={fieldClass}
              type="tel"
              inputMode="numeric"
              placeholder="Emergency phone, 10–12 digits"
              maxLength={12}
              value={emergencyPhone}
              onChange={(event) => setEmergencyPhone(digitsOnly(event.target.value, 12))}
            />
            <input
              className={fieldClass}
              type="date"
              aria-label="Joining date"
              value={joinedOn}
              onChange={(event) => setJoinedOn(event.target.value)}
            />
            <input
              className={fieldClass}
              placeholder="Address"
              value={address}
              onChange={(event) => setAddress(event.target.value)}
            />
            <input
              className={fieldClass}
              placeholder="Department"
              value={editDepartment}
              onChange={(event) => setEditDepartment(event.target.value)}
            />
            <input
              className={fieldClass}
              placeholder="Designation"
              value={editDesignation}
              onChange={(event) => setEditDesignation(event.target.value)}
            />
            <input
              className={fieldClass}
              placeholder="Employment notes"
              value={info}
              onChange={(event) => setInfo(event.target.value)}
            />
            <input
              className={fieldClass}
              type="number"
              min="0"
              value={editSalary}
              onChange={(event) => setEditSalary(event.target.value)}
            />
            <input
              className={fieldClass}
              type="number"
              min="0"
              value={editAllowance}
              onChange={(event) => setEditAllowance(event.target.value)}
            />
            <input
              className={fieldClass}
              type="number"
              min="0"
              value={editDeduction}
              onChange={(event) => setEditDeduction(event.target.value)}
            />
            <input
              className={fieldClass}
              type="number"
              min="0"
              value={editMedical}
              onChange={(event) => setEditMedical(event.target.value)}
            />
            <input
              className={fieldClass}
              type="number"
              min="0"
              value={editOpd}
              onChange={(event) => setEditOpd(event.target.value)}
            />
            <label className="flex items-center gap-2 text-sm font-bold">
              <input
                type="checkbox"
                checked={clockEnabled}
                onChange={(event) => setClockEnabled(event.target.checked)}
              />
              Clock in enabled
            </label>
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
                placeholder="Set a password to turn sign-in on"
              />
            ) : null}
            <select
              className={fieldClass}
              aria-label="Shift"
              value={shift}
              onChange={(event) => setShift(event.target.value as 'day' | 'night')}
            >
              <option value="day">Day shift</option>
              <option value="night">Night shift</option>
            </select>
            <select
              className={fieldClass}
              aria-label="Employment"
              value={employmentStatus}
              onChange={(event) => setEmploymentStatus(event.target.value as 'active' | 'resigned')}
            >
              <option value="active">Employed</option>
              <option value="resigned">Resigned</option>
            </select>
            <input
              className={fieldClass}
              aria-label="Employee code"
              placeholder="Employee code"
              value={employeeCode}
              onChange={(event) => setEmployeeCode(event.target.value.toUpperCase())}
            />
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
            <button className={buttonClass} type="submit">
              Save employee
            </button>
          </form>
        </PageSection>
      ) : null}
    </PageFrame>
  );
}
