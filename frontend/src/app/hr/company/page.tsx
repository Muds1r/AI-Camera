'use client';

import { FormEvent, useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { PageFrame, buttonClass, fieldClass } from '@/components/page-frame';
import { PictureField } from '@/components/picture-field';
import { Notice } from '@/components/widgets';
import { apiJson } from '@/lib/api';

export default function CompanyPage() {
  const system = usePathname().startsWith('/admin');
  const [name, setName] = useState('');
  const [workStart, setWorkStart] = useState('09:00');
  const [weekend, setWeekend] = useState<string[]>(['0']);
  const [logo, setLogo] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    apiJson<{
      company: { name: string; logo_url: string | null; weekend_days: string; work_start: string };
    }>('/api/company').then((data) => {
      setName(data.company.name);
      setWorkStart(data.company.work_start);
      setWeekend(data.company.weekend_days.split(',').filter(Boolean));
      setLogo(data.company.logo_url);
      setPreview(data.company.logo_url);
    });
  }, []);

  async function save(event: FormEvent) {
    event.preventDefault();
    setError('');
    setMessage('');
    try {
      await apiJson('/api/company', {
        method: 'PATCH',
        body: JSON.stringify({ name, work_start: workStart, weekend_days: weekend.join(',') }),
      });
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
      setMessage('Company settings saved.');
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

  return (
    <PageFrame
      title={system ? 'System Settings' : 'Company Settings'}
      description="Company name, logo, work start, and weekend days. The name and logo appear on the login page and in the sidebar."
    >
      <Notice error={error} message={message} />
      <form
        onSubmit={save}
        className="border-line bg-paper max-w-xl space-y-4 rounded-xl border p-5 shadow-sm"
      >
        <label className="block text-xs font-bold uppercase">
          Company name
          <input
            className={`${fieldClass} mt-1`}
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
          />
        </label>
        <label className="block text-xs font-bold uppercase">
          Work starts
          <input
            className={`${fieldClass} mt-1`}
            type="time"
            value={workStart}
            onChange={(event) => setWorkStart(event.target.value)}
            required
          />
        </label>
        <fieldset>
          <legend className="text-xs font-bold uppercase">Weekend days</legend>
          <div className="mt-2 flex flex-wrap gap-3 text-sm">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, index) => (
              <label key={day} className="flex items-center gap-1 font-semibold">
                <input
                  type="checkbox"
                  checked={weekend.includes(String(index))}
                  onChange={(event) =>
                    setWeekend((current) =>
                      event.target.checked
                        ? [...current, String(index)]
                        : current.filter((item) => item !== String(index)),
                    )
                  }
                />
                {day}
              </label>
            ))}
          </div>
        </fieldset>
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
          <button type="button" className="text-danger text-sm font-bold" onClick={removeLogo}>
            Remove logo
          </button>
        ) : null}
        <button className={buttonClass} type="submit">
          Save branding
        </button>
      </form>
    </PageFrame>
  );
}
