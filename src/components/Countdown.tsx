import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface Props {
  from: number;       // e.g. 3
  onComplete: () => void;
  onCancel?: () => void;
}

export default function Countdown({ from, onComplete, onCancel }: Props) {
  const [count, setCount] = useState(from);

  // Keep a stable ref so the effect never re-fires due to onComplete identity change.
  // This is the fix for the double-fire bug: previously `onComplete` was in the
  // deps array, so any re-render that produced a new function reference caused
  // the effect to re-run when count === 0 and fire onComplete a second time.
  const onCompleteRef = useRef(onComplete);
  useEffect(() => { onCompleteRef.current = onComplete; }, [onComplete]);

  const firedRef = useRef(false);

  useEffect(() => {
    if (count <= 0) {
      if (!firedRef.current) {
        firedRef.current = true;
        onCompleteRef.current();
      }
      return;
    }
    const t = setTimeout(() => setCount(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [count]); // ← onComplete intentionally omitted; we use the ref

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <AnimatePresence mode="wait">
        <motion.div
          key={count}
          initial={{ scale: 1.6, opacity: 0 }}
          animate={{ scale: 1,   opacity: 1 }}
          exit={{    scale: 0.6, opacity: 0 }}
          transition={{ duration: 0.35, ease: [0.34, 1.56, 0.64, 1] }}
          className="flex flex-col items-center gap-4"
        >
          <span
            className="text-[120px] font-black text-white leading-none"
            style={{ textShadow: '0 0 80px rgba(139,92,246,0.8)' }}
          >
            {count}
          </span>
          <span className="text-slate-300 text-lg font-medium tracking-widest uppercase">
            Recording starts…
          </span>

          {/* Animated ring */}
          <svg
            className="absolute"
            width="220"
            height="220"
            style={{ top: '50%', left: '50%', transform: 'translate(-50%,-50%)' }}
          >
            <circle cx="110" cy="110" r="100" fill="none" stroke="rgba(139,92,246,0.3)" strokeWidth="3" />
            <motion.circle
              cx="110" cy="110" r="100"
              fill="none" stroke="rgba(139,92,246,0.9)" strokeWidth="3"
              strokeDasharray={`${2 * Math.PI * 100}`}
              strokeDashoffset={0}
              strokeLinecap="round"
              initial={{ strokeDashoffset: 2 * Math.PI * 100 }}
              animate={{ strokeDashoffset: 0 }}
              transition={{ duration: 1, ease: 'linear' }}
              style={{ transformOrigin: '110px 110px', transform: 'rotate(-90deg)' }}
            />
          </svg>

          {/* Cancel button */}
          {onCancel && (
            <button
              onClick={onCancel}
              className="mt-6 px-4 py-2 rounded-lg border border-white/20 text-slate-400 text-sm hover:border-white/40 hover:text-white transition-all"
            >
              Cancel
            </button>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
