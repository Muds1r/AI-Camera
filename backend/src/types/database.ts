export type CameraStatus = 'online' | 'offline' | 'error';
export type AlertSeverity = 'info' | 'warning' | 'critical';

export interface Camera {
  id: string;
  name: string;
  location?: string | null;
  stream_url?: string | null;
  status: CameraStatus;
  created_at: string;
  updated_at: string;
}

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Detection {
  id: string;
  camera_id: string;
  label: string;
  confidence: number;
  bounding_box?: BoundingBox | null;
  snapshot_url?: string | null;
  created_at: string;
}

export interface Alert {
  id: string;
  camera_id?: string | null;
  detection_id?: string | null;
  severity: AlertSeverity;
  message: string;
  is_read: boolean;
  created_at: string;
}
