'use client';

import { FormEvent, useEffect, useState } from 'react';
import {
  PageFrame,
  buttonClass,
  buttonSecondaryClass,
  fieldClass,
  sectionTitleClass,
} from '@/components/page-frame';
import { PictureField } from '@/components/picture-field';
import { Card, Notice } from '@/components/widgets';
import { apiJson } from '@/lib/api';

interface LeaveType {
  id: string;
  code: string;
  name: string;
  default_days: number;
}

interface Department {
  id: string;
  name: string;
  medical_limit: number;
  opd_limit: number;
}

function formatDays(value: number) {
  return value === 0 ? '' : String(value);
}

function parseDays(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return 0;
  return Number(trimmed);
}

export default function CompanyPage() {
  const [weekend, setWeekend] = useState<string[]>(['0']);
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
  const [leaveDefaults, setLeaveDefaults] = useState<Record<string, string>>({});
  const [logo, setLogo] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [deptName, setDeptName] = useState('');
  const [deptMedical, setDeptMedical] = useState('');
  const [deptOpd, setDeptOpd] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  function loadDepartments() {
    return apiJson<{ departments: Department[] }>('/api/company/departments').then((data) =>
      setDepartments(data.departments),
    );
  }

  useEffect(() => {
    Promise.all([
      apiJson<{ company: { logo_url: string | null; weekend_days: string } }>('/api/company'),
      apiJson<{ types: LeaveType[] }>('/api/leave/types'),
      loadDepartments(),
    ]).then(([companyRes, leaveRes]) => {
      setWeekend(companyRes.company.weekend_days.split(',').filter(Boolean));
      setLogo(companyRes.company.logo_url);
      setPreview(companyRes.company.logo_url);
      setLeaveTypes(leaveRes.types);
      setLeaveDefaults(
        Object.fromEntries(
          leaveRes.types.map((type) => [type.code, formatDays(type.default_days)]),
        ),
      );
    });
  }, []);

  async function save(event: FormEvent) {
    event.preventDefault();
    setError('');
    setMessage('');
    try {
      await apiJson('/api/company', {
        method: 'PATCH',
        body: JSON.stringify({ weekend_days: weekend.join(',') }),
      });
      const defaults = Object.fromEntries(
        leaveTypes.map((type) => [type.code, parseDays(leaveDefaults[type.code] ?? '')]),
      );
      const updated = await apiJson<{ types: LeaveType[] }>('/api/leave/types', {
        method: 'PATCH',
        body: JSON.stringify({ defaults }),
      });
      setLeaveTypes(updated.types);
      setLeaveDefaults(
        Object.fromEntries(updated.types.map((type) => [type.code, formatDays(type.default_days)])),
      );
      if (file) {
        const form = new FormData();
        form.append('picture', file);
        const uploaded = await apiJson<{ company: { logo_url: string | null } }>(
          '/api/company/logo',
          { method: 'POST', body: form },
        );
        setLogo(uploaded.company.logo_url);
        setPreview(uploaded.company.logo_url);
        setFile(null);
      }
      setMessage('Settings saved.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save');
    }
  }

  async function removeLogo() {
    await apiJson('/api/company', { method: 'PATCH', body: JSON.stringify({ logo_url: null }) });
    setLogo(null);
    setPreview(null);
    setFile(null);
  }

  async function addDepartment() {
    if (!deptName.trim()) {
      setError('Department name is required');
      return;
    }
    setError('');
    try {
      await apiJson('/api/company/departments', {
        method: 'POST',
        body: JSON.stringify({
          name: deptName,
          medical_limit: parseDays(deptMedical),
          opd_limit: parseDays(deptOpd),
        }),
      });
      setDeptName('');
      setDeptMedical('');
      setDeptOpd('');
      setMessage('Department added.');
      await loadDepartments();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add department');
    }
  }

  async function saveDepartment(dept: Department) {
    setError('');
    try {
      await apiJson(`/api/company/departments/${dept.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          name: dept.name,
          medical_limit: dept.medical_limit,
          opd_limit: dept.opd_limit,
        }),
      });
      setMessage('Department updated.');
      await loadDepartments();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update department');
    }
  }

  async function removeDepartment(id: string) {
    setError('');
    try {
      await apiJson(`/api/company/departments/${id}`, { method: 'DELETE' });
      setMessage('Department removed.');
      await loadDepartments();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not remove department');
    }
  }

  return (
    <PageFrame
      title="Company Settings"
      description="Departments with medical and OPD limits, weekends, default leave, and logo."
    >
      <Notice error={error} message={message} />
      <form onSubmit={save} className="grid max-w-2xl gap-6">
        <Card title="Weekends">
          <fieldset>
            <legend className={sectionTitleClass}>Non-working days</legend>
            <p className="text-mute mb-3 text-sm font-medium">
              Used for leave and payslip working days.
            </p>
            <div className="flex flex-wrap gap-2">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, index) => {
                const on = weekend.includes(String(index));
                return (
                  <button
                    key={day}
                    type="button"
                    onClick={() =>
                      setWeekend((current) =>
                        on
                          ? current.filter((item) => item !== String(index))
                          : [...current, String(index)],
                      )
                    }
                    className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition ${
                      on
                        ? 'border-primary bg-primary text-primary-on shadow-sm'
                        : 'border-line bg-paper text-mute hover:border-primary/40 hover:bg-primary-soft'
                    }`}
                  >
                    {day}
                  </button>
                );
              })}
            </div>
          </fieldset>
        </Card>

        <Card title="Departments">
          <p className="text-mute mb-4 text-sm font-medium">
            New employees pick a department and receive its medical and OPD limits automatically.
          </p>
          <div className="mb-4 grid gap-3 sm:grid-cols-4">
            <input
              className={fieldClass}
              placeholder="Department name"
              value={deptName}
              onChange={(event) => setDeptName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  void addDepartment();
                }
              }}
            />
            <input
              className={fieldClass}
              type="number"
              min="0"
              placeholder="Medical limit"
              value={deptMedical}
              onChange={(event) => setDeptMedical(event.target.value)}
            />
            <input
              className={fieldClass}
              type="number"
              min="0"
              placeholder="OPD limit"
              value={deptOpd}
              onChange={(event) => setDeptOpd(event.target.value)}
            />
            <button
              type="button"
              className={buttonSecondaryClass}
              onClick={() => void addDepartment()}
            >
              Add department
            </button>
          </div>
          {departments.length > 0 ? (
            <ul className="divide-line divide-y">
              {departments.map((dept) => (
                <li
                  key={dept.id}
                  className="grid gap-3 py-3 sm:grid-cols-[1fr_8rem_8rem_auto_auto] sm:items-center"
                >
                  <input
                    className={fieldClass}
                    value={dept.name}
                    onChange={(event) =>
                      setDepartments((rows) =>
                        rows.map((row) =>
                          row.id === dept.id ? { ...row, name: event.target.value } : row,
                        ),
                      )
                    }
                  />
                  <input
                    className={fieldClass}
                    type="number"
                    min="0"
                    value={dept.medical_limit}
                    onChange={(event) =>
                      setDepartments((rows) =>
                        rows.map((row) =>
                          row.id === dept.id
                            ? { ...row, medical_limit: Number(event.target.value) || 0 }
                            : row,
                        ),
                      )
                    }
                  />
                  <input
                    className={fieldClass}
                    type="number"
                    min="0"
                    value={dept.opd_limit}
                    onChange={(event) =>
                      setDepartments((rows) =>
                        rows.map((row) =>
                          row.id === dept.id
                            ? { ...row, opd_limit: Number(event.target.value) || 0 }
                            : row,
                        ),
                      )
                    }
                  />
                  <button
                    type="button"
                    className={buttonSecondaryClass}
                    onClick={() => saveDepartment(dept)}
                  >
                    Save
                  </button>
                  <button
                    type="button"
                    className={`${buttonSecondaryClass} text-danger border-danger/20`}
                    onClick={() => removeDepartment(dept.id)}
                  >
                    Delete
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-mute text-sm">No departments yet. Add one above.</p>
          )}
        </Card>

        <Card title="Default leave (new employees)">
          <p className="text-mute mb-4 text-sm font-medium">
            Applied when HR creates an employee. You can still override per person on the employee
            record.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            {leaveTypes.map((type) => (
              <label key={type.id} className="block">
                <span className={sectionTitleClass}>{type.name}</span>
                <input
                  className={fieldClass}
                  type="number"
                  min="0"
                  step="1"
                  placeholder="Days"
                  value={leaveDefaults[type.code] ?? ''}
                  onChange={(event) =>
                    setLeaveDefaults((current) => ({ ...current, [type.code]: event.target.value }))
                  }
                />
              </label>
            ))}
          </div>
        </Card>

        <Card title="Logo">
          <PictureField
            preview={preview}
            onFile={(next) => {
              setFile(next);
              setPreview((current) => {
                if (current?.startsWith('blob:')) URL.revokeObjectURL(current);
                return next ? URL.createObjectURL(next) : logo;
              });
            }}
          />
          {logo ? (
            <button
              type="button"
              className={`${buttonSecondaryClass} text-danger border-danger/20 hover:bg-danger/5 mt-4`}
              onClick={removeLogo}
            >
              Remove logo
            </button>
          ) : null}
        </Card>

        <button className={buttonClass} type="submit">
          Save changes
        </button>
      </form>
    </PageFrame>
  );
}
