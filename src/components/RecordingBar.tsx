import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

interface Props {
  onStop: () => void;
  onPause: () => void;
  isPaused: boolean;
}

export default function RecordingBar({ onStop, onPause, isPaused }: Props) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (isPaused) return;
    const interval = setInterval(() => setElapsed(s => s + 1), 1000);
    return () => clearInterval(interval);
  }, [isPaused]);

  function fmt(s: number) {
    const m = Math.floor(s / 60).toString().padStart(2, '0');
    const sec = (s % 60).toString().padStart(2, '0');
    return `${m}:${sec}`;
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex flex-col items-center gap-5"
    >
      {/* Recording indicator */}
      <div className="flex items-center gap-3 bg-black/40 backdrop-blur border border-white/10 rounded-2xl px-5 py-3">
        <span className={`w-2.5 h-2.5 rounded-full ${isPaused ? 'bg-yellow-400' : 'bg-red-500 animate-pulse'}`} />
        <span className="text-white font-mono text-lg tracking-widest">{fmt(elapsed)}</span>
        <span className="text-slate-400 text-sm">{isPaused ? 'Paused' : 'Recording'}</span>
      </div>

      {/* Controls */}
      <div className="flex gap-3">
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={onPause}
          className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/15 border border-white/10 text-white text-sm rounded-xl transition-colors"
        >
          {isPaused ? (
            <>
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
              </svg>
              Resume
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              Pause
            </>
          )}
        </motion.button>

        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={onStop}
          className="flex items-center gap-2 px-4 py-2 bg-red-600/80 hover:bg-red-500 border border-red-500/50 text-white text-sm rounded-xl transition-colors"
        >
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8 7a1 1 0 00-1 1v4a1 1 0 001 1h4a1 1 0 001-1V8a1 1 0 00-1-1H8z" clipRule="evenodd" />
          </svg>
          Stop
        </motion.button>
      </div>

      <p className="text-xs text-slate-500">Move cursor over the preview to track position</p>
    </motion.div>
  );
}
