'use client';

import { useEffect, useState } from 'react';
import { PageFrame } from '@/components/page-frame';
import { apiJson } from '@/lib/api';

interface Log {
  id: string;
  action: string;
  target_type: string;
  detail: string | null;
  created_at: string;
  actor: { full_name: string; role: string } | null;
}

export default function LogsPage() {
  const [logs, setLogs] = useState<Log[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    apiJson<{ logs: Log[] }>('/api/audit')
      .then((data) => setLogs(data.logs))
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Could not load'));
  }, []);

  return (
    <PageFrame title="Activity" description="Important account, request, and settings changes.">
      {error ? <p className="text-danger text-sm font-bold">{error}</p> : null}
      <ul className="space-y-2">
        {logs.map((log) => (
          <li
            key={log.id}
            className="border-line bg-paper rounded-xl border px-4 py-3 text-sm shadow-sm"
          >
            <p className="font-extrabold">{log.action}</p>
            <p className="text-mute">
              {log.actor?.full_name || 'System'} · {log.target_type} ·{' '}
              {new Date(log.created_at).toLocaleString()}
            </p>
            {log.detail ? <p>{log.detail}</p> : null}
          </li>
        ))}
      </ul>
    </PageFrame>
  );
}
