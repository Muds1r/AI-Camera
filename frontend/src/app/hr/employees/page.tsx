'use client';

import { FormEvent, useEffect, useState } from 'react';
import { PageFrame, buttonClass, fieldClass } from '@/components/page-frame';
import { PasswordField } from '@/components/password-field';
import {
  Notice,
  Switch,
  tableClass,
  tableHeadClass,
  tableRowClass,
  tableWrapClass,
} from '@/components/widgets';
import { apiJson } from '@/lib/api';
import type { SessionUser } from '@/lib/auth/types';

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
  const [password, setPassword] = useState('');
  const [newRole, setNewRole] = useState<'employee' | 'dataview'>('employee');
  const [department, setDepartment] = useState('');
  const [designation, setDesignation] = useState('');
  const [salary, setSalary] = useState('');
  const [allowance, setAllowance] = useState('');
  const [medical, setMedical] = useState('');
  const [opd, setOpd] = useState('');
  const [selected, setSelected] = useState<SessionUser | null>(null);
  const [balances, setBalances] = useState<Balance[]>([]);
  const [phone, setPhone] = useState('');
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
    try {
      await apiJson('/api/users', {
        method: 'POST',
        body: JSON.stringify({
          full_name: fullName,
          email,
          password,
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
  }

  async function savePerson(event: FormEvent) {
    event.preventDefault();
    if (!selected) return;
    setError('');
    setMessage('');
    const leave_allocations = Object.fromEntries(
      balances.map((item) => [item.leave_type.code, item.allocated]),
    );
    try {
      await apiJson(`/api/users/${selected.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          full_name: selected.full_name,
          phone,
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
    <PageFrame
      title="Employees"
      description="Create and update Employee or DataView accounts. Email stays with the account that was created."
    >
      <Notice error={error} message={message} />
      <form
        onSubmit={create}
        className="border-line bg-paper mb-6 grid gap-3 rounded-2xl border p-5 md:grid-cols-2"
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
        <PasswordField
          required
          value={password}
          onChange={setPassword}
          placeholder="Temporary password"
        />
        <button className={buttonClass} type="submit">
          Create account
        </button>
      </form>

      <div className="mb-4 flex flex-wrap gap-2">
        <input
          className={`${fieldClass} max-w-sm`}
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
      </div>

      <div className={tableWrapClass}>
        <table className={tableClass}>
          <thead className={tableHeadClass}>
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3">Department</th>
              <th className="px-4 py-3">Status</th>
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
                <td className="px-4 py-3 font-bold">
                  <button
                    type="button"
                    className="text-left"
                    onClick={() => openPerson(person).catch(() => undefined)}
                  >
                    {person.full_name}
                    <span className="text-mute block font-medium">{person.email}</span>
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
      <div className="mt-3 flex items-center gap-3 text-sm">
        <button
          type="button"
          className="font-bold"
          disabled={page <= 1}
          onClick={() => {
            const next = page - 1;
            setPage(next);
            load(next).catch(() => undefined);
          }}
        >
          Previous
        </button>
        <span className="text-mute">
          Page {page} of {pages}
        </span>
        <button
          type="button"
          className="font-bold"
          disabled={page >= pages}
          onClick={() => {
            const next = page + 1;
            setPage(next);
            load(next).catch(() => undefined);
          }}
        >
          Next
        </button>
      </div>

      {selected ? (
        <form
          onSubmit={savePerson}
          className="border-line bg-paper mt-6 grid gap-3 rounded-2xl border p-5 md:grid-cols-2"
        >
          <h2 className="font-extrabold md:col-span-2">{selected.full_name}</h2>
          <p className="text-mute text-sm md:col-span-2">{selected.email}</p>
          <input
            className={fieldClass}
            value={selected.full_name}
            onChange={(event) => setSelected({ ...selected, full_name: event.target.value })}
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
          {balances.map((item) => (
            <label key={item.id} className="text-xs font-bold uppercase">
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
      ) : null}
    </PageFrame>
  );
}
