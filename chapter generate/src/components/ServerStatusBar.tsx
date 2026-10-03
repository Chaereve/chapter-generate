import { ServerStatus } from '../types';

interface Props {
  status: ServerStatus;
}

const statusConfig = {
  checking: {
    dot: 'bg-amber-400 animate-pulse-dot',
    ring: 'ring-amber-400/30',
    text: 'Đang kiểm tra máy chủ...',
    textColor: 'text-amber-600',
    bg: 'bg-amber-50',
    border: 'border-amber-200',
  },
  online: {
    dot: 'bg-emerald-400 animate-pulse-dot',
    ring: 'ring-emerald-400/30',
    text: 'Máy chủ Online — Ưu tiên server',
    textColor: 'text-emerald-700',
    bg: 'bg-emerald-50',
    border: 'border-emerald-200',
  },
  offline: {
    dot: 'bg-red-400',
    ring: 'ring-red-400/30',
    text: 'Máy chủ Offline — Tự động dùng Local Engine',
    textColor: 'text-red-600',
    bg: 'bg-red-50',
    border: 'border-red-200',
  },
};

export default function ServerStatusBar({ status }: Props) {
  const cfg = statusConfig[status];

  return (
    <div className={`flex items-center justify-between flex-wrap gap-3 px-4 py-3 rounded-xl border ${cfg.bg} ${cfg.border} mb-6`}>
      <div className="flex items-center gap-3 flex-wrap">
        {/* Status dot */}
        <div className={`relative flex-shrink-0`}>
          <div className={`w-2.5 h-2.5 rounded-full ${cfg.dot} ring-4 ${cfg.ring}`} />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-semibold text-slate-700">Chế độ tự động:</span>
          <code className="text-xs font-semibold bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-md">
            chuseoz.pythonanywhere.com
          </code>
          <span className={`text-xs font-semibold ${cfg.textColor}`}>{cfg.text}</span>
        </div>
      </div>

      <div className="flex items-center gap-1.5 text-xs font-medium text-slate-500 bg-white border border-slate-200 px-3 py-1 rounded-full shadow-sm">
        <span>⚡</span>
        <span>Ưu tiên Server → Fallback Local</span>
      </div>
    </div>
  );
}
