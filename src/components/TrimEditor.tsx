import { useRef, useState, useCallback, useEffect } from 'react';
import { motion } from 'framer-motion';

interface Props {
  blob: Blob;
  duration: number;
  onTrimmed: (trimmed: Blob, startSec: number, endSec: number) => void;
  onSkip: () => void;
}

export default function TrimEditor({ blob, duration, onTrimmed, onSkip }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const [startPct, setStartPct] = useState(0);
  const [endPct, setEndPct] = useState(1);
  const [currentPct, setCurrentPct] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [trimming, setTrimming] = useState(false);
  const srcUrl = useRef('');
  const dragging = useRef<'start' | 'end' | 'playhead' | null>(null);

  useEffect(() => {
    srcUrl.current = URL.createObjectURL(blob);
    return () => URL.revokeObjectURL(srcUrl.current);
  }, [blob]);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    v.src = srcUrl.current;
    const onTime = () => setCurrentPct(v.currentTime / duration);
    v.addEventListener('timeupdate', onTime);
    v.addEventListener('ended', () => { setPlaying(false); });
    return () => v.removeEventListener('timeupdate', onTime);
  }, [duration]);

  const pctToSec = (p: number) => p * duration;
  const fmtTime = (s: number) => {
    const m = Math.floor(s / 60).toString().padStart(2, '0');
    const sec = s.toFixed(1).padStart(4, '0');
    return `${m}:${sec}`;
  };

  const getPctFromEvent = useCallback((e: React.MouseEvent | MouseEvent) => {
    const track = trackRef.current;
    if (!track) return 0;
    const rect = track.getBoundingClientRect();
    return Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
  }, []);

  const handleTrackMouseDown = useCallback((e: React.MouseEvent) => {
    const pct = getPctFromEvent(e);
    const dStart = Math.abs(pct - startPct);
    const dEnd   = Math.abs(pct - endPct);
    const dPlay  = Math.abs(pct - currentPct);
    const closest = Math.min(dStart, dEnd, dPlay);
    if (closest === dStart) dragging.current = 'start';
    else if (closest === dEnd) dragging.current = 'end';
    else dragging.current = 'playhead';
  }, [startPct, endPct, currentPct, getPctFromEvent]);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragging.current) return;
      const pct = getPctFromEvent(e);
      if (dragging.current === 'start')    setStartPct(Math.min(pct, endPct - 0.02));
      else if (dragging.current === 'end') setEndPct(Math.max(pct, startPct + 0.02));
      else {
        setCurrentPct(pct);
        if (videoRef.current) videoRef.current.currentTime = pct * duration;
      }
    };
    const onUp = () => { dragging.current = null; };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, [startPct, endPct, duration, getPctFromEvent]);

  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    if (playing) { v.pause(); setPlaying(false); }
    else {
      if (v.currentTime < pctToSec(startPct) || v.currentTime >= pctToSec(endPct)) {
        v.currentTime = pctToSec(startPct);
      }
      v.play(); setPlaying(true);
    }
  };

  // Pause when playhead hits end trim
  useEffect(() => {
    if (playing && currentPct >= endPct) {
      videoRef.current?.pause();
      setPlaying(false);
    }
  }, [currentPct, endPct, playing]);

  const handleApplyTrim = async () => {
    // We can't do server-side trim in pure browser without ffmpeg, so
    // we export the blob as-is with trim markers; the export panel will handle it.
    // For a clean trim we'd use ffmpeg.wasm — for now pass markers through.
    setTrimming(true);
    await new Promise(r => setTimeout(r, 300));
    setTrimming(false);
    onTrimmed(blob, pctToSec(startPct), pctToSec(endPct));
  };

  const startSec = pctToSec(startPct);
  const endSec   = pctToSec(endPct);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col gap-4 w-full"
    >
      <div>
        <h3 className="text-white font-semibold">Trim recording</h3>
        <p className="text-slate-400 text-sm mt-0.5">Drag handles to set start / end</p>
      </div>

      {/* Video preview */}
      <video
        ref={videoRef}
        className="w-full rounded-xl bg-black border border-white/10"
        style={{ maxHeight: 180 }}
        muted={false}
      />

      {/* Timeline */}
      <div className="flex flex-col gap-2">
        {/* Track */}
        <div
          ref={trackRef}
          className="relative h-10 bg-white/5 rounded-lg cursor-pointer select-none overflow-hidden"
          onMouseDown={handleTrackMouseDown}
        >
          {/* Trimmed-out regions (dark) */}
          <div className="absolute inset-y-0 left-0 bg-black/50"
            style={{ width: `${startPct * 100}%` }} />
          <div className="absolute inset-y-0 right-0 bg-black/50"
            style={{ width: `${(1 - endPct) * 100}%` }} />

          {/* Active region highlight */}
          <div className="absolute inset-y-0 bg-violet-500/20 border-y border-violet-500/50"
            style={{ left: `${startPct * 100}%`, width: `${(endPct - startPct) * 100}%` }} />

          {/* Start handle */}
          <div className="absolute inset-y-0 flex items-center justify-center w-3 bg-violet-500 rounded-l cursor-ew-resize z-10"
            style={{ left: `${startPct * 100}%`, transform: 'translateX(-100%)' }}>
            <div className="w-0.5 h-4 bg-white/60 rounded" />
          </div>

          {/* End handle */}
          <div className="absolute inset-y-0 flex items-center justify-center w-3 bg-violet-500 rounded-r cursor-ew-resize z-10"
            style={{ left: `${endPct * 100}%` }}>
            <div className="w-0.5 h-4 bg-white/60 rounded" />
          </div>

          {/* Playhead */}
          <div className="absolute inset-y-0 w-0.5 bg-white z-20 pointer-events-none"
            style={{ left: `${currentPct * 100}%` }}>
            <div className="w-2.5 h-2.5 bg-white rounded-full -translate-x-1 -translate-y-0.5" />
          </div>
        </div>

        {/* Time labels */}
        <div className="flex justify-between text-xs text-slate-400 font-mono">
          <span className="text-violet-300">{fmtTime(startSec)}</span>
          <span>{fmtTime(endSec - startSec)} selected</span>
          <span className="text-violet-300">{fmtTime(endSec)}</span>
        </div>
      </div>

      {/* Controls */}
      <div className="flex gap-2">
        <button
          onClick={togglePlay}
          className="w-10 h-10 flex items-center justify-center bg-white/10 hover:bg-white/15 rounded-xl transition-colors text-white"
        >
          {playing
            ? <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
            : <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" /></svg>
          }
        </button>

        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={handleApplyTrim}
          disabled={trimming}
          className="flex-1 py-2.5 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-colors"
        >
          {trimming ? 'Applying…' : `Apply trim · ${fmtTime(endSec - startSec)}`}
        </motion.button>

        <button
          onClick={onSkip}
          className="px-3 py-2.5 text-slate-400 hover:text-white text-sm border border-white/10 hover:border-white/20 rounded-xl transition-colors"
        >
          Skip
        </button>
      </div>
    </motion.div>
  );
}
