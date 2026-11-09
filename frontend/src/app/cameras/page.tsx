'use client';

import { useEffect, useState } from 'react';
import { PageFrame, cardClass } from '@/components/page-frame';
import { Badge, EmptyState, Notice } from '@/components/widgets';
import { apiJson } from '@/lib/api';

interface Camera {
  id: string;
  name: string;
  location: string | null;
  status: 'online' | 'offline' | 'error';
  stream_url: string | null;
}

export default function CamerasPage() {
  const [cameras, setCameras] = useState<Camera[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    apiJson<{ cameras: Camera[] }>('/api/cameras')
      .then((data) => setCameras(data.cameras))
      .catch((err: unknown) =>
        setError(err instanceof Error ? err.message : 'Could not load cameras'),
      );
  }, []);

  return (
    <PageFrame title="Cameras" description="Registered camera feeds and status.">
      <Notice error={error} />
      {cameras.length === 0 && !error ? <EmptyState>No cameras registered yet.</EmptyState> : null}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {cameras.map((camera) => (
          <article key={camera.id} className={`${cardClass} overflow-hidden`}>
            <div className="bg-surface text-mute flex aspect-video items-center justify-center text-xs font-medium">
              {camera.stream_url ? 'Live feed' : 'No stream'}
            </div>
            <div className="flex items-start justify-between gap-2 p-3">
              <div className="min-w-0">
                <h2 className="truncate text-sm font-medium">{camera.name}</h2>
                <p className="text-mute truncate text-xs">{camera.location || 'No location'}</p>
              </div>
              <Badge status={camera.status} />
            </div>
          </article>
        ))}
      </div>
    </PageFrame>
  );
}
