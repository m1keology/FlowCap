import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

interface Source {
  id: string;
  name: string;
  thumbnail: string;
}

interface Props {
  onSelect: (sourceId: string) => void;
  onCancel: () => void;
}

export default function SourcePicker({ onSelect, onCancel }: Props) {
  const [sources, setSources] = useState<Source[]>([]);
  const [loading, setLoading] = useState(true);
  const [hovered, setHovered] = useState<string | null>(null);

  useEffect(() => {
    const api = (window as any).electronAPI;
    if (!api) return;

    api.getDisplaySources().then((srcs: Source[]) => {
      setSources(srcs);
      setLoading(false);
    });
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-[#16161f] border border-white/10 rounded-2xl p-6 w-[640px] max-h-[80vh] flex flex-col gap-4 shadow-2xl"
      >
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-white font-semibold text-lg">Choose what to record</h2>
            <p className="text-slate-400 text-sm mt-0.5">Select a screen or window</p>
          </div>
          <button
            onClick={onCancel}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
          >
            ✕
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-6 h-6 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="overflow-y-auto grid grid-cols-2 gap-3 pr-1">
            {sources.map(source => (
              <button
                key={source.id}
                onClick={() => onSelect(source.id)}
                onMouseEnter={() => setHovered(source.id)}
                onMouseLeave={() => setHovered(null)}
                className={`flex flex-col rounded-xl border overflow-hidden transition-all text-left ${
                  hovered === source.id
                    ? 'border-violet-500 shadow-lg shadow-violet-500/20'
                    : 'border-white/10 hover:border-white/20'
                }`}
              >
                <div className="relative bg-black aspect-video overflow-hidden">
                  <img
                    src={source.thumbnail}
                    alt={source.name}
                    className="w-full h-full object-cover"
                  />
                  {hovered === source.id && (
                    <div className="absolute inset-0 bg-violet-500/20 flex items-center justify-center">
                      <div className="w-10 h-10 bg-violet-600 rounded-full flex items-center justify-center shadow-lg">
                        <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                        </svg>
                      </div>
                    </div>
                  )}
                </div>
                <div className="px-3 py-2 bg-white/5">
                  <p className="text-sm text-white truncate">{source.name}</p>
                </div>
              </button>
            ))}
          </div>
        )}

        <button
          onClick={onCancel}
          className="w-full py-2 text-slate-400 hover:text-white text-sm border border-white/10 hover:border-white/20 rounded-xl transition-colors"
        >
          Cancel
        </button>
      </motion.div>
    </div>
  );
}
