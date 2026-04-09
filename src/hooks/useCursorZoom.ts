import { useRef, useCallback } from 'react';
import type { CursorPoint, ZoomConfig } from '../types';

interface ZoomState {
  // Current rendered zoom (interpolated)
  zoom: number;
  // Current canvas pan offset (interpolated)
  panX: number;
  panY: number;
  // Target zoom
  targetZoom: number;
  targetPanX: number;
  targetPanY: number;
  // Cursor dwell tracking
  lastMoveTime: number;
  lastCursorX: number;
  lastCursorY: number;
}

export function useCursorZoom(config: ZoomConfig) {
  const stateRef = useRef<ZoomState>({
    zoom: 1,
    panX: 0,
    panY: 0,
    targetZoom: 1,
    targetPanX: 0,
    targetPanY: 0,
    lastMoveTime: 0,
    lastCursorX: 0.5,
    lastCursorY: 0.5,
  });

  // Called every frame with the current cursor position (normalized 0-1)
  const update = useCallback((cursorX: number, cursorY: number, canvasW: number, canvasH: number, now: number) => {
    const s = stateRef.current;
    const moved = Math.abs(cursorX - s.lastCursorX) > 0.001 || Math.abs(cursorY - s.lastCursorY) > 0.001;

    if (moved) {
      s.lastMoveTime = now;
      s.lastCursorX = cursorX;
      s.lastCursorY = cursorY;
    }

    const dwellTime = now - s.lastMoveTime;

    if (!config.enabled) {
      s.targetZoom = 1;
      s.targetPanX = 0;
      s.targetPanY = 0;
    } else if (dwellTime > config.dwellMs) {
      // Cursor is still — zoom in toward it
      s.targetZoom = config.maxZoom;
      // Pan so that cursor stays visible, centered
      s.targetPanX = (0.5 - cursorX) * canvasW * (config.maxZoom - 1);
      s.targetPanY = (0.5 - cursorY) * canvasH * (config.maxZoom - 1);
    } else {
      // Cursor moved — zoom out
      s.targetZoom = 1;
      s.targetPanX = 0;
      s.targetPanY = 0;
    }

    // Lerp toward targets
    const lerp = config.smoothing;
    s.zoom += (s.targetZoom - s.zoom) * lerp;
    s.panX += (s.targetPanX - s.panX) * lerp;
    s.panY += (s.targetPanY - s.panY) * lerp;

    return { zoom: s.zoom, panX: s.panX, panY: s.panY };
  }, [config]);

  const reset = useCallback(() => {
    stateRef.current = {
      zoom: 1, panX: 0, panY: 0,
      targetZoom: 1, targetPanX: 0, targetPanY: 0,
      lastMoveTime: 0, lastCursorX: 0.5, lastCursorY: 0.5,
    };
  }, []);

  return { update, reset, stateRef };
}

export function interpolateCursor(trail: CursorPoint[], time: number): { x: number; y: number } {
  if (trail.length === 0) return { x: 0.5, y: 0.5 };
  if (trail.length === 1) return { x: trail[0].x, y: trail[0].y };

  // Find surrounding points
  let lo = trail[0], hi = trail[trail.length - 1];
  for (let i = 0; i < trail.length - 1; i++) {
    if (trail[i].timestamp <= time && trail[i + 1].timestamp >= time) {
      lo = trail[i];
      hi = trail[i + 1];
      break;
    }
  }

  if (lo === hi) return { x: lo.x, y: lo.y };
  const t = (time - lo.timestamp) / (hi.timestamp - lo.timestamp);
  return {
    x: lo.x + (hi.x - lo.x) * t,
    y: lo.y + (hi.y - lo.y) * t,
  };
}
