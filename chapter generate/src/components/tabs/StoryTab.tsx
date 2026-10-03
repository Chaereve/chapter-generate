import { useState, useEffect, useRef, useCallback } from 'react';
import { StoryBlock, AlertState, ServerStatus } from '../../types';
import {
  SERVER_URL,
  BLOGGER_STYLE_SCRIPT,
  createNewBlock,
  generateLocalHTML,
  loadFromStorage,
  saveToStorage,
  clearStorage,
  storageIsPersistent,
} from '../../utils/story';
import { downloadDocx } from '../../utils/docx';
import ChapterCard from '../ChapterCard';
import ServerStatusBar from '../ServerStatusBar';
import AlertBanner from '../AlertBanner';
import OutputCard from '../OutputCard';
import ChatPreview from '../ChatPreview';

export default function StoryTab() {
  // Khởi tạo lazy: nạp từ bộ nhớ ngay lần render đầu, tránh ghi đè dữ liệu cũ
  const [blocks, setBlocks] = useState<StoryBlock[]>(() => loadFromStorage() ?? [createNewBlock()]);
  const [alert, setAlert] = useState<AlertState | null>(null);
  const [serverStatus, setServerStatus] = useState<ServerStatus>('checking');
  const [generating, setGenerating] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [outputStyle, setOutputStyle] = useState('');
  const [outputContent, setOutputContent] = useState('');
  const [showOutput, setShowOutput] = useState(false);
  const [focusId, setFocusId] = useState<string>('');
  const [previewOpen, setPreviewOpen] = useState(false);
  const outputRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const quotaWarned = useRef(false);

  /* ---------- Kiểm tra máy chủ: không nhấp nháy trạng thái ---------- */
  const checkServer = useCallback(async (showChecking = false) => {
    if (showChecking) setServerStatus('checking');
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      await fetch(SERVER_URL + '/', { method: 'GET', signal: controller.signal, mode: 'no-cors' });
      clearTimeout(timeoutId);
      setServerStatus((prev) => (prev === 'online' ? prev : 'online'));
    } catch {
      setServerStatus((prev) => (prev === 'offline' ? prev : 'offline'));
    }
  }, []);

  useEffect(() => {
    let alive = true;
    const run = async () => {
      if (!alive) return;
      await checkServer();
    };
    run();
    const interval = setInterval(run, 60000);
    return () => {
      alive = false;
      clearInterval(interval);
    };
  }, [checkServer]);

  /* ---------- Auto-save có debounce — KHÔNG gọi trong setState updater ---------- */
  useEffect(() => {
    const t = setTimeout(() => {
      const ok = saveToStorage(blocks);
      if (!ok && !quotaWarned.current) {
        quotaWarned.current = true;
        setAlert({
          type: 'warn',
          message: storageIsPersistent()
            ? '⚠️ Bộ nhớ trình duyệt đã đầy — nội dung mới có thể không được lưu. Hãy copy mã ra nơi an toàn!'
            : '⚠️ Trình duyệt đang chặn lưu trữ (chế độ riêng tư/iframe) — nội dung chỉ giữ trong phiên này.',
        });
      }
    }, 400);
    return () => clearTimeout(t);
  }, [blocks]);

  /* ---------- Block thao tác ---------- */
  const updateBlock = (idx: number, field: keyof StoryBlock, value: string) => {
    setBlocks((prev) => prev.map((b, i) => (i === idx ? { ...b, [field]: value } : b)));
  };

  const addBlock = () => {
    let newId = '';
    setBlocks((prev) => {
      const last = prev[prev.length - 1] ?? null;
      const nb = createNewBlock(last);
      newId = nb.id;
      return [...prev, nb];
    });
    if (newId) setFocusId(newId);
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 60);
  };

  const deleteBlock = (idx: number) => {
    if (blocks.length <= 1) return;
    if (confirm(`Bạn có chắc muốn xóa "${blocks[idx].title}" không?`)) {
      setBlocks((prev) => prev.filter((_, i) => i !== idx));
    }
  };

  const duplicateBlock = (idx: number) => {
    let newId = '';
    setBlocks((prev) => {
      const src = prev[idx];
      const copy: StoryBlock = {
        ...src,
        id: 'blk_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6),
        title: (src.title || 'Chương') + ' (bản sao)',
      };
      newId = copy.id;
      const next = [...prev];
      next.splice(idx + 1, 0, copy);
      return next;
    });
    if (newId) setFocusId(newId);
  };

  const moveBlock = (idx: number, dir: -1 | 1) => {
    const j = idx + dir;
    if (j < 0 || j >= blocks.length) return;
    setBlocks((prev) => {
      const next = [...prev];
      [next[idx], next[j]] = [next[j], next[idx]];
      return next;
    });
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
      setFocusId(init[0].id);
      setShowOutput(false);
      setAlert({ type: 'success', message: '✨ Đã dọn sạch bộ nhớ thành công! Bạn có thể bắt đầu viết truyện mới.' });
    }
  };

  /* ---------- Tạo code HTML ---------- */
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
      if (typeof data?.content !== 'string') throw new Error('Phản hồi không hợp lệ');
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

  /* ---------- Xuất Word ---------- */
  const exportWord = () => {
    if (blocks.every((b) => !b.content.trim())) {
      setAlert({ type: 'error', message: '⚠️ Chưa có nội dung chương nào để xuất Word!' });
      return;
    }
    setExporting(true);
    setAlert(null);
    // Nhường 1 nhịp cho UI cập nhật trạng thái nút trước khi tạo file đồng bộ
    setTimeout(() => {
      try {
        const fileName = downloadDocx(blocks, blocks[0]?.title || 'Truyện');
        setAlert({ type: 'success', message: `📄 Đã xuất file Word "${fileName}" — mở bằng MS Word/Google Docs để xem.` });
      } catch {
        setAlert({ type: 'error', message: '⚠️ Không tạo được file Word. Vui lòng thử lại!' });
      } finally {
        setExporting(false);
      }
    }, 50);
  };

  const totalChars = blocks.reduce((acc, b) => acc + b.content.length, 0);
  const focusedBlock = blocks.find((b) => b.id === focusId) ?? blocks[0];

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
              "(Nhãn dán: Tên)"
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
      <ServerStatusBar status={serverStatus} onRecheck={() => checkServer(true)} />

      {/* Chapter cards */}
      <div className="space-y-5 mb-6">
        {blocks.map((block, idx) => (
          <ChapterCard
            key={block.id}
            block={block}
            index={idx}
            total={blocks.length}
            canDelete={blocks.length > 1}
            isFocused={focusedBlock?.id === block.id}
            onUpdate={(field, value) => updateBlock(idx, field, value)}
            onDelete={() => deleteBlock(idx)}
            onDuplicate={() => duplicateBlock(idx)}
            onMove={(dir) => moveBlock(idx, dir)}
            onFocus={() => setFocusId(block.id)}
          />
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Toolbar */}
      <div className="flex gap-3 flex-wrap mb-5">
        <button
          onClick={addBlock}
          className="flex-1 min-w-[180px] flex items-center justify-center gap-2 px-5 py-3.5 border-2 border-dashed border-emerald-300 bg-emerald-50 hover:bg-emerald-100 hover:border-emerald-400 text-emerald-700 font-bold text-sm rounded-xl transition-all duration-200 hover:-translate-y-0.5"
        >
          <span className="text-lg">+</span>
          Thêm Phần / Trang Mới
        </button>
        <button
          onClick={() => setPreviewOpen((v) => !v)}
          className={`flex items-center gap-2 px-5 py-3.5 font-bold text-sm rounded-xl border transition-all duration-200 hover:-translate-y-0.5 ${
            previewOpen
              ? 'bg-indigo-600 border-indigo-600 text-white shadow-md'
              : 'bg-indigo-50 hover:bg-indigo-100 border-indigo-200 hover:border-indigo-300 text-indigo-600'
          }`}
        >
          👁 {previewOpen ? 'Ẩn xem trước' : 'Xem trước'}
        </button>
        <button
          onClick={resetAll}
          className="flex items-center gap-2 px-5 py-3.5 bg-red-50 hover:bg-red-100 border border-red-200 hover:border-red-300 text-red-600 font-bold text-sm rounded-xl transition-all duration-200 hover:-translate-y-0.5"
        >
          🗑️ Xóa bản lưu / Làm mới
        </button>
      </div>

      {/* Live preview */}
      {previewOpen && focusedBlock && (
        <div className="animate-fade-slide mb-6 bg-slate-50 border border-slate-200 rounded-2xl p-5 shadow-inner">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">
              Xem trước dạng chat — {focusedBlock.title || 'chương hiện tại'}
            </span>
            <button
              onClick={() => setPreviewOpen(false)}
              className="text-xs font-semibold text-slate-400 hover:text-slate-600 transition-colors"
            >
              ✕ Đóng
            </button>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-4 max-h-[420px] overflow-y-auto shadow-sm">
            <ChatPreview block={focusedBlock} />
          </div>
        </div>
      )}

      {/* Generate button */}
      <button className="btn-primary mb-3" onClick={generate} disabled={generating || exporting}>
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

      {/* Word export */}
      <button
        className="w-full flex items-center justify-center gap-2 px-5 py-3 mb-5 rounded-xl border-2 border-slate-200 bg-white hover:bg-slate-50 hover:border-slate-300 text-slate-700 font-bold text-sm transition-all duration-200 hover:-translate-y-0.5 disabled:opacity-60 disabled:pointer-events-none"
        onClick={exportWord}
        disabled={generating || exporting}
      >
        {exporting ? '⏳ Đang tạo file Word...' : '📄 XUẤT FILE WORD (.DOCX)'}
      </button>

      {/* Alert */}
      <AlertBanner alert={alert} onClose={() => setAlert(null)} />

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
