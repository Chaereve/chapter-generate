import { useState, useEffect, useRef } from 'react';
import { copyTextToClipboard } from '../utils/clipboard';

interface Props {
  title: string;
  subtitle?: string;
  value: string;
  rows?: number;
  copyLabel?: string;
}

type CopyState = 'idle' | 'ok' | 'fail';

export default function OutputCard({ title, subtitle, value, rows = 8, copyLabel = 'Copy' }: Props) {
  const [copyState, setCopyState] = useState<CopyState>('idle');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const areaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const handleCopy = async () => {
    const ok = await copyTextToClipboard(value);
    setCopyState(ok ? 'ok' : 'fail');
    if (!ok) {
      // Không copy được → bôi đen sẵn để ngưởi dùng Ctrl+C thủ công
      areaRef.current?.focus();
      areaRef.current?.select();
    }
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setCopyState('idle'), 2200);
  };

  return (
    <div className="rounded-2xl overflow-hidden border border-slate-700/60 bg-[#0d1424] shadow-2xl">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3.5 bg-[#111827] border-b border-slate-700/60 gap-3">
        <div className="flex items-center gap-3 min-w-0">
          {/* Traffic lights */}
          <div className="flex gap-1.5 flex-shrink-0">
            <div className="w-3 h-3 rounded-full bg-red-500/80" />
            <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
            <div className="w-3 h-3 rounded-full bg-green-500/80" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-200 truncate">{title}</p>
            {subtitle && <p className="text-xs text-slate-500 truncate">{subtitle}</p>}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="hidden sm:inline text-[10px] font-mono text-slate-500">
            {value.length.toLocaleString()} ký tự
          </span>
          <button
            onClick={handleCopy}
            className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-bold transition-all duration-200 ${
              copyState === 'ok'
                ? 'bg-emerald-600 text-white border border-emerald-500'
                : copyState === 'fail'
                  ? 'bg-red-600/80 text-white border border-red-500'
                  : 'bg-slate-700 hover:bg-slate-600 text-slate-200 border border-slate-600'
            }`}
          >
            {copyState === 'ok' ? '✅ Đã copy!' : copyState === 'fail' ? '⌨️ Đã bôi đen — nhấn Ctrl+C' : `📋 ${copyLabel}`}
          </button>
        </div>
      </div>

      {/* Code area */}
      <div className="p-4">
        <textarea ref={areaRef} className="code-area w-full" rows={rows} readOnly value={value} spellCheck={false} />
      </div>
    </div>
  );
}
