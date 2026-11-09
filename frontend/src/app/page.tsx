'use client';

import { useState, useEffect } from 'react';

interface Camera {
  id: string;
  name: string;
  location: string | null;
  stream_url: string | null;
  status: 'online' | 'offline' | 'error';
  created_at: string;
}

interface Detection {
  id: string;
  camera_id: string;
  camera_name?: string;
  label: string;
  confidence: number;
  snapshot_url?: string | null;
  created_at: string;
}

interface Alert {
  id: string;
  message: string;
  severity: 'info' | 'warning' | 'critical';
  is_read: boolean;
  created_at: string;
}

const mockCameras: Camera[] = [
  {
    id: 'cam-1',
    name: 'Main Entrance - Front',
    location: 'Gate A',
    stream_url: null,
    status: 'online',
    created_at: new Date().toISOString(),
  },
  {
    id: 'cam-2',
    name: 'Parking Lot - North',
    location: 'Lot 2',
    stream_url: null,
    status: 'online',
    created_at: new Date().toISOString(),
  },
  {
    id: 'cam-3',
    name: 'Warehouse Interior',
    location: 'Building B',
    stream_url: null,
    status: 'offline',
    created_at: new Date().toISOString(),
  },
];

const mockDetections: Detection[] = [
  {
    id: 'det-1',
    camera_id: 'cam-1',
    camera_name: 'Main Entrance - Front',
    label: 'Person Detected',
    confidence: 0.96,
    created_at: '2 mins ago',
  },
  {
    id: 'det-2',
    camera_id: 'cam-2',
    camera_name: 'Parking Lot - North',
    label: 'Vehicle (Sedan)',
    confidence: 0.91,
    created_at: '7 mins ago',
  },
  {
    id: 'det-3',
    camera_id: 'cam-1',
    camera_name: 'Main Entrance - Front',
    label: 'Backpack / Object',
    confidence: 0.84,
    created_at: '14 mins ago',
  },
];

const mockAlerts: Alert[] = [
  {
    id: 'alt-1',
    message: 'After-hours motion detected at Gate A',
    severity: 'critical',
    is_read: false,
    created_at: '10 mins ago',
  },
  {
    id: 'alt-2',
    message: 'Camera 3 disconnected from local stream',
    severity: 'warning',
    is_read: false,
    created_at: '1 hour ago',
  },
];

