import { useState } from 'react';
import { AlertState } from '../../types';
import { escapeHtml } from '../../utils/story';
import AlertBanner from '../AlertBanner';
import OutputCard from '../OutputCard';

export default function LinksTab() {
  const [baseUrl, setBaseUrl] = useState('https://chuseoz.blogspot.com/2026/05/love-bound.html');
  const [chaptersText, setChaptersText] = useState('');
  const [output, setOutput] = useState('');
  const [alert, setAlert] = useState<AlertState | null>(null);
  const [showOutput, setShowOutput] = useState(false);

  const generate = () => {
    if (!chaptersText.trim()) {
      setAlert({ type: 'error', message: '⚠️ Vui lòng nhập danh sách tên chương trước!' });
      return;
    }
    const url = baseUrl.trim();
    if (!url) {
      setAlert({ type: 'error', message: '⚠️ Vui lòng nhập link bài viết gốc!' });
      return;
    }
    if (!/^https?:\/\/.+/i.test(url)) {
      setAlert({ type: 'error', message: '⚠️ Link bài viết chưa đúng — phải bắt đầu bằng http:// hoặc https://' });
      return;
    }
    // Bỏ anchor cũ nếu ngưởi dùng dán link đã có #page-N
    const cleanUrl = url.replace(/#.*$/, '');
    const lines = chaptersText.split('\n').filter((l) => l.trim());
    const html = lines
      .map((l, i) => `<a class="chapter-link" href="${cleanUrl}#page-${i + 1}">${escapeHtml(l.trim())}</a>`)
      .join('\n');
    setOutput(html);
    setShowOutput(true);
    setAlert({ type: 'success', message: `✅ Đã tạo ${lines.length} link mục lục thành công!` });
  };

  const chapterLines = chaptersText.split('\n').filter((l) => l.trim());

  return (
    <div className="p-6 sm:p-8">
      {/* Header */}
      <div className="mb-6 pb-5 border-b border-slate-100">
        <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
          🔗 Tạo Link Mục Lục Blogspot
        </h2>
        <p className="text-sm text-slate-500 mt-1">
          Tạo nhanh danh sách thẻ neo{' '}
          <code className="bg-slate-100 text-indigo-600 px-1.5 py-0.5 rounded font-semibold text-xs">#page-N</code>{' '}
          giúp độc giả nhảy trực tiếp tới từng chương
        </p>
      </div>

      {/* Base URL */}
      <div className="mb-5">
        <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
          🔗 Link bài viết gốc trên Blogspot
        </label>
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-slate-100 border border-slate-200 rounded-l-xl px-3 py-2.5 text-sm text-slate-400 font-mono border-r-0 flex-shrink-0">
            🌐
          </div>
          <input
            type="url"
            className="input-field rounded-l-none flex-1"
            value={baseUrl}
            placeholder="https://yourblog.blogspot.com/.../your-post.html"
            spellCheck={false}
            onChange={(e) => setBaseUrl(e.target.value)}
          />
        </div>
      </div>

      {/* Chapters list */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider">
            📋 Danh sách tên chương (mỗi dòng 1 chương)
          </label>
          {chapterLines.length > 0 && (
            <span className="text-xs font-semibold text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-full border border-indigo-200">
              {chapterLines.length} chương
            </span>
          )}
        </div>
        <textarea
          className="story-textarea"
          rows={8}
          placeholder={'Chương 1: Khởi đầu\nChương 2: Gặp gỡ định mệnh\nChương 3: Sóng gió bắt đầu\n...'}
          value={chaptersText}
          spellCheck={false}
          onChange={(e) => setChaptersText(e.target.value)}
        />
      </div>

      {/* Preview chips */}
      {chapterLines.length > 0 && (
        <div className="bg-slate-50 rounded-xl border border-slate-200 p-4 mb-5">
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-3">Xem trước các chương:</p>
          <div className="flex flex-wrap gap-2">
            {chapterLines.slice(0, 10).map((line, i) => (
              <div key={i} className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-xs">
                <span className="font-bold text-indigo-600">#{i + 1}</span>
                <span className="text-slate-600 truncate max-w-[120px]">{line}</span>
              </div>
            ))}
            {chapterLines.length > 10 && (
              <div className="flex items-center bg-slate-200 rounded-lg px-2.5 py-1 text-xs text-slate-500 font-semibold">
                +{chapterLines.length - 10} chương nữa
              </div>
            )}
          </div>
        </div>
      )}

      {/* Generate button */}
      <button className="btn-primary mb-5" onClick={generate}>
        <span>⚡</span>
        <span>TẠO LINK MỤC LỤC HTML</span>
      </button>

      <AlertBanner alert={alert} onClose={() => setAlert(null)} />

      {/* Output */}
      {showOutput && (
        <div className="animate-fade-slide">
          <OutputCard
            title="📋 Kết quả HTML Mục Lục"
            subtitle="Dán vào widget hoặc bài giới thiệu"
            value={output}
            rows={10}
            copyLabel="Copy Link Mục Lục"
          />
        </div>
      )}
    </div>
  );
}
