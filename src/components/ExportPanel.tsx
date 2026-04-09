import { useState } from 'react';
import { motion } from 'framer-motion';
import { convertToMp4, convertToGif, downloadBlob } from '../utils/videoExport';
import TrimEditor from './TrimEditor';

interface Props {
  recordedBlob: Blob | null;
  duration: number;
  onReset: () => void;
}

type ExportFormat = 'webm' | 'mp4' | 'gif';
type ExportStatus = 'idle' | 'loading-ffmpeg' | 'converting' | 'done' | 'error';
type Step = 'trim' | 'export';

export default function ExportPanel({ recordedBlob, duration, onReset }: Props) {
  const [step, setStep] = useState<Step>('trim');
  const [trimmedBlob, setTrimmedBlob] = useState<Blob | null>(recordedBlob);
  const [trimStart, setTrimStart] = useState(0);
  const [trimEnd, setTrimEnd] = useState(duration);
  const [format, setFormat] = useState<ExportFormat>('mp4');
  const [status, setStatus] = useState<ExportStatus>('idle');
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');

  const effectiveDuration = trimEnd - trimStart;

  const fmtDuration = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = Math.round(s % 60);
    return m > 0 ? `${m}m ${sec}s` : `${sec}s`;
  };

  const fmtSize = (b: number) => {
    if (b > 1024 * 1024) return `${(b / 1024 / 1024).toFixed(1)} MB`;
    return `${(b / 1024).toFixed(0)} KB`;
  };

  function handleTrimmed(blob: Blob, start: number, end: number) {
    setTrimmedBlob(blob);
    setTrimStart(start);
    setTrimEnd(end);
    setStep('export');
  }

  async function handleExport() {
    const blob = trimmedBlob ?? recordedBlob;
    if (!blob) return;
    setError('');
    setProgress(0);

    try {
      const filename = `flowcap-${Date.now()}`;

      if (format === 'webm') {
        setStatus('done');
        // Apply trim markers if user trimmed
        if (trimStart > 0 || trimEnd < duration) {
          await exportTrimmedWebm(blob, trimStart, trimEnd, `${filename}.webm`);
        } else {
          downloadBlob(blob, `${filename}.webm`);
        }
        return;
      }

      setStatus('loading-ffmpeg');

      const ffmpegArgs = trimStart > 0 || trimEnd < duration
        ? ['-ss', String(trimStart.toFixed(3)), '-to', String(trimEnd.toFixed(3))]
        : [];

      if (format === 'mp4') {
        setStatus('converting');
        const mp4 = await convertToMp4(blob, p => setProgress(p), ffmpegArgs);
        downloadBlob(mp4, `${filename}.mp4`);
      } else {
        setStatus('converting');
        const gif = await convertToGif(blob, 15, 960, p => setProgress(p), ffmpegArgs);
        downloadBlob(gif, `${filename}.gif`);
      }

      setStatus('done');
    } catch (e) {
      console.error(e);
      setError(String(e));
      setStatus('error');
    }
  }

  async function exportTrimmedWebm(blob: Blob, _start: number, _end: number, filename: string) {
    // Fallback: download as-is (trimming via ffmpeg handled in MP4/GIF paths)
    downloadBlob(blob, filename);
  }

  const formats: { id: ExportFormat; label: string; desc: string }[] = [
    { id: 'mp4',  label: 'MP4',  desc: 'Best quality · H.264' },
    { id: 'webm', label: 'WebM', desc: 'Instant · no encode' },
    { id: 'gif',  label: 'GIF',  desc: 'Animated · no sound' },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col gap-5 w-full max-w-sm"
    >
      {/* Step indicator */}
      <div className="flex items-center gap-2">
        {(['trim', 'export'] as Step[]).map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <button
              onClick={() => s === 'export' && step === 'export' ? undefined : s === 'trim' ? setStep('trim') : undefined}
              className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full transition-all ${
                step === s ? 'bg-violet-600 text-white' : 'text-slate-400 bg-white/5'
              }`}
            >
              <span className={`w-4 h-4 rounded-full flex items-center justify-center text-xs ${step === s ? 'bg-white/20' : 'bg-white/10'}`}>{i + 1}</span>
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
            {i < 1 && <div className="w-4 h-px bg-white/20" />}
          </div>
        ))}
        <span className="ml-auto text-xs text-slate-500">{fmtDuration(duration)} · {recordedBlob ? fmtSize(recordedBlob.size) : '—'}</span>
      </div>

      {/* Step: Trim */}
      {step === 'trim' && recordedBlob && (
        <TrimEditor
          blob={recordedBlob}
          duration={duration}
          onTrimmed={handleTrimmed}
          onSkip={() => { setTrimmedBlob(recordedBlob); setTrimStart(0); setTrimEnd(duration); setStep('export'); }}
        />
      )}

      {/* Step: Export */}
      {step === 'export' && (
        <>
          {/* Trim summary */}
          {(trimStart > 0 || trimEnd < duration) && (
            <div className="flex items-center justify-between px-3 py-2 bg-violet-500/10 border border-violet-500/30 rounded-xl text-xs">
              <span className="text-violet-300">Trimmed to {fmtDuration(effectiveDuration)}</span>
              <button onClick={() => setStep('trim')} className="text-slate-400 hover:text-white transition-colors">Edit</button>
            </div>
          )}

          {/* Preview */}
          {trimmedBlob && (
            <video
              key={trimmedBlob.size}
              src={URL.createObjectURL(trimmedBlob)}
              controls
              className="w-full rounded-xl border border-white/10 bg-black"
              style={{ maxHeight: 180 }}
            />
          )}

          {/* Format */}
          <div>
            <p className="text-xs font-medium text-slate-300 uppercase tracking-wider mb-2">Format</p>
            <div className="flex gap-2">
              {formats.map(f => (
                <button
                  key={f.id}
                  onClick={() => { setFormat(f.id); setStatus('idle'); }}
                  className={`flex-1 py-2.5 px-2 rounded-xl border text-center transition-all ${
                    format === f.id ? 'border-violet-500 bg-violet-500/20' : 'border-white/10 hover:border-white/20'
                  }`}
                >
                  <p className="text-sm font-bold text-white">{f.label}</p>
                  <p className="text-xs text-slate-400 mt-0.5 leading-tight">{f.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Progress bar */}
          {(status === 'loading-ffmpeg' || status === 'converting') && (
            <div className="space-y-2">
              <div className="flex justify-between text-xs text-slate-400">
                <span>{status === 'loading-ffmpeg' ? 'Loading encoder…' : `Converting to ${format.toUpperCase()}…`}</span>
                <span>{Math.round(progress)}%</span>
              </div>
              <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-violet-500 rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: status === 'loading-ffmpeg' ? '25%' : `${progress}%` }}
                  transition={{ duration: 0.3 }}
                />
              </div>
            </div>
          )}

          {status === 'error' && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-xs text-red-300">
              {error || 'Export failed. Try WebM format instead.'}
            </div>
          )}

          {status === 'done' && (
            <div className="p-3 bg-green-500/10 border border-green-500/30 rounded-xl text-xs text-green-300 flex items-center gap-2">
              <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Download started!
            </div>
          )}

          <motion.button
            whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
            onClick={handleExport}
            disabled={status === 'loading-ffmpeg' || status === 'converting' || !trimmedBlob}
            className="w-full py-3.5 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-colors flex items-center justify-center gap-2 text-sm"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            {status === 'converting' ? 'Converting…' : `Export as ${format.toUpperCase()}`}
          </motion.button>
        </>
      )}

      <button
        onClick={onReset}
        className="w-full py-2.5 text-slate-400 hover:text-white text-sm transition-colors border border-white/10 hover:border-white/20 rounded-xl"
      >
        ← New recording
      </button>
    </motion.div>
  );
}