export default function Dashboard() {
  const [cameras, setCameras] = useState<Camera[]>(mockCameras);
  const [detections, setDetections] = useState<Detection[]>(mockDetections);
  const [alerts, setAlerts] = useState<Alert[]>(mockAlerts);
  const [apiConnected, setApiConnected] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'cameras' | 'detections' | 'alerts'>('cameras');
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [newCameraName, setNewCameraName] = useState<string>('');
  const [newCameraLocation, setNewCameraLocation] = useState<string>('');

  useEffect(() => {
    async function checkHealth() {
      try {
        const res = await fetch('http://localhost:5000/health');
        if (res.ok) {
          setApiConnected(true);
          const camRes = await fetch('http://localhost:5000/api/cameras');
          if (camRes.ok) {
            const data = await camRes.json();
            if (data.cameras && data.cameras.length > 0) {
              setCameras(data.cameras);
            }
          }
          const detRes = await fetch('http://localhost:5000/api/detections');
          if (detRes.ok) {
            const detData = await detRes.json();
            if (detData.detections && detData.detections.length > 0) {
              setDetections(detData.detections);
            }
          }
        }
      } catch {
        setApiConnected(false);
      }
    }
    checkHealth();
  }, []);

  const handleAddCamera = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCameraName) return;

    const newCam: Camera = {
      id: `cam-${Date.now()}`,
      name: newCameraName,
      location: newCameraLocation || 'Unknown',
      stream_url: null,
      status: 'online',
      created_at: new Date().toISOString(),
    };

    setCameras([newCam, ...cameras]);
    setNewCameraName('');
    setNewCameraLocation('');
    setShowAddModal(false);
  };

  const handleMarkAlertRead = (id: string) => {
    setAlerts(alerts.map((a) => (a.id === id ? { ...a, is_read: true } : a)));
  };

  const unreadAlertsCount = alerts.filter((a) => !a.is_read).length;
  const onlineCamerasCount = cameras.filter((c) => c.status === 'online').length;

  return (
    <div className="min-h-screen bg-zinc-950 font-sans text-zinc-100">
      <header className="sticky top-0 z-40 border-b border-zinc-800 bg-zinc-900/60 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-600 font-bold text-white shadow-lg shadow-indigo-500/20">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
                />
              </svg>
            </div>
            <div>
              <h1 className="text-lg leading-tight font-semibold tracking-tight">AI Camera Hub</h1>
              <p className="text-xs text-zinc-400">Final Year Project • Surveillance & Detection</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 rounded-full border border-zinc-700/60 bg-zinc-800/80 px-3 py-1.5 text-xs">
              <span
                className={`h-2 w-2 rounded-full ${apiConnected ? 'animate-pulse bg-emerald-500' : 'bg-amber-500'}`}
              />
              <span className="font-medium text-zinc-300">
                {apiConnected ? 'Backend Connected' : 'Local Demo Mode'}
              </span>
            </div>
            <button
              onClick={() => setShowAddModal(true)}
              className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-3.5 py-1.5 text-sm font-medium text-white shadow-sm transition hover:bg-indigo-500"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 4v16m8-8H4"
                />
              </svg>
              Add Camera
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
            <span className="text-xs font-medium tracking-wider text-zinc-400 uppercase">
              Total Cameras
            </span>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-2xl font-bold">{cameras.length}</span>
              <span className="text-xs font-medium text-emerald-400">
                {onlineCamerasCount} Active
              </span>
            </div>
          </div>
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
            <span className="text-xs font-medium tracking-wider text-zinc-400 uppercase">
              Detections Today
            </span>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-2xl font-bold">{detections.length * 48}</span>
              <span className="text-xs font-medium text-indigo-400">+12% vs yesterday</span>
            </div>
          </div>
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
            <span className="text-xs font-medium tracking-wider text-zinc-400 uppercase">
              Active Alerts
            </span>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-2xl font-bold">{unreadAlertsCount}</span>
              <span className="text-xs font-medium text-rose-400">
                {unreadAlertsCount > 0 ? 'Requires Review' : 'All Clear'}
              </span>
            </div>
          </div>
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
            <span className="text-xs font-medium tracking-wider text-zinc-400 uppercase">
              Model Inference
            </span>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-2xl font-bold">YOLOv8</span>
              <span className="text-xs font-medium text-emerald-400">28 ms latency</span>
            </div>
          </div>
        </div>

        <div className="mb-6 flex gap-6 border-b border-zinc-800">
          <button
            onClick={() => setActiveTab('cameras')}
            className={`border-b-2 pb-3 text-sm font-medium transition ${
              activeTab === 'cameras'
                ? 'border-indigo-500 text-indigo-400'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Live Feeds ({cameras.length})
          </button>
          <button
            onClick={() => setActiveTab('detections')}
            className={`border-b-2 pb-3 text-sm font-medium transition ${
              activeTab === 'detections'
                ? 'border-indigo-500 text-indigo-400'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Detection Stream ({detections.length})
          </button>
          <button
            onClick={() => setActiveTab('alerts')}
            className={`flex items-center gap-2 border-b-2 pb-3 text-sm font-medium transition ${
              activeTab === 'alerts'
                ? 'border-indigo-500 text-indigo-400'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Alerts
            {unreadAlertsCount > 0 && (
              <span className="rounded-full bg-rose-500 px-1.5 py-0.5 text-xs font-semibold text-white">
                {unreadAlertsCount}
              </span>
            )}
          </button>
        </div>

        {activeTab === 'cameras' && (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {cameras.map((cam) => (
              <div
                key={cam.id}
                className="flex flex-col overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900"
              >
                <div className="relative flex aspect-video items-center justify-center border-b border-zinc-800 bg-zinc-950">
                  <div className="absolute top-3 left-3 flex items-center gap-2 rounded-md bg-black/60 px-2.5 py-1 font-mono text-xs backdrop-blur">
                    <span
                      className={`h-2 w-2 rounded-full ${cam.status === 'online' ? 'bg-emerald-500' : 'bg-zinc-500'}`}
                    />
                    {cam.status.toUpperCase()}
                  </div>
                  <div className="absolute top-3 right-3 rounded bg-black/60 px-2 py-0.5 font-mono text-[11px] text-zinc-400 backdrop-blur">
                    1080p • 30fps
                  </div>
                  <div className="flex flex-col items-center gap-2 text-zinc-600">
                    <svg
                      className="h-10 w-10 stroke-1"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
                      />
                    </svg>
                    <span className="text-xs">Stream Feed Preview</span>
                  </div>
                </div>
                <div className="flex flex-1 flex-col justify-between p-4">
                  <div>
                    <h3 className="text-base font-semibold text-zinc-100">{cam.name}</h3>
                    <p className="mt-1 flex items-center gap-1 text-xs text-zinc-400">
                      <svg
                        className="h-3.5 w-3.5"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                        />
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                        />
                      </svg>
                      {cam.location || 'Unassigned'}
                    </p>
                  </div>
                  <div className="mt-4 flex items-center justify-between border-t border-zinc-800/80 pt-3 text-xs">
                    <span className="font-mono text-zinc-500">ID: {cam.id}</span>
                    <button className="font-medium text-indigo-400 hover:text-indigo-300">
                      Configure Feed
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'detections' && (
          <div className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900">
            <div className="flex items-center justify-between border-b border-zinc-800 px-6 py-4">
              <h2 className="text-sm font-semibold">Real-Time Ingestion Feed</h2>
              <span className="text-xs text-zinc-500">Auto-refresh active</span>
            </div>
            <div className="divide-y divide-zinc-800">
              {detections.map((d) => (
                <div
                  key={d.id}
                  className="flex items-center justify-between p-4 px-6 transition hover:bg-zinc-800/40"
                >
                  <div className="flex items-center gap-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-indigo-800/40 bg-indigo-950/60 text-indigo-400">
                      <svg
                        className="h-5 w-5"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                        />
                      </svg>
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-zinc-100">{d.label}</span>
                        <span className="rounded-full border border-emerald-800/60 bg-emerald-950 px-2 py-0.5 font-mono text-xs text-emerald-400">
                          {Math.round(d.confidence * 100)}% match
                        </span>
                      </div>
                      <p className="mt-0.5 text-xs text-zinc-400">{d.camera_name}</p>
                    </div>
                  </div>
                  <span className="font-mono text-xs text-zinc-500">{d.created_at}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'alerts' && (
          <div className="space-y-3">
            {alerts.map((alt) => (
              <div
                key={alt.id}
                className={`flex items-center justify-between rounded-xl border p-4 transition ${
                  alt.is_read
                    ? 'border-zinc-800 bg-zinc-900/60 text-zinc-400'
                    : 'border-zinc-700/80 bg-zinc-900 text-zinc-100 shadow-sm'
                }`}
              >
                <div className="flex items-center gap-3.5">
                  <span
                    className={`h-2.5 w-2.5 rounded-full ${
                      alt.severity === 'critical'
                        ? 'bg-rose-500'
                        : alt.severity === 'warning'
                          ? 'bg-amber-500'
                          : 'bg-blue-500'
                    }`}
                  />
                  <div>
                    <p
                      className={`text-sm ${alt.is_read ? 'text-zinc-500 line-through' : 'font-medium'}`}
                    >
                      {alt.message}
                    </p>
                    <span className="text-xs text-zinc-500">{alt.created_at}</span>
                  </div>
                </div>
                {!alt.is_read && (
                  <button
                    onClick={() => handleMarkAlertRead(alt.id)}
                    className="rounded-md bg-zinc-800 px-3 py-1 text-xs font-medium text-zinc-300 transition hover:bg-zinc-700"
                  >
                    Mark as Read
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </main>

      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-xl border border-zinc-800 bg-zinc-900 p-6 shadow-2xl">
            <h2 className="mb-4 text-lg font-semibold text-zinc-100">Register New Camera</h2>
            <form onSubmit={handleAddCamera} className="space-y-4">
              <div>
                <label className="mb-1 block text-xs font-medium tracking-wider text-zinc-400 uppercase">
                  Camera Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Back Alley Exit"
                  value={newCameraName}
                  onChange={(e) => setNewCameraName(e.target.value)}
                  className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3.5 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:border-indigo-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium tracking-wider text-zinc-400 uppercase">
                  Location
                </label>
                <input
                  type="text"
                  placeholder="e.g. Sector 4 Corridor"
                  value={newCameraLocation}
                  onChange={(e) => setNewCameraLocation(e.target.value)}
                  className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3.5 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:border-indigo-500 focus:outline-none"
                />
              </div>
              <div className="flex justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="rounded-lg px-4 py-2 text-sm text-zinc-400 transition hover:text-zinc-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-indigo-500"
                >
                  Save Camera
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
