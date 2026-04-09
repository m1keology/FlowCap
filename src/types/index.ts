export type AppState = 'idle' | 'countdown' | 'recording' | 'preview';

export interface CursorPoint {
  x: number;
  y: number;
  timestamp: number;
}

export interface BackgroundConfig {
  type: 'gradient' | 'solid' | 'wallpaper';
  gradient: string;
  color: string;
}

export interface ZoomConfig {
  enabled: boolean;
  maxZoom: number;
  dwellMs: number;
  // smoothing kept for compat but spring physics now drive animation
  smoothing: number;
}

export interface SpotlightConfig {
  enabled: boolean;
  radius: number;  // px on output canvas
}

export interface CameraConfig {
  enabled: boolean;
  position: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
  size: 'sm' | 'md' | 'lg';
  shape: 'circle' | 'rounded';
}

export interface RecordingConfig {
  background: BackgroundConfig;
  zoom: ZoomConfig;
  spotlight: SpotlightConfig;
  camera: CameraConfig;
  micEnabled: boolean;
  countdown: number;   // seconds: 0 = no countdown
  padding: number;
  cornerRadius: number;
  outputWidth: number;
  outputHeight: number;
}

export interface RecordingSession {
  screenStream: MediaStream | null;
  cameraStream: MediaStream | null;
  micStream: MediaStream | null;
  cursorTrail: CursorPoint[];
  startTime: number;
  recordedChunks: Blob[];
  recordedBlob: Blob | null;
  duration: number;
}

export const DEFAULT_CONFIG: RecordingConfig = {
  background: {
    type: 'gradient',
    gradient: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 30%, #4c1d95 60%, #1e1b4b 100%)',
    color: '#1a1a2e',
  },
  zoom: {
    enabled: true,
    maxZoom: 1.7,
    smoothing: 0.06,
    dwellMs: 600,
  },
  spotlight: {
    enabled: false,
    radius: 200,
  },
  camera: {
    enabled: false,
    position: 'bottom-right',
    size: 'md',
    shape: 'circle',
  },
  micEnabled: true,
  countdown: 3,
  padding: 48,
  cornerRadius: 12,
  outputWidth: 1920,
  outputHeight: 1080,
};

export const GRADIENTS = [
  { label: 'Midnight', value: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 30%, #4c1d95 60%, #1e1b4b 100%)' },
  { label: 'Aurora',   value: 'linear-gradient(135deg, #065f46 0%, #0f766e 40%, #0e7490 100%)' },
  { label: 'Sunset',   value: 'linear-gradient(135deg, #7c2d12 0%, #9a3412 30%, #b45309 60%, #78350f 100%)' },
  { label: 'Ocean',    value: 'linear-gradient(135deg, #0c4a6e 0%, #075985 40%, #0369a1 100%)' },
  { label: 'Rose',     value: 'linear-gradient(135deg, #4c0519 0%, #881337 40%, #9f1239 100%)' },
  { label: 'Forest',   value: 'linear-gradient(135deg, #14532d 0%, #166534 40%, #15803d 100%)' },
  { label: 'Cosmic',   value: 'linear-gradient(135deg, #0f0f1a 0%, #1a0533 40%, #2d1b69 100%)' },
  { label: 'Charcoal', value: 'linear-gradient(135deg, #111827 0%, #1f2937 40%, #111827 100%)' },
];
