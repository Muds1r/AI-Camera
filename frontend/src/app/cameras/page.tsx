'use client';

import { useEffect, useState } from 'react';
import { PageFrame } from '@/components/page-frame';
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
    <PageFrame
      title="Live cameras"
      description="Only DataView and Super Admin accounts can open this section."
    >
      {error ? <p className="text-danger text-sm font-bold">{error}</p> : null}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {cameras.map((camera) => (
          <article
            key={camera.id}
            className="border-line bg-paper overflow-hidden rounded-xl border shadow-sm"
          >
            <div className="bg-accent flex aspect-video items-center justify-center text-sm font-bold text-white">
              {camera.stream_url ? 'Live feed' : camera.status}
            </div>
            <div className="p-4">
              <h2 className="font-extrabold">{camera.name}</h2>
              <p className="text-mute text-sm">{camera.location || 'No location'}</p>
            </div>
          </article>
        ))}
      </div>
      {cameras.length === 0 && !error ? (
        <p className="text-mute text-sm">No cameras are registered yet.</p>
      ) : null}
    </PageFrame>
  );
}
