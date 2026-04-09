import { useState, useRef, useEffect, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { AppState, RecordingConfig, CursorPoint } from '../types';
import { DEFAULT_CONFIG } from '../types';
import { useScreenCapture } from '../hooks/useScreenCapture';
import { useCameraCapture } from '../hooks/useCameraCapture';
import { useCanvasRecorder } from '../hooks/useCanvasRecorder';
import { useCursorTracking } from '../hooks/useCursorTracking';
import CanvasPreview from './CanvasPreview';
import type { CanvasPreviewHandle } from './CanvasPreview';
import SetupPanel from './SetupPanel';
import RecordingBar from './RecordingBar';
import ExportPanel from './ExportPanel';
import Countdown from './Countdown';

export default function Studio() {
  const [appState,       setAppState]       = useState<AppState>('idle');
  const [config,         setConfig]         = useState<RecordingConfig>(DEFAULT_CONFIG);
  const [isPaused,       setIsPaused]       = useState(false);
  const [cameraAvailable,setCameraAvailable]= useState(false);
  const [micAvailable,   setMicAvailable]   = useState(false);
  const [screenStream,   setScreenStream]   = useState<MediaStream | null>(null);
  const [cameraStream,   setCameraStream]   = useState<MediaStream | null>(null);
  const [recordedBlob,   setRecordedBlob]   = useState<Blob | null>(null);
  const [duration,       setDuration]       = useState(0);
  const [showCountdown,  setShowCountdown]  = useState(false);
  const [isStarting,     setIsStarting]     = useState(false);
  const [error,          setError]          = useState<string | null>(null);
  const [elapsedSecs,    setElapsedSecs]    = useState(0);
  const [previewThumb,   setPreviewThumb]   = useState<string | null>(null);

  const cursorTrailRef   = useRef<CursorPoint[]>([]);
  const startTimeRef     = useRef(0);
  const canvasRef        = useRef<CanvasPreviewHandle>(null);
  const audioCleanupRef  = useRef<(() => void) | null>(null);
  const timerRef         = useRef<ReturnType<typeof setInterval> | null>(null);

  const { startCapture, stopCapture } = useScreenCapture();
  const { startCamera, startMic, stopCamera } = useCameraCapture();
  const { startRecording, stopRecording }     = useCanvasRecorder();

  // Cursor tracking during recording — pushes normalised coords into the canvas
  // compositor so zoom/spotlight keep working even while the canvas is off-screen.
  const handleCursorTrack = useCallback((nx: number, ny: number) => {
    canvasRef.current?.updateCursor(nx, ny);
  }, []);
  useCursorTracking(appState === 'recording' && !isPaused, screenStream, handleCursorTrack);

  // Detect available devices
  useEffect(() => {
    navigator.mediaDevices.enumerateDevices().then(devices => {
      setCameraAvailable(devices.some(d => d.kind === 'videoinput'));
      setMicAvailable(devices.some(d => d.kind === 'audioinput'));
    }).catch(() => {});
  }, []);

  // Elapsed-time ticker while recording
  useEffect(() => {
    if (appState === 'recording' && !isPaused) {
      timerRef.current = setInterval(() => {
        setElapsedSecs(Math.floor((performance.now() - startTimeRef.current) / 1000));
      }, 500);
    } else {
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [appState, isPaused]);

  // ── Core recording start ──────────────────────────────────────────────────
  const beginRecording = useCallback(async () => {
    setError(null);
    setIsStarting(true);   // show spinner IMMEDIATELY — before any awaits
    try {
      // getDisplayMedia() shows the OS native picker (works in browser + Tauri).
      // While it's open the app shows the "Starting…" overlay so it doesn't look frozen.
      const screen = await startCapture();
      setScreenStream(screen);
      // If the user stops sharing via the OS "stop sharing" bar
      screen.getVideoTracks()[0].addEventListener('ended', () => handleStop());

      // Start camera + mic in parallel so we don't serially block on each one.
      // Both run concurrently; the app doesn't freeze waiting for permission dialogs
      // because we already showed the loading overlay.
      const [camera, micStream] = await Promise.all([
        config.camera.enabled && cameraAvailable
          ? startCamera().catch(e => { console.warn('Camera unavailable:', e); return null; })
          : Promise.resolve(null),
        config.micEnabled && micAvailable
          ? startMic().catch(e => { console.warn('Mic unavailable:', e); return null; })
          : Promise.resolve(null),
      ]);

      if (camera) setCameraStream(camera);
      const audioStreams = micStream ? [micStream] : [];

      // Give video elements time to reach readyState ≥ 2
      await new Promise(r => setTimeout(r, 300));

      const canvas = canvasRef.current?.getCanvas();
      if (!canvas) throw new Error('Canvas not ready');

      audioCleanupRef.current = startRecording(canvas, audioStreams);
      startTimeRef.current    = performance.now();
      setElapsedSecs(0);
      cursorTrailRef.current  = [];

      // Snapshot the canvas (already has one rendered frame) to use as a dim
      // thumbnail during recording. Shows the user what's being captured without
      // needing to show the live canvas (which would cause an infinity-mirror loop).
      try {
        const snap = document.createElement('canvas');
        snap.width  = Math.min(canvas.width,  960);
        snap.height = Math.min(canvas.height, 540);
        const sCtx = snap.getContext('2d');
        if (sCtx) {
          sCtx.drawImage(canvas, 0, 0, snap.width, snap.height);
          setPreviewThumb(snap.toDataURL('image/jpeg', 0.6));
        }
      } catch { /* non-fatal — thumbnail is cosmetic only */ }

      setIsStarting(false);
      setAppState('recording');
      setIsPaused(false);
    } catch (e: unknown) {
      setIsStarting(false);
      // NotAllowedError = user cancelled the OS picker — not an error worth showing
      if (e instanceof DOMException && e.name === 'NotAllowedError') {
        setError(null);
      } else {
        console.error('Recording start failed:', e);
        setError('Could not start recording. Check screen/camera permissions and try again.');
      }
      stopCapture();
      stopCamera();
      setScreenStream(null);
      setCameraStream(null);
      setAppState('idle');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config, cameraAvailable, micAvailable, startCapture, startCamera, startMic, startRecording, stopCapture, stopCamera]);

  // ── Start button ──────────────────────────────────────────────────────────
  const handleStart = useCallback(() => {
    if (config.countdown > 0) {
      setShowCountdown(true);
    } else {
      beginRecording();
    }
  }, [config.countdown, beginRecording]);

  const handleCountdownComplete = useCallback(() => {
    setShowCountdown(false);
    beginRecording();
  }, [beginRecording]);

  // ── Stop ──────────────────────────────────────────────────────────────────
  const handleStop = useCallback(async () => {
    const dur = (performance.now() - startTimeRef.current) / 1000;
    setDuration(dur);

    const blob = await stopRecording();
    setRecordedBlob(blob);

    audioCleanupRef.current?.();
    audioCleanupRef.current = null;

    stopCapture();
    stopCamera();
    setScreenStream(null);
    setCameraStream(null);
    setAppState('preview');
  }, [stopRecording, stopCapture, stopCamera]);

  const handlePause = useCallback(() => setIsPaused(p => !p), []);

  const handleReset = useCallback(() => {
    setRecordedBlob(null);
    setDuration(0);
    setElapsedSecs(0);
    setPreviewThumb(null);
    cursorTrailRef.current = [];
    setError(null);
    setAppState('idle');
  }, []);

  const handleCursorPoint = useCallback((point: CursorPoint) => {
    cursorTrailRef.current.push(point);
    if (cursorTrailRef.current.length > 5000)
      cursorTrailRef.current = cursorTrailRef.current.slice(-5000);
  }, []);

  const fmtTime = (s: number) =>
    `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  const canvasHidden = appState === 'recording';

  return (
    <div className="min-h-screen bg-[#0a0a0f] flex flex-col">

      {/* "Starting…" overlay — shown between clicking Record and recording actually beginning.
           Prevents the app from looking frozen while getDisplayMedia + mic/camera initialise. */}
      {isStarting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-5">
            <div className="relative">
              <div className="w-16 h-16 rounded-full border-2 border-violet-500/30" />
              <div className="absolute inset-0 w-16 h-16 rounded-full border-2 border-violet-500 border-t-transparent animate-spin" />
            </div>
            <div className="text-center">
              <p className="text-white font-semibold text-lg">Starting…</p>
              <p className="text-slate-400 text-sm mt-1">Choose your screen in the picker, then allow mic if asked</p>
            </div>
          </div>
        </div>
      )}

      {/* Countdown overlay */}
      {showCountdown && (
        <Countdown
          from={config.countdown}
          onComplete={handleCountdownComplete}
          onCancel={() => { setShowCountdown(false); }}
        />
      )}

      {/* ── Top nav ── */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-white/5 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-600 to-violet-800 flex items-center justify-center shadow-lg shadow-violet-900/40">
            <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
              <path d="M2 6a2 2 0 012-2h6a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V6zM14.553 7.106A1 1 0 0014 8v4a1 1 0 00.553.894l2 1A1 1 0 0018 13V7a1 1 0 00-1.447-.894l-2 1z" />
            </svg>
          </div>
          <span className="text-white font-semibold text-sm tracking-tight">FlowCap</span>
          <span className="text-xs px-1.5 py-0.5 bg-violet-500/20 text-violet-300 rounded border border-violet-500/30">Beta</span>
        </div>
        {appState === 'recording' && (
          <div className="flex items-center gap-3">
            <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
            <span className="text-red-400 font-mono text-sm font-semibold">{fmtTime(elapsedSecs)}</span>
            <span className="text-xs text-slate-500 font-medium tracking-widest">REC</span>
          </div>
        )}
      </header>

      {/* ── Main layout ── */}
      <main className="flex flex-1 overflow-hidden">

        {/* Canvas / recording area */}
        <div className="flex-1 flex items-center justify-center p-6 bg-[#07070c] relative">

          {/* Canvas always mounted — hidePreview=true moves it off-screen during
              recording to avoid an infinity-mirror loop, but captureStream() still works. */}
          <CanvasPreview
            ref={canvasRef}
            screenStream={screenStream}
            cameraStream={cameraStream}
            config={config}
            isRecording={appState === 'recording' && !isPaused}
            hidePreview={canvasHidden}
            onCursorPoint={handleCursorPoint}
          />

          {/* What the user sees while recording — thumbnail snapshot + overlay */}
          {appState === 'recording' && (
            <div className="w-full max-w-4xl aspect-video rounded-2xl overflow-hidden relative border border-white/10 shadow-2xl">
              {/* Blurred screenshot thumbnail — confirms what's being captured */}
              {previewThumb
                ? <img src={previewThumb} className="absolute inset-0 w-full h-full object-cover scale-105" style={{ filter: 'blur(3px) brightness(0.35)' }} />
                : <div className="absolute inset-0 bg-[#0d0d14]" />
              }

              {/* Semi-transparent overlay content */}
              <div className="relative z-10 w-full h-full flex flex-col items-center justify-center gap-5 px-6">

                {/* Timer */}
                <div className="flex items-center gap-3 bg-black/50 backdrop-blur-sm px-5 py-2.5 rounded-full border border-white/10">
                  <span className="w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse shrink-0" />
                  <span className="text-white font-mono text-2xl font-bold tabular-nums tracking-wider">{fmtTime(elapsedSecs)}</span>
                  <span className="text-xs text-slate-400 font-medium tracking-widest ml-1">REC</span>
                </div>

                {/* What's being recorded label */}
                {previewThumb && (
                  <p className="text-slate-300 text-xs bg-black/40 backdrop-blur-sm px-3 py-1.5 rounded-lg border border-white/10">
                    Showing your screen at start of recording
                  </p>
                )}

                {/* Live-toggle pills */}
                <div className="flex gap-2.5">
                  <LivePill label="Auto Zoom"  active={config.zoom.enabled}      onClick={() => setConfig(c => ({ ...c, zoom:      { ...c.zoom,      enabled: !c.zoom.enabled      } }))} />
                  <LivePill label="Spotlight"  active={config.spotlight.enabled} onClick={() => setConfig(c => ({ ...c, spotlight: { ...c.spotlight, enabled: !c.spotlight.enabled } }))} />
                </div>

                <p className="text-slate-500 text-xs">This window is excluded from the recording</p>
              </div>
            </div>
          )}

          {/* Idle placeholder */}
          {appState === 'idle' && !screenStream && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="text-center">
                <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center">
                  <svg className="w-7 h-7 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                      d="M15 10l4.553-2.069A1 1 0 0121 8.867v6.266a1 1 0 01-1.447.894L15 14M3 8a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z" />
                  </svg>
                </div>
                <p className="text-slate-500 text-sm">Preview appears here</p>
                {error && <p className="text-red-400 text-xs mt-2 max-w-xs leading-relaxed">{error}</p>}
              </div>
            </div>
          )}
        </div>

        {/* ── Right sidebar ── */}
        <aside className="w-[300px] border-l border-white/5 flex flex-col overflow-y-auto">
          <div className="flex-1 flex flex-col items-center justify-center p-5">
            <AnimatePresence mode="wait">

              {appState === 'idle' && (
                <motion.div key="setup" className="w-full"
                  initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                  <SetupPanel
                    config={config}
                    onChange={setConfig}
                    onStart={handleStart}
                    cameraAvailable={cameraAvailable}
                    micAvailable={micAvailable}
                  />
                </motion.div>
              )}

              {appState === 'recording' && (
                <motion.div key="recording" className="w-full flex flex-col gap-4"
                  initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                  <RecordingBar onStop={handleStop} onPause={handlePause} isPaused={isPaused} />
                </motion.div>
              )}

              {appState === 'preview' && (
                <motion.div key="export" className="w-full"
                  initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                  <ExportPanel
                    recordedBlob={recordedBlob}
                    duration={duration}
                    onReset={handleReset}
                  />
                </motion.div>
              )}

            </AnimatePresence>
          </div>
        </aside>
      </main>
    </div>
  );
}

function LivePill({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-full border text-xs font-medium transition-all ${
        active
          ? 'border-violet-500/50 bg-violet-500/20 text-violet-300'
          : 'border-white/10 text-slate-500 hover:border-white/20 hover:text-slate-400'
      }`}
    >
      {active ? '● ' : '○ '}{label}
    </button>
  );
}
