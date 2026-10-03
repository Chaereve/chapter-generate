import { AlertState } from '../types';

interface Props {
  alert: AlertState | null;
  onClose?: () => void;
}

const configs = {
  success: {
    bg: 'bg-emerald-50',
    border: 'border-emerald-200',
    text: 'text-emerald-800',
    icon: '✅',
    bar: 'bg-emerald-500',
  },
  warn: {
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    text: 'text-amber-800',
    icon: '⚡',
    bar: 'bg-amber-500',
  },
  error: {
    bg: 'bg-red-50',
    border: 'border-red-200',
    text: 'text-red-800',
    icon: '⚠️',
    bar: 'bg-red-500',
  },
  info: {
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    text: 'text-blue-800',
    icon: 'ℹ️',
    bar: 'bg-blue-500',
  },
};

export default function AlertBanner({ alert, onClose }: Props) {
  if (!alert) return null;
  const cfg = configs[alert.type];

  return (
    <div
      role="alert"
      className={`animate-fade-in flex items-start gap-3 p-4 rounded-xl border ${cfg.bg} ${cfg.border} ${cfg.text} mb-5 relative overflow-hidden`}
    >
      <div className={`absolute left-0 top-0 bottom-0 w-1 ${cfg.bar} rounded-l-xl`} />
      <span className="text-lg flex-shrink-0 ml-1">{cfg.icon}</span>
      <p className="text-sm font-semibold leading-relaxed flex-1">{alert.message}</p>
      {onClose && (
        <button
          onClick={onClose}
          aria-label="Đóng thông báo"
          className="flex-shrink-0 -mt-0.5 -mr-1 w-6 h-6 flex items-center justify-center rounded-md opacity-50 hover:opacity-100 hover:bg-black/5 transition-all"
        >
          ✕
        </button>
      )}
    </div>
  );
}
