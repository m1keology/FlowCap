import { useRef, useEffect, useCallback, forwardRef, useImperativeHandle } from 'react';
import type { RecordingConfig, CursorPoint } from '../types';
import { createCompositor } from '../utils/canvasCompositor';

interface Props {
  screenStream: MediaStream | null;
  cameraStream: MediaStream | null;
  config: RecordingConfig;
  isRecording: boolean;
  /** When true the canvas is moved off-screen so it keeps rendering (for MediaRecorder)
   *  but is not visible inside the FlowCap window – breaks the infinity-mirror loop. */
  hidePreview?: boolean;
  onCursorPoint?: (point: CursorPoint) => void;
}

export interface CanvasPreviewHandle {
  getCanvas: () => HTMLCanvasElement | null;
  addClickRipple: (x: number, y: number) => void;
  /** Push a normalised cursor position (0-1) into the compositor.
   *  Called from Studio during recording when canvas mouse-events are disabled. */
  updateCursor: (nx: number, ny: number) => void;
}

const CanvasPreview = forwardRef<CanvasPreviewHandle, Props>(({
  screenStream, cameraStream, config, isRecording, hidePreview = false, onCursorPoint,
}, ref) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const screenVideoRef = useRef<HTMLVideoElement | null>(null);
  const cameraVideoRef = useRef<HTMLVideoElement | null>(null);
  const compositorRef = useRef(createCompositor(config));
  const cursorRef = useRef({ x: 0.5, y: 0.5 });
  const rafRef = useRef<number>(0);

  useImperativeHandle(ref, () => ({
    getCanvas: () => canvasRef.current,
    addClickRipple: (x, y) => compositorRef.current.addClickRipple(x, y),
    updateCursor: (nx, ny) => { cursorRef.current = { x: nx, y: ny }; },
  }));

  useEffect(() => {
    compositorRef.current.updateConfig({ ...config });
  }, [config]);

  // Attach screen stream to a DOM video element
  useEffect(() => {
    if (!screenStream) {
      if (screenVideoRef.current) {
        screenVideoRef.current.pause();
        screenVideoRef.current.srcObject = null;
        screenVideoRef.current.remove();
        screenVideoRef.current = null;
      }
      return;
    }
    const video = document.createElement('video');
    video.srcObject = screenStream;
    video.autoplay = true;
    video.muted = true;
    video.playsInline = true;
    // Keep in DOM off-screen so Chromium actually decodes the stream
    video.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:1px;height:1px;';
    document.body.appendChild(video);
    video.play().catch(e => console.warn('Screen video play failed:', e));
    screenVideoRef.current = video;
    return () => {
      video.pause();
      video.srcObject = null;
      video.remove();
    };
  }, [screenStream]);

  // Attach camera stream to a DOM video element
  useEffect(() => {
    if (!cameraStream) {
      if (cameraVideoRef.current) {
        cameraVideoRef.current.pause();
        cameraVideoRef.current.srcObject = null;
        cameraVideoRef.current.remove();
        cameraVideoRef.current = null;
      }
      return;
    }
    const video = document.createElement('video');
    video.srcObject = cameraStream;
    video.autoplay = true;
    video.muted = true;
    video.playsInline = true;
    video.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:1px;height:1px;';
    document.body.appendChild(video);
    video.play().catch(e => console.warn('Camera video play failed:', e));
    cameraVideoRef.current = video;
    return () => {
      video.pause();
      video.srcObject = null;
      video.remove();
    };
  }, [cameraStream]);

  // Render loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const compositor = compositorRef.current;
    const dummy = document.createElement('video');

    function loop() {
      const now = performance.now();
      const sv = screenVideoRef.current;
      compositor.frame(ctx!, sv ?? dummy, cameraVideoRef.current, cursorRef.current.x, cursorRef.current.y, now);
      rafRef.current = requestAnimationFrame(loop);
    }

    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    cursorRef.current = {
      x: (e.clientX - rect.left) / rect.width,
      y: (e.clientY - rect.top) / rect.height,
    };
    if (isRecording && onCursorPoint) {
      onCursorPoint({ x: cursorRef.current.x, y: cursorRef.current.y, timestamp: performance.now() });
    }
  }, [isRecording, onCursorPoint]);

  const handleClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    compositorRef.current.addClickRipple(
      (e.clientX - rect.left) / rect.width,
      (e.clientY - rect.top) / rect.height,
    );
  }, []);

  return (
    <canvas
      ref={canvasRef}
      width={config.outputWidth}
      height={config.outputHeight}
      // When hidePreview is true: move off-screen but keep in DOM so captureStream() keeps working.
      // visibility:hidden + position:fixed prevents it from appearing inside FlowCap's window
      // (breaks infinity-mirror) while Chromium still composites it for the MediaRecorder.
      style={hidePreview ? {
        position: 'fixed',
        top: '-9999px',
        left: '-9999px',
        width: '1px',
        height: '1px',
        visibility: 'hidden',
        pointerEvents: 'none',
      } : undefined}
      className={hidePreview ? '' : 'w-full h-full object-contain rounded-xl canvas-glow'}
      onMouseMove={hidePreview ? undefined : handleMouseMove}
      onClick={hidePreview ? undefined : handleClick}
    />
  );
});

CanvasPreview.displayName = 'CanvasPreview';
export default CanvasPreview;
