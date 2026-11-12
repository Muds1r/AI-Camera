'use client';

import { FormEvent, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  DataPanel,
  PageFrame,
  PageSection,
  PageToolbar,
  buttonClass,
  fieldClass,
  formPanelClass,
} from '@/components/page-frame';
import { PasswordField } from '@/components/password-field';
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
  GENDERS,
  choiceError,
  dateOfBirthError,
  digitsOnly,
  emailError,
  firstError,
  idCardError,
  joinedOnError,
  labelError,
  nameError,
  passwordError,
  phoneError,
  secondaryEmailError,
  withoutDigits,
} from '@/lib/fields';

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
          clock_enabled: newRole !== 'dataview',
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
            Can sign in
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
              Saved as a record only. You can turn sign-in on later and set a password.
            </p>
          )}
          <button className={buttonClass} type="submit">
            Create account
          </button>
        </form>
      </PageSection>

      <PageSection
        title="Directory"
        description="Open a person to see their details, payslip, and edit their record."
      >
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
                      <Link href={`/hr/employees/${person.id}`} className="block text-left">
                        {person.full_name}
                        <span className="text-mute block font-medium">
                          {person.email}
                          {person.employee_code ? ` · ${person.employee_code}` : ''}
                        </span>
                      </Link>
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
    </PageFrame>
  );
}
