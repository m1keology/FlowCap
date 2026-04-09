import { useState } from 'react';
import { motion } from 'framer-motion';
import type { RecordingConfig } from '../types';
import { GRADIENTS } from '../types';

interface Props {
  config: RecordingConfig;
  onChange: (c: RecordingConfig) => void;
  onStart: () => void;
  cameraAvailable: boolean;
  micAvailable: boolean;
}

type Tab = 'background' | 'zoom' | 'camera' | 'effects';

export default function SetupPanel({ config, onChange, onStart, cameraAvailable, micAvailable }: Props) {
  const [tab, setTab] = useState<Tab>('background');

  function update(partial: Partial<RecordingConfig>) {
    onChange({ ...config, ...partial });
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col gap-5 w-full max-w-sm"
    >
      <div>
        <h2 className="text-2xl font-bold text-white tracking-tight">Ready to record</h2>
        <p className="text-slate-400 text-sm mt-1">Configure your recording below</p>
      </div>

      {/* Tabs */}
      <div className="grid grid-cols-4 gap-1 bg-white/5 rounded-lg p-1">
        {(['background', 'zoom', 'effects', 'camera'] as Tab[]).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`py-1.5 text-xs font-medium rounded-md capitalize transition-all ${
              tab === t ? 'bg-violet-600 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex flex-col gap-4">

        {/* ── Background ── */}
        {tab === 'background' && (
          <>
            <Label>Background style</Label>
            <div className="grid grid-cols-4 gap-2">
              {GRADIENTS.map(g => (
                <button
                  key={g.label}
                  title={g.label}
                  onClick={() => update({ background: { ...config.background, type: 'gradient', gradient: g.value } })}
                  className={`aspect-square rounded-lg transition-all ${
                    config.background.gradient === g.value
                      ? 'ring-2 ring-violet-500 scale-105'
                      : 'hover:scale-105 opacity-80 hover:opacity-100'
                  }`}
                  style={{ background: g.value }}
                />
              ))}
            </div>

            <Row label="Padding">
              <input type="range" min={0} max={120} step={8}
                value={config.padding}
                onChange={e => update({ padding: +e.target.value })}
                className="w-full accent-violet-500" />
              <span className="text-xs text-slate-400 w-8 text-right">{config.padding}</span>
            </Row>

            <Row label="Corner radius">
              <input type="range" min={0} max={32} step={2}
                value={config.cornerRadius}
                onChange={e => update({ cornerRadius: +e.target.value })}
                className="w-full accent-violet-500" />
              <span className="text-xs text-slate-400 w-8 text-right">{config.cornerRadius}</span>
            </Row>
          </>
        )}

        {/* ── Zoom ── */}
        {tab === 'zoom' && (
          <>
            <Toggle
              label="Auto zoom"
              description="Spring physics — zooms in when cursor is still"
              value={config.zoom.enabled}
              onChange={v => update({ zoom: { ...config.zoom, enabled: v } })}
            />
            {config.zoom.enabled && (
              <>
                <Row label="Max zoom">
                  <input type="range" min={1.2} max={3.0} step={0.1}
                    value={config.zoom.maxZoom}
                    onChange={e => update({ zoom: { ...config.zoom, maxZoom: +e.target.value } })}
                    className="w-full accent-violet-500" />
                  <span className="text-xs text-slate-400 w-10 text-right">{config.zoom.maxZoom.toFixed(1)}×</span>
                </Row>

                <Row label="Dwell time">
                  <input type="range" min={200} max={2000} step={100}
                    value={config.zoom.dwellMs}
                    onChange={e => update({ zoom: { ...config.zoom, dwellMs: +e.target.value } })}
                    className="w-full accent-violet-500" />
                  <span className="text-xs text-slate-400 w-14 text-right">{config.zoom.dwellMs}ms</span>
                </Row>
              </>
            )}
          </>
        )}

        {/* ── Effects ── */}
        {tab === 'effects' && (
          <>
            {/* Spotlight */}
            <Toggle
              label="Spotlight mode"
              description="Dims screen outside the cursor area"
              value={config.spotlight.enabled}
              onChange={v => update({ spotlight: { ...config.spotlight, enabled: v } })}
            />
            {config.spotlight.enabled && (
              <Row label="Spotlight radius">
                <input type="range" min={80} max={400} step={20}
                  value={config.spotlight.radius}
                  onChange={e => update({ spotlight: { ...config.spotlight, radius: +e.target.value } })}
                  className="w-full accent-violet-500" />
                <span className="text-xs text-slate-400 w-10 text-right">{config.spotlight.radius}px</span>
              </Row>
            )}

            {/* Countdown */}
            <div>
              <Label>Countdown before recording</Label>
              <div className="flex gap-2 mt-2">
                {[0, 3, 5, 10].map(n => (
                  <button
                    key={n}
                    onClick={() => update({ countdown: n })}
                    className={`flex-1 py-2 text-sm rounded-lg border font-medium transition-all ${
                      config.countdown === n
                        ? 'border-violet-500 bg-violet-500/20 text-violet-300'
                        : 'border-white/10 text-slate-400 hover:border-white/20'
                    }`}
                  >
                    {n === 0 ? 'Off' : `${n}s`}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}

        {/* ── Camera ── */}
        {tab === 'camera' && (
          <>
            <Toggle
              label="Webcam overlay"
              description={cameraAvailable ? 'Show camera in recording' : 'No camera found'}
              value={config.camera.enabled && cameraAvailable}
              onChange={v => update({ camera: { ...config.camera, enabled: v } })}
              disabled={!cameraAvailable}
            />

            {config.camera.enabled && cameraAvailable && (
              <>
                <div>
                  <Label>Position</Label>
                  <div className="grid grid-cols-2 gap-2 mt-1.5">
                    {(['bottom-right', 'bottom-left', 'top-right', 'top-left'] as const).map(pos => (
                      <button key={pos}
                        onClick={() => update({ camera: { ...config.camera, position: pos } })}
                        className={`py-1.5 px-2 text-xs rounded-lg border transition-all ${
                          config.camera.position === pos
                            ? 'border-violet-500 bg-violet-500/20 text-violet-300'
                            : 'border-white/10 text-slate-400 hover:border-white/20'
                        }`}
                      >
                        {pos.replace('-', ' ')}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <Label>Shape</Label>
                  <div className="flex gap-2 mt-1.5">
                    {(['circle', 'rounded'] as const).map(s => (
                      <button key={s}
                        onClick={() => update({ camera: { ...config.camera, shape: s } })}
                        className={`flex-1 py-1.5 text-xs rounded-lg border capitalize transition-all ${
                          config.camera.shape === s
                            ? 'border-violet-500 bg-violet-500/20 text-violet-300'
                            : 'border-white/10 text-slate-400 hover:border-white/20'
                        }`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <Label>Size</Label>
                  <div className="flex gap-2 mt-1.5">
                    {(['sm', 'md', 'lg'] as const).map(s => (
                      <button key={s}
                        onClick={() => update({ camera: { ...config.camera, size: s } })}
                        className={`flex-1 py-1.5 text-xs rounded-lg border uppercase transition-all ${
                          config.camera.size === s
                            ? 'border-violet-500 bg-violet-500/20 text-violet-300'
                            : 'border-white/10 text-slate-400 hover:border-white/20'
                        }`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}

            <Toggle
              label="Microphone"
              description={micAvailable ? 'Record audio from mic' : 'No mic found'}
              value={config.micEnabled && micAvailable}
              onChange={v => update({ micEnabled: v })}
              disabled={!micAvailable}
            />
          </>
        )}
      </div>

      {/* Start button */}
      <motion.button
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        onClick={onStart}
        className="w-full py-3.5 bg-violet-600 hover:bg-violet-500 text-white font-semibold rounded-xl transition-colors flex items-center justify-center gap-2 text-sm"
      >
        <span className="w-2.5 h-2.5 bg-red-400 rounded-full animate-pulse" />
        {config.countdown > 0 ? `Start (${config.countdown}s countdown)` : 'Start Recording'}
      </motion.button>

      <p className="text-xs text-slate-500 text-center">
        You'll choose which screen or window to capture
      </p>
      <p className="text-xs text-slate-600 text-center mt-1">
        Window hides while recording · Press <kbd className="px-1 py-0.5 rounded bg-white/10 text-slate-400 font-mono text-[10px]">Ctrl+Shift+S</kbd> to stop
      </p>
    </motion.div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <p className="text-xs font-medium text-slate-300 uppercase tracking-wider">{children}</p>;
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label>{label}</Label>
      <div className="flex items-center gap-2">{children}</div>
    </div>
  );
}

function Toggle({ label, description, value, onChange, disabled }: {
  label: string; description?: string; value: boolean; onChange: (v: boolean) => void; disabled?: boolean;
}) {
  return (
    <button
      onClick={() => !disabled && onChange(!value)}
      className={`flex items-center justify-between p-3 rounded-xl border transition-all ${
        disabled ? 'opacity-40 cursor-not-allowed border-white/5'
          : value ? 'border-violet-500/50 bg-violet-500/10'
          : 'border-white/10 hover:border-white/20'
      }`}
    >
      <div className="text-left">
        <p className="text-sm font-medium text-white">{label}</p>
        {description && <p className="text-xs text-slate-400 mt-0.5">{description}</p>}
      </div>
      <div className={`w-10 h-6 rounded-full transition-colors relative shrink-0 ${value && !disabled ? 'bg-violet-600' : 'bg-white/10'}`}>
        <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all ${value && !disabled ? 'left-5' : 'left-1'}`} />
      </div>
    </button>
  );
}
