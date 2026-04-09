import { useEffect, useRef, useCallback } from 'react';

/**
 * Tracks the global cursor position during recording.
 *
 * Strategy:
 * 1. In a Tauri desktop build, Tauri 2 exposes `window.__TAURI_INTERNALS__.invoke`
 *    which we call directly — no npm import, so Vite's static analysis never errors.
 *    `invoke('get_cursor_pos')` returns [x, y] screen pixels from the Rust command.
 *    We normalise against the captured stream's resolution.
 * 2. In the browser (dev mode / no Tauri), we fall back to `window.mousemove`.
 */
export function useCursorTracking(
  active: boolean,
  screenStream: MediaStream | null,
  onCursorMove: (nx: number, ny: number) => void,
) {
  const streamRef   = useRef(screenStream);
  const callbackRef = useRef(onCursorMove);
  streamRef.current   = screenStream;
  callbackRef.current = onCursorMove;

  // Tauri 2 puts its internal bridge on window.__TAURI_INTERNALS__
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const getTauriInvoke = () => (window as any).__TAURI_INTERNALS__?.invoke as
    | ((cmd: string) => Promise<[number, number]>)
    | undefined;

  const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

  // ── Tauri path ───────────────────────────────────────────────────────────
  const tauriIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startTauriPolling = useCallback(() => {
    const tauriInvoke = getTauriInvoke();
    if (!tauriInvoke) return;

    tauriIntervalRef.current = setInterval(async () => {
      try {
        const [px, py] = await tauriInvoke('get_cursor_pos');
        const track = streamRef.current?.getVideoTracks()[0];
        const settings = track?.getSettings() ?? {};
        const sw = settings.width  ?? window.screen.width;
        const sh = settings.height ?? window.screen.height;
        callbackRef.current(
          Math.max(0, Math.min(1, px / sw)),
          Math.max(0, Math.min(1, py / sh)),
        );
      } catch {
        // ignore — window may be briefly hidden during recording setup
      }
    }, 16); // ~60 fps
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stopTauriPolling = useCallback(() => {
    if (tauriIntervalRef.current !== null) {
      clearInterval(tauriIntervalRef.current);
      tauriIntervalRef.current = null;
    }
  }, []);

  // ── Browser fallback: window mousemove ───────────────────────────────────
  const mouseMoveHandler = useCallback((e: MouseEvent) => {
    callbackRef.current(
      e.clientX / window.innerWidth,
      e.clientY / window.innerHeight,
    );
  }, []);

  // ── Lifecycle ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!active) {
      stopTauriPolling();
      window.removeEventListener('mousemove', mouseMoveHandler);
      return;
    }

    if (isTauri) {
      startTauriPolling();
    } else {
      window.addEventListener('mousemove', mouseMoveHandler, { passive: true });
    }

    return () => {
      stopTauriPolling();
      window.removeEventListener('mousemove', mouseMoveHandler);
    };
  }, [active, isTauri, startTauriPolling, stopTauriPolling, mouseMoveHandler]);
}
