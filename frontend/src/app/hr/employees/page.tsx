'use client';

import { FormEvent, useEffect, useState } from 'react';
import { PageFrame, buttonClass, fieldClass } from '@/components/page-frame';
import { PasswordField } from '@/components/password-field';
import { ConfirmDialog, Notice } from '@/components/widgets';
import { apiJson } from '@/lib/api';
import type { SessionUser } from '@/lib/auth/types';

interface Balance {
  id: string;
  allocated: number;
  used: number;
  leave_type: { code: string; name: string };
}

export default function EmployeesPage() {
  const [users, setUsers] = useState<SessionUser[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState('');
  const [role, setRole] = useState('');
  const [active, setActive] = useState('');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [newRole, setNewRole] = useState<'employee' | 'dataview'>('employee');
  const [department, setDepartment] = useState('');
  const [designation, setDesignation] = useState('');
  const [salary, setSalary] = useState('0');
  const [allowance, setAllowance] = useState('0');
  const [deduction, setDeduction] = useState('0');
  const [medical, setMedical] = useState('0');
  const [opd, setOpd] = useState('0');
  const [selected, setSelected] = useState<SessionUser | null>(null);
  const [balances, setBalances] = useState<Balance[]>([]);
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [info, setInfo] = useState('');
  const [editDepartment, setEditDepartment] = useState('');
  const [editDesignation, setEditDesignation] = useState('');
  const [editSalary, setEditSalary] = useState('0');
  const [editAllowance, setEditAllowance] = useState('0');
  const [editDeduction, setEditDeduction] = useState('0');
  const [editMedical, setEditMedical] = useState('0');
  const [editOpd, setEditOpd] = useState('0');
  const [clockEnabled, setClockEnabled] = useState(true);
  const [confirming, setConfirming] = useState<SessionUser | null>(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  function load(nextPage = page, q = query, nextRole = role, nextActive = active) {
    const params = new URLSearchParams({ q, page: String(nextPage) });
    if (nextRole) params.set('role', nextRole);
    if (nextActive) params.set('active', nextActive);
    return apiJson<{ users: SessionUser[]; total: number }>(`/api/users?${params}`).then((data) => {
      setUsers(data.users);
      setTotal(data.total);
    });
  }

  useEffect(() => {
    load(1, '', '', '').catch((err: unknown) =>
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
          salary_basic: Number(salary),
          salary_allowance: Number(allowance),
          salary_deduction: Number(deduction),
          medical_limit: Number(medical),
          opd_limit: Number(opd),
          clock_enabled: newRole !== 'dataview',
        }),
      });
      setMessage('Account created.');
      setFullName('');
      setEmail('');
      setPassword('');
      await load(1);
      setPage(1);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create');
    }
  }

  async function openPerson(person: SessionUser) {
    setError('');
    const data = await apiJson<{ user: SessionUser; balances: Balance[] }>(`/api/users/${person.id}`);
    setSelected(data.user);
    setBalances(data.balances);
    setPhone(data.user.phone || '');
    setAddress(data.user.address || '');
    setInfo(data.user.info || '');
    setEditDepartment(data.user.department || '');
    setEditDesignation(data.user.designation || '');
    setEditSalary(String(data.user.salary_basic));
    setEditAllowance(String(data.user.salary_allowance));
    setEditDeduction(String(data.user.salary_deduction));
    setEditMedical(String(data.user.medical_limit));
    setEditOpd(String(data.user.opd_limit));
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
          salary_basic: Number(editSalary),
          salary_allowance: Number(editAllowance),
          salary_deduction: Number(editDeduction),
          medical_limit: Number(editMedical),
          opd_limit: Number(editOpd),
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

  async function toggle(person: SessionUser) {
    await apiJson(`/api/users/${person.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ is_active: !person.is_active }),
    });
    setConfirming(null);
    setMessage(person.is_active ? 'Account deactivated.' : 'Account activated.');
    await load();
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
        className="border-line bg-paper mb-6 grid gap-3 rounded-xl border p-5 shadow-sm md:grid-cols-2"
      >
        <input required className={fieldClass} placeholder="Full name" value={fullName} onChange={(event) => setFullName(event.target.value)} />
        <input required type="email" className={fieldClass} placeholder="Email" value={email} onChange={(event) => setEmail(event.target.value)} />
        <input className={fieldClass} placeholder="Department" value={department} onChange={(event) => setDepartment(event.target.value)} />
        <input className={fieldClass} placeholder="Designation" value={designation} onChange={(event) => setDesignation(event.target.value)} />
        <input className={fieldClass} type="number" min="0" placeholder="Basic salary" value={salary} onChange={(event) => setSalary(event.target.value)} />
        <input className={fieldClass} type="number" min="0" placeholder="Allowance" value={allowance} onChange={(event) => setAllowance(event.target.value)} />
        <input className={fieldClass} type="number" min="0" placeholder="Deduction" value={deduction} onChange={(event) => setDeduction(event.target.value)} />
        <input className={fieldClass} type="number" min="0" placeholder="Medical limit" value={medical} onChange={(event) => setMedical(event.target.value)} />
        <input className={fieldClass} type="number" min="0" placeholder="OPD limit" value={opd} onChange={(event) => setOpd(event.target.value)} />
        <select className={fieldClass} value={newRole} onChange={(event) => setNewRole(event.target.value as 'employee' | 'dataview')}>
          <option value="employee">Employee</option>
          <option value="dataview">DataView</option>
        </select>
        <PasswordField required value={password} onChange={setPassword} placeholder="Temporary password" />
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
          className={`${fieldClass} max-w-40`}
          value={active}
          onChange={(event) => {
            setActive(event.target.value);
            setPage(1);
            load(1, query, role, event.target.value).catch(() => undefined);
          }}
        >
          <option value="">Any status</option>
          <option value="true">Active</option>
          <option value="false">Inactive</option>
        </select>
      </div>

      <div className="border-line bg-paper overflow-x-auto rounded-xl border shadow-sm">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="bg-canvas text-mute text-xs font-bold uppercase">
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
              <tr key={person.id} className="border-line border-t">
                <td className="px-4 py-3 font-bold">
                  <button type="button" className="text-left" onClick={() => openPerson(person).catch(() => undefined)}>
                    {person.full_name}
                    <span className="text-mute block font-medium">{person.email}</span>
                  </button>
                </td>
                <td className="px-4 py-3 capitalize">{person.role}</td>
                <td className="px-4 py-3">
                  {person.department || '—'} · {person.designation || '—'}
                </td>
                <td className="px-4 py-3">
                  <button type="button" className="font-bold" onClick={() => setConfirming(person)}>
                    {person.is_active ? 'Active' : 'Inactive'}
                  </button>
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
        <form onSubmit={savePerson} className="border-line bg-paper mt-6 grid gap-3 rounded-xl border p-5 shadow-sm md:grid-cols-2">
          <h2 className="font-extrabold md:col-span-2">{selected.full_name}</h2>
          <p className="text-mute text-sm md:col-span-2">{selected.email}</p>
          <input className={fieldClass} value={selected.full_name} onChange={(event) => setSelected({ ...selected, full_name: event.target.value })} />
          <input className={fieldClass} placeholder="Phone" value={phone} onChange={(event) => setPhone(event.target.value)} />
          <input className={fieldClass} placeholder="Address" value={address} onChange={(event) => setAddress(event.target.value)} />
          <input className={fieldClass} placeholder="Department" value={editDepartment} onChange={(event) => setEditDepartment(event.target.value)} />
          <input className={fieldClass} placeholder="Designation" value={editDesignation} onChange={(event) => setEditDesignation(event.target.value)} />
          <input className={fieldClass} placeholder="Employment notes" value={info} onChange={(event) => setInfo(event.target.value)} />
          <input className={fieldClass} type="number" min="0" value={editSalary} onChange={(event) => setEditSalary(event.target.value)} />
          <input className={fieldClass} type="number" min="0" value={editAllowance} onChange={(event) => setEditAllowance(event.target.value)} />
          <input className={fieldClass} type="number" min="0" value={editDeduction} onChange={(event) => setEditDeduction(event.target.value)} />
          <input className={fieldClass} type="number" min="0" value={editMedical} onChange={(event) => setEditMedical(event.target.value)} />
          <input className={fieldClass} type="number" min="0" value={editOpd} onChange={(event) => setEditOpd(event.target.value)} />
          <label className="flex items-center gap-2 text-sm font-bold">
            <input type="checkbox" checked={clockEnabled} onChange={(event) => setClockEnabled(event.target.checked)} />
            Clock in enabled
          </label>
          {balances.map((item) => (
            <label key={item.id} className="text-xs font-bold uppercase">
              {item.leave_type.name} allocated
              <input
                className={`${fieldClass} mt-1`}
                type="number"
                min="0"
                value={item.allocated}
                onChange={(event) =>
                  setBalances((current) =>
                    current.map((balance) =>
                      balance.id === item.id ? { ...balance, allocated: Number(event.target.value) } : balance,
                    ),
                  )
                }
              />
            </label>
          ))}
          <button className={buttonClass} type="submit">
            Save employee
          </button>
        </form>
      ) : null}

      <ConfirmDialog
        open={Boolean(confirming)}
        title={confirming?.is_active ? 'Deactivate this account?' : 'Activate this account?'}
        detail={confirming ? `${confirming.full_name} will ${confirming.is_active ? 'lose' : 'regain'} access.` : undefined}
        confirmLabel={confirming?.is_active ? 'Deactivate' : 'Activate'}
        onClose={() => setConfirming(null)}
        onConfirm={() => {
          if (confirming) toggle(confirming).catch(() => undefined);
        }}
      />
    </PageFrame>
  );
}
