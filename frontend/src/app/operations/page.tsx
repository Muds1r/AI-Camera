'use client';

import { useEffect, useState } from 'react';
import {
  PageFrame,
  fieldClass,
  tabActiveClass,
  tabBarClass,
  tabIdleClass,
} from '@/components/page-frame';
import { Badge, Notice } from '@/components/widgets';
import { apiJson } from '@/lib/api';

type Tab = 'detections' | 'alerts';

interface Detection {
  id: string;
  label: string;
  confidence: number;
  created_at: string;
  cameras?: { name?: string; location?: string } | null;
}

interface Alert {
  id: string;
  severity: string;
  message: string;
  is_read: boolean;
  created_at: string;
  cameras?: { name?: string } | null;
}

export default function OperationsPage() {
  const [tab, setTab] = useState<Tab>('detections');
  const [detections, setDetections] = useState<Detection[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [severity, setSeverity] = useState('');
  const [error, setError] = useState('');

  function load(nextSeverity = severity) {
    const alertQuery = nextSeverity ? `?severity=${encodeURIComponent(nextSeverity)}` : '';
    return Promise.all([
      apiJson<{ detections: Detection[] }>('/api/detections?limit=50'),
      apiJson<{ alerts: Alert[] }>(`/api/alerts${alertQuery}`),
    ]).then(([found, raised]) => {
      setDetections(found.detections);
      setAlerts(raised.alerts);
    });
  }

  useEffect(() => {
    load('').catch((err: unknown) =>
      setError(err instanceof Error ? err.message : 'Could not load operational data'),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <PageFrame
      title="Operational Data"
      description="Detections and alerts recorded by the cameras."
    >
      <Notice error={error} />
      <div className={`${tabBarClass} items-center`}>
        {(['detections', 'alerts'] as Tab[]).map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setTab(item)}
            className={tab === item ? tabActiveClass : tabIdleClass}
          >
            {item === 'detections' ? 'Detections' : 'Alerts'}
          </button>
        ))}
        {tab === 'alerts' ? (
          <select
            className={`${fieldClass} max-w-40`}
            value={severity}
            onChange={(event) => {
              setSeverity(event.target.value);
              load(event.target.value).catch(() => undefined);
            }}
          >
            <option value="">All severities</option>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
        ) : null}
      </div>

      {tab === 'detections' ? (
        <ul className="space-y-2">
          {!error && detections.length === 0 ? (
            <p className="text-mute text-sm">No detections recorded.</p>
          ) : null}
          {detections.map((item) => (
            <li
              key={item.id}
              className="border-line bg-paper rounded-xl border px-4 py-3 text-sm shadow-sm"
            >
              <p className="font-extrabold">{item.label}</p>
              <p className="text-mute">
                {item.cameras?.name || 'Camera'} · {Math.round(Number(item.confidence) * 100)}% ·{' '}
                {new Date(item.created_at).toLocaleString()}
              </p>
            </li>
          ))}
        </ul>
      ) : (
        <ul className="space-y-2">
          {!error && alerts.length === 0 ? (
            <p className="text-mute text-sm">No alerts recorded.</p>
          ) : null}
          {alerts.map((item) => (
            <li
              key={item.id}
              className="border-line bg-paper flex items-center justify-between rounded-xl border px-4 py-3 text-sm shadow-sm"
            >
              <div>
                <p className="font-extrabold">{item.message}</p>
                <p className="text-mute">
                  {item.cameras?.name || 'Camera'} · {new Date(item.created_at).toLocaleString()}
                </p>
              </div>
              <Badge status={item.severity} />
            </li>
          ))}
        </ul>
      )}
    </PageFrame>
  );
}
