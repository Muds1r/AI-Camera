'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { PageFrame } from '@/components/page-frame';
import { Stat } from '@/components/widgets';
import { apiJson } from '@/lib/api';

export default function AdminHome() {
  const [admin, setAdmin] = useState<{
    totalHr: number;
    activeHr: number;
    inactiveHr: number;
  } | null>(null);

  useEffect(() => {
    apiJson<{ admin?: { totalHr: number; activeHr: number; inactiveHr: number } }>(
      '/api/dashboard',
    ).then((data) => setAdmin(data.admin ?? null));
  }, []);

  return (
    <PageFrame
      title="Administration"
      description="HR accounts and the record of important actions."
    >
      {admin ? (
        <div className="grid gap-4 sm:grid-cols-3">
          <Stat label="HR accounts" value={admin.totalHr} />
          <Stat label="Active" value={admin.activeHr} />
          <Stat label="Inactive" value={admin.inactiveHr} />
        </div>
      ) : (
        <p className="text-mute">Loading…</p>
      )}
      <div className="mt-6 flex gap-4 text-sm font-bold">
        <Link className="text-teal" href="/admin/hr">
          HR accounts
        </Link>
        <Link className="text-teal" href="/admin/logs">
          Activity log
        </Link>
      </div>
    </PageFrame>
  );
}
