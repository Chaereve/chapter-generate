import { useState, useEffect, useRef } from 'react';
import { StoryBlock, AlertState, ServerStatus } from '../../types';
import {
  SERVER_URL,
  BLOGGER_STYLE_SCRIPT,
  createNewBlock,
  generateLocalHTML,
  loadFromStorage,
  saveToStorage,
  clearStorage,
} from '../../utils/story';
import ChapterCard from '../ChapterCard';
import ServerStatusBar from '../ServerStatusBar';
import AlertBanner from '../AlertBanner';
import OutputCard from '../OutputCard';

export default function StoryTab() {
  const [blocks, setBlocks] = useState<StoryBlock[]>([]);
  const [alert, setAlert] = useState<AlertState | null>(null);
  const [serverStatus, setServerStatus] = useState<ServerStatus>('checking');
  const [generating, setGenerating] = useState(false);
  const [outputStyle, setOutputStyle] = useState('');
  const [outputContent, setOutputContent] = useState('');
  const [showOutput, setShowOutput] = useState(false);
  const outputRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Init
  useEffect(() => {
    const saved = loadFromStorage();
    if (saved) {
      setBlocks(saved);
    } else {
      const init = [createNewBlock()];
      setBlocks(init);
      saveToStorage(init);
    }
    checkServer();
    const interval = setInterval(checkServer, 60000);
    return () => clearInterval(interval);
  }, []);

  const checkServer = async () => {
    setServerStatus('checking');
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);
      await fetch(SERVER_URL + '/', { method: 'GET', signal: controller.signal, mode: 'no-cors' });
      clearTimeout(timeoutId);
      setServerStatus('online');
    } catch {
      setServerStatus('offline');
    }
  };

  const updateBlock = (idx: number, field: keyof StoryBlock, value: string) => {
    setBlocks((prev) => {
      const next = prev.map((b, i) => (i === idx ? { ...b, [field]: value } : b));
      saveToStorage(next);
      return next;
    });
  };

  const addBlock = () => {
    setBlocks((prev) => {
      const last = prev[prev.length - 1] ?? null;
      const next = [...prev, createNewBlock(last)];
      saveToStorage(next);
      return next;
    });
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 60);
  };

  const deleteBlock = (idx: number) => {
    if (blocks.length <= 1) return;
    if (confirm(`Bạn có chắc muốn xóa "${blocks[idx].title}" không?`)) {
      setBlocks((prev) => {
        const next = prev.filter((_, i) => i !== idx);
        saveToStorage(next);
        return next;
      });
    }
  };

  const resetAll = () => {
    if (
      confirm(
        '⚠️ XÁC NHẬN LÀM MỚI\n\nBạn có chắc chắn muốn xóa sạch toàn bộ nội dung các chương đang viết không?'
      )
    ) {
      clearStorage();
      const init = [createNewBlock()];
      setBlocks(init);
      saveToStorage(init);
      setShowOutput(false);
      setAlert({ type: 'success', message: '✨ Đã dọn sạch bộ nhớ thành công! Bạn có thể bắt đầu viết truyện mới.' });
    }
  };

  const generate = async () => {
    if (blocks.every((b) => !b.content.trim())) {
      setAlert({ type: 'error', message: '⚠️ Chưa có văn bản truyện ở chương nào! Vui lòng nhập nội dung trước.' });
      return;
    }
    setGenerating(true);
    setAlert(null);

    let resultHTML = '';
    try {
      const payload = blocks.map((b) => ({
        title: b.title,
        rightChars: b.rightChars,
        leftChars: b.leftChars,
        content: b.content,
      }));
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);
      const res = await fetch(SERVER_URL + '/generate-story', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ blocks: payload }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const data = await res.json();
      resultHTML = data.content;
      setServerStatus('online');
      setAlert({ type: 'success', message: '✅ Tạo code thành công từ máy chủ Python! Cấu trúc HTML đã được chuẩn hóa 100%.' });
    } catch {
      resultHTML = generateLocalHTML(blocks);
      setServerStatus('offline');
      setAlert({ type: 'warn', message: '⚡ Máy chủ Python không phản hồi — Đã tự động chuyển sang Local Engine. Kết quả vẫn chuẩn 100%!' });
    }

    setOutputStyle(BLOGGER_STYLE_SCRIPT);
    setOutputContent(resultHTML);
    setShowOutput(true);
    setGenerating(false);
    setTimeout(() => outputRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
  };

  const totalChars = blocks.reduce((acc, b) => acc + b.content.length, 0);

  return (
    <div className="p-6 sm:p-8">
      {/* Section header */}
      <div className="flex items-start justify-between flex-wrap gap-4 mb-6 pb-5 border-b border-slate-100">
        <div>
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            📖 Tạo Code HTML Truyện Blogspot
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Tự động nhận diện lời thoại{' '}
            <code className="bg-slate-100 text-indigo-600 px-1.5 py-0.5 rounded font-semibold text-xs">
              "Tên: lời thoại"
            </code>{' '}
            &{' '}
            <code className="bg-slate-100 text-indigo-600 px-1.5 py-0.5 rounded font-semibold text-xs">
              "(Nhãn dán :Tên)"
            </code>
          </p>
        </div>
        {/* Stats */}
        <div className="flex items-center gap-3">
          <div className="text-center bg-slate-50 border border-slate-200 rounded-xl px-4 py-2">
            <div className="text-lg font-bold text-indigo-600">{blocks.length}</div>
            <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Chương</div>
          </div>
          <div className="text-center bg-slate-50 border border-slate-200 rounded-xl px-4 py-2">
            <div className="text-lg font-bold text-indigo-600">{totalChars.toLocaleString()}</div>
            <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Ký tự</div>
          </div>
        </div>
      </div>

      {/* Server status */}
      <ServerStatusBar status={serverStatus} />

      {/* Chapter cards */}
      <div className="space-y-5 mb-6">
        {blocks.map((block, idx) => (
          <ChapterCard
            key={block.id}
            block={block}
            index={idx}
            canDelete={blocks.length > 1}
            onUpdate={(field, value) => updateBlock(idx, field, value)}
            onDelete={() => deleteBlock(idx)}
          />
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Toolbar */}
      <div className="flex gap-3 flex-wrap mb-5">
        <button
          onClick={addBlock}
          className="flex-1 min-w-[200px] flex items-center justify-center gap-2 px-5 py-3.5 border-2 border-dashed border-emerald-300 bg-emerald-50 hover:bg-emerald-100 hover:border-emerald-400 text-emerald-700 font-bold text-sm rounded-xl transition-all duration-200 hover:-translate-y-0.5"
        >
          <span className="text-lg">+</span>
          Thêm Phần / Trang Mới
        </button>
        <button
          onClick={resetAll}
          className="flex items-center gap-2 px-5 py-3.5 bg-red-50 hover:bg-red-100 border border-red-200 hover:border-red-300 text-red-600 font-bold text-sm rounded-xl transition-all duration-200 hover:-translate-y-0.5"
        >
          🗑️ Xóa bản lưu / Làm mới
        </button>
      </div>

      {/* Generate button */}
      <button
        className="btn-primary mb-5"
        onClick={generate}
        disabled={generating}
      >
        {generating ? (
          <>
            <svg className="animate-spin-slow w-5 h-5" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
            </svg>
            <span>Đang xử lý tạo code...</span>
          </>
        ) : (
          <>
            <span>⚡</span>
            <span>TẠO CODE HTML TRUYỆN SIÊU TỐC</span>
          </>
        )}
      </button>

      {/* Alert */}
      <AlertBanner alert={alert} />

      {/* Output */}
      {showOutput && (
        <div ref={outputRef} className="animate-fade-slide space-y-5 pt-6 border-t-2 border-dashed border-slate-200">
          <div className="flex items-center gap-3 mb-2">
            <div className="h-px flex-1 bg-gradient-to-r from-transparent via-indigo-200 to-transparent" />
            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Kết quả xuất code</span>
            <div className="h-px flex-1 bg-gradient-to-r from-transparent via-indigo-200 to-transparent" />
          </div>

          <OutputCard
            title="1. Style & Script"
            subtitle="Copy & Dán vào trên cùng bài đăng Blogger ở chế độ HTML"
            value={outputStyle}
            rows={6}
            copyLabel="Copy Style & Script"
          />
          <OutputCard
            title="2. Nội dung Truyện"
            subtitle="Copy & Dán tiếp theo phía dưới phần Style & Script"
            value={outputContent}
            rows={14}
            copyLabel="Copy Nội dung Truyện"
          />
        </div>
      )}
    </div>
  );
}
