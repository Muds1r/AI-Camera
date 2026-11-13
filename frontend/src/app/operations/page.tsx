'use client';

import { useEffect, useState } from 'react';
import {
  PageFrame,
  fieldClass,
  tabActiveClass,
  tabBarClass,
  tabIdleClass,
} from '@/components/page-frame';
import { EmptyState, ListRow, Notice, Pagination } from '@/components/widgets';
import { apiJson } from '@/lib/api';
import { usePaged } from '@/lib/use-paged';

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
  const detectionPage = usePaged(detections, 8);
  const alertPage = usePaged(alerts, 8);

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
    <PageFrame title="Operations" description="Detections and alerts from camera systems.">
      <Notice error={error} />
      <div className={`${tabBarClass} flex-wrap items-center`}>
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
            className={`${fieldClass} ml-1 max-w-36 border-0 bg-transparent py-1.5 text-sm shadow-none ring-0`}
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
        <>
          <Feed empty={!error && detections.length === 0} emptyLabel="No detections recorded.">
            {detectionPage.slice.map((item) => (
              <ListRow
                key={item.id}
                title={item.label}
                detail={`${item.cameras?.name || 'Camera'} · ${Math.round(Number(item.confidence) * 100)}% · ${new Date(item.created_at).toLocaleString()}`}
              />
            ))}
          </Feed>
          {detectionPage.showPager ? (
            <Pagination
              page={detectionPage.page}
              totalPages={detectionPage.totalPages}
              total={detectionPage.total}
              pageSize={detectionPage.pageSize}
              onPageChange={detectionPage.setPage}
            />
          ) : null}
        </>
      ) : (
        <>
          <Feed empty={!error && alerts.length === 0} emptyLabel="No alerts recorded.">
            {alertPage.slice.map((item) => (
              <ListRow
                key={item.id}
                title={item.message}
                detail={`${item.cameras?.name || 'Camera'} · ${new Date(item.created_at).toLocaleString()}`}
                status={item.severity}
              />
            ))}
          </Feed>
          {alertPage.showPager ? (
            <Pagination
              page={alertPage.page}
              totalPages={alertPage.totalPages}
              total={alertPage.total}
              pageSize={alertPage.pageSize}
              onPageChange={alertPage.setPage}
            />
          ) : null}
        </>
      )}
    </PageFrame>
  );
}

function Feed({
  children,
  empty,
  emptyLabel,
}: {
  children: React.ReactNode;
  empty: boolean;
  emptyLabel: string;
}) {
  if (empty) return <EmptyState>{emptyLabel}</EmptyState>;
  return <div className="space-y-2">{children}</div>;
}
