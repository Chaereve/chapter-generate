import { useState, useRef } from 'react';
import { AlertState } from '../../types';
import { copyTextToClipboard } from '../../utils/clipboard';
import AlertBanner from '../AlertBanner';

interface NameEntry {
  name: string;
  count: number;
}

const IGNORE_WORDS = new Set([
  'Tại', 'Nhưng', 'Trong', 'Khi', 'Sau', 'Theo', 'Một', 'Những',
  'Chúng', 'Thế', 'Tuy', 'Dù', 'Nếu', 'Và', 'Rồi', 'Đây', 'Đó',
  'Này', 'Kia', 'Còn', 'Vì', 'Do', 'Bởi',
]);

function chipStyle(index: number, count: number): string {
  if (index === 0 || count >= 30) return 'bg-indigo-100 border-indigo-300 text-indigo-800 ring-1 ring-indigo-300';
  if (index <= 2 || count >= 15) return 'bg-violet-50 border-violet-200 text-violet-700';
  if (index <= 7 || count >= 5) return 'bg-sky-50 border-sky-200 text-sky-700';
  return 'bg-slate-50 border-slate-200 text-slate-600';
}

export default function ScannerTab() {
  const [text, setText] = useState('');
  const [names, setNames] = useState<NameEntry[]>([]);
  const [alert, setAlert] = useState<AlertState | null>(null);
  const [scanning, setScanning] = useState(false);
  const [dragover, setDragover] = useState(false);
  const [copied, setCopied] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const loadFile = (file: File) => {
    if (!file.name.toLowerCase().endsWith('.txt')) {
      setAlert({ type: 'error', message: '⚠️ Vui lòng chỉ chọn file văn bản định dạng .txt (UTF-8)!' });
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      setAlert({ type: 'error', message: '⚠️ File quá lớn (trên 20MB). Hãy chia nhỏ file truyện trước khi quét!' });
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      setText((e.target?.result as string) ?? '');
      setAlert({ type: 'success', message: `📁 Đã đọc file "${file.name}". Nhấn "PHÂN TÍCH & QUÉT TÊN NHÂN VẬT" bên dưới!` });
    };
    reader.onerror = () => {
      setAlert({ type: 'error', message: '⚠️ Không đọc được file. Hãy lưu file ở dạng UTF-8 rồi thử lại!' });
    };
    reader.readAsText(file, 'UTF-8');
  };

  const scanNames = () => {
    if (!text.trim()) {
      setAlert({ type: 'error', message: '⚠️ Vui lòng dán văn bản truyện hoặc thả file .txt vào trước khi quét!' });
      return;
    }
    setScanning(true);
    setAlert({ type: 'info', message: '⏳ Đang phân tích danh sách nhân vật...' });

    setTimeout(() => {
      const lines = text.split('\n');
      const counts: Record<string, number> = {};

      lines.forEach((line) => {
        const tr = line.trim();
        const colIdx = tr.indexOf(':');
        if (colIdx > 0 && colIdx <= 30) {
          const name = tr.slice(0, colIdx).trim();
          if (/^[A-ZÀ-Ỹa-zà-ỹ\s\-_]+$/.test(name) && name.length > 1) {
            counts[name] = (counts[name] || 0) + 5;
          }
        }
        const words = tr.match(/[A-ZÀ-Ỹ][a-zà-ỹ]+(\s[A-ZÀ-Ỹ][a-zà-ỹ]+)*/g);
        if (words) {
          words.forEach((w) => {
            if (w.length > 2 && !IGNORE_WORDS.has(w)) {
              counts[w] = (counts[w] || 0) + 1;
            }
          });
        }
      });

      const sorted: NameEntry[] = Object.keys(counts)
        .filter((k) => counts[k] >= 2)
        .sort((a, b) => counts[b] - counts[a])
        .slice(0, 40)
        .map((name) => ({ name, count: counts[name] }));

      setNames(sorted);
      setScanning(false);

      if (sorted.length > 0) {
        setAlert({ type: 'success', message: `✅ Quét thành công! Trích xuất được ${sorted.length} tên nhân vật nổi bật.` });
      } else {
        setAlert({ type: 'warn', message: '⚠️ Không tìm thấy từ khóa hoặc tên nhân vật nổi bật nào.' });
      }
    }, 300);
  };

  const copyNameList = async () => {
    const ok = await copyTextToClipboard(names.map((n) => n.name).join(', '));
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } else {
      setAlert({ type: 'error', message: '⚠️ Không copy được — hãy bôi đen thủ công.' });
    }
  };

  const medals = ['🥈', '🥇', '🥉'];
  const podiumHeights = ['h-20', 'h-24', 'h-16'];
  const podiumColors = [
    'bg-slate-100 border-slate-200',
    'bg-gradient-to-b from-yellow-50 to-amber-50 border-amber-300 ring-2 ring-amber-200',
    'bg-orange-50 border-orange-200',
  ];

  return (
    <div className="p-6 sm:p-8">
      {/* Header */}
      <div className="mb-6 pb-5 border-b border-slate-100">
        <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
          🔍 Quét Tên Nhân Vật Tự Động
        </h2>
        <p className="text-sm text-slate-500 mt-1">
          Tải file văn bản (.txt) hoặc dán đoạn thoại để phân tích các nhân vật xuất hiện nhiều nhất
        </p>
      </div>

      {/* Drop zone */}
      <div
        role="button"
        tabIndex={0}
        className={`dropzone flex flex-col items-center justify-center gap-3 py-12 px-6 mb-5 text-center ${dragover ? 'dragover' : ''}`}
        onClick={() => fileRef.current?.click()}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') fileRef.current?.click(); }}
        onDragOver={(e) => { e.preventDefault(); setDragover(true); }}
        onDragLeave={() => setDragover(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragover(false);
          const file = e.dataTransfer.files[0];
          if (file) loadFile(file);
        }}
      >
        <div className="text-5xl select-none">📂</div>
        <div>
          <p className="font-bold text-slate-700 text-base">Thả file văn bản (.txt) vào đây hoặc click để chọn</p>
          <p className="text-sm text-slate-400 mt-1">Hỗ trợ chuẩn mã hóa UTF-8</p>
        </div>
        <div className="flex items-center gap-2 text-xs text-indigo-600 font-semibold bg-indigo-50 border border-indigo-200 px-3 py-1.5 rounded-full">
          <span>📄</span> Chỉ hỗ trợ file .txt
        </div>
        <input
          ref={fileRef}
          type="file"
          accept=".txt,text/plain"
          className="hidden"
          onChange={(e) => {
            if (e.target.files?.[0]) loadFile(e.target.files[0]);
            e.target.value = ''; // cho phép chọn lại cùng 1 file
          }}
        />
      </div>

      {/* Manual text area */}
      <div className="mb-5">
        <div className="flex items-center justify-between mb-2">
          <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider">
            Hoặc dán trực tiếp đoạn văn bản truyện vào đây:
          </label>
          {text && (
            <button
              onClick={() => { setText(''); setNames([]); }}
              className="text-[11px] font-semibold text-slate-400 hover:text-red-500 transition-colors"
            >
              ✕ Xóa văn bản
            </button>
          )}
        </div>
        <textarea
          className="story-textarea"
          rows={6}
          placeholder="Dán nội dung truyện cần quét tên vào đây..."
          value={text}
          spellCheck={false}
          onChange={(e) => setText(e.target.value)}
        />
        {text && (
          <p className="text-xs text-slate-400 font-mono mt-1">
            {text.length.toLocaleString()} ký tự · {text.split('\n').length.toLocaleString()} dòng
          </p>
        )}
      </div>

      {/* Scan button */}
      <button className="btn-primary mb-5" onClick={scanNames} disabled={scanning}>
        {scanning ? (
          <>
            <svg className="animate-spin-slow w-5 h-5" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
            </svg>
            <span>Đang phân tích...</span>
          </>
        ) : (
          <>
            <span>🔍</span>
            <span>PHÂN TÍCH & QUÉT TÊN NHÂN VẬT</span>
          </>
        )}
      </button>

      <AlertBanner alert={alert} onClose={() => setAlert(null)} />

      {/* Results */}
      {names.length > 0 && (
        <div className="animate-fade-slide bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4 gap-2 flex-wrap">
            <h3 className="font-bold text-slate-800 flex items-center gap-2">
              🎯 Danh sách tên nhân vật
            </h3>
            <div className="flex items-center gap-2">
              <button
                onClick={copyNameList}
                className="text-xs font-bold bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-600 px-2.5 py-1 rounded-full transition-colors"
                title="Copy dạng: Tên 1, Tên 2, ... để dán vào ô Nhân vật thoại Trái/Phải"
              >
                {copied ? '✅ Đã copy!' : '📋 Copy danh sách tên'}
              </button>
              <span className="text-xs font-semibold bg-indigo-100 text-indigo-700 px-2.5 py-1 rounded-full">
                {names.length} kết quả
              </span>
            </div>
          </div>

          {/* Podium top 3 */}
          {names.length >= 3 && (
            <div className="grid grid-cols-3 gap-3 mb-5">
              {[names[1], names[0], names[2]].map((entry, i) => (
                <div key={entry.name} className={`flex flex-col items-center justify-end ${podiumHeights[i]} rounded-xl border ${podiumColors[i]} p-2 text-center`}>
                  <div className="text-xl">{medals[i]}</div>
                  <div className="font-bold text-slate-800 text-xs truncate w-full text-center mt-0.5">{entry.name}</div>
                  <div className="text-[10px] font-semibold text-slate-500">{entry.count} lần</div>
                </div>
              ))}
            </div>
          )}

          {/* All chips */}
          <div className="flex flex-wrap gap-2">
            {names.map((entry, idx) => (
              <div
                key={entry.name}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-full border text-sm font-semibold ${chipStyle(idx, entry.count)}`}
              >
                <span>{entry.name}</span>
                <span className="text-[11px] font-bold opacity-70 bg-white/60 px-1.5 py-0.5 rounded-full">
                  {entry.count}
                </span>
              </div>
            ))}
          </div>

          <p className="text-[11px] text-slate-400 mt-4">
            💡 Mẹo: copy danh sách tên rồi dán vào ô <b>Nhân vật thoại Trái/Phải</b> ở tab Tạo Code Truyện để bong bóng chat căn đúng phía.
          </p>
        </div>
      )}
    </div>
  );
}
