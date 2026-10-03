import { useState } from 'react';

interface Props {
  title: string;
  subtitle?: string;
  value: string;
  rows?: number;
  copyLabel?: string;
}

export default function OutputCard({ title, subtitle, value, rows = 8, copyLabel = 'Copy' }: Props) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(value).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="rounded-2xl overflow-hidden border border-slate-700/60 bg-[#0d1424] shadow-2xl">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3.5 bg-[#111827] border-b border-slate-700/60">
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
        <button
          onClick={handleCopy}
          className={`flex-shrink-0 flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-bold transition-all duration-200 ${
            copied
              ? 'bg-emerald-600 text-white border border-emerald-500'
              : 'bg-slate-700 hover:bg-slate-600 text-slate-200 border border-slate-600'
          }`}
        >
          {copied ? '✅ Đã copy!' : `📋 ${copyLabel}`}
        </button>
      </div>

      {/* Code area */}
      <div className="p-4">
        <textarea
          className="code-area w-full"
          rows={rows}
          readOnly
          value={value}
        />
      </div>
    </div>
  );
}
