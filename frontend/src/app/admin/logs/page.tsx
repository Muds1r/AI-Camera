'use client';

import { useEffect, useState } from 'react';
import { PageFrame } from '@/components/page-frame';
import { EmptyState, ListRow, Notice, Pagination } from '@/components/widgets';
import { apiJson } from '@/lib/api';
import { usePaged } from '@/lib/use-paged';

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
  const page = usePaged(logs, 8);

  useEffect(() => {
    apiJson<{ logs: Log[] }>('/api/audit')
      .then((data) => setLogs(data.logs))
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Could not load'));
  }, []);

  return (
    <PageFrame title="Activity" description="Account, request, and settings changes.">
      <Notice error={error} />
      {logs.length === 0 && !error ? <EmptyState>No activity recorded.</EmptyState> : null}
      <div className="space-y-2">
        {page.slice.map((log) => (
          <ListRow
            key={log.id}
            title={log.action}
            detail={[
              log.actor?.full_name || 'System',
              log.target_type,
              new Date(log.created_at).toLocaleString(),
              log.detail,
            ]
              .filter(Boolean)
              .join(' · ')}
          />
        ))}
      </div>
      {page.showPager ? (
        <Pagination
          page={page.page}
          totalPages={page.totalPages}
          total={page.total}
          pageSize={page.pageSize}
          onPageChange={page.setPage}
        />
      ) : null}
    </PageFrame>
  );
}
