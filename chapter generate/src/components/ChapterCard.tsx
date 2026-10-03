import { StoryBlock } from '../types';

interface Props {
  block: StoryBlock;
  index: number;
  canDelete: boolean;
  onUpdate: (field: keyof StoryBlock, value: string) => void;
  onDelete: () => void;
}

export default function ChapterCard({ block, index, canDelete, onUpdate, onDelete }: Props) {
  return (
    <div className="animate-fade-slide bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md hover:border-slate-300 transition-all duration-200 overflow-hidden">
      {/* Card Header */}
      <div className="flex items-center justify-between px-5 py-4 bg-gradient-to-r from-slate-50 to-white border-b border-slate-100">
        <div className="flex items-center gap-3">
          {/* Badge */}
          <div className="flex items-center gap-2 bg-gradient-to-br from-indigo-500 to-indigo-600 text-white text-xs font-bold px-3 py-1.5 rounded-lg shadow-sm">
            <span>§</span>
            <span>{index + 1}</span>
          </div>
          <input
            type="text"
            className="input-field font-semibold text-sm w-48 sm:w-64"
            value={block.title}
            placeholder="Tên chương..."
            onChange={(e) => onUpdate('title', e.target.value)}
          />
        </div>
        {canDelete && (
          <button
            onClick={onDelete}
            className="flex items-center gap-1.5 text-xs font-semibold text-red-500 bg-red-50 hover:bg-red-100 border border-red-100 hover:border-red-200 px-3 py-1.5 rounded-lg transition-all duration-150"
          >
            🗑️ Xóa
          </button>
        )}
      </div>

      {/* Card Body */}
      <div className="p-5 space-y-4">
        {/* Character fields */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
              💬 Nhân vật thoại Trái
            </label>
            <input
              type="text"
              className="input-field text-sm"
              value={block.leftChars}
              placeholder="VD: Pin, Pin-kesorn..."
              onChange={(e) => onUpdate('leftChars', e.target.value)}
            />
            <p className="text-[11px] text-slate-400 mt-1.5">Cách nhau bởi dấu phẩy (,)</p>
          </div>
          <div>
            <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
              💬 Nhân vật thoại Phải
            </label>
            <input
              type="text"
              className="input-field text-sm"
              value={block.rightChars}
              placeholder="VD: Suang, Suang-surang..."
              onChange={(e) => onUpdate('rightChars', e.target.value)}
            />
            <p className="text-[11px] text-slate-400 mt-1.5">Cách nhau bởi dấu phẩy (,)</p>
          </div>
        </div>

        {/* Content textarea */}
        <div>
          <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
            📝 Nội dung chương
          </label>
          <textarea
            className="story-textarea"
            rows={7}
            placeholder={`Dán nội dung truyện vào đây...\n\nVD:\nÁnh sáng đỏ rực chợt tỏa ra bao quanh hai người...\nPin: Chị đừng đi đâu nhé!\n(Nhãn dán :Khóc)\nSuang: Ta nhất định sẽ trở lại.`}
            value={block.content}
            onChange={(e) => onUpdate('content', e.target.value)}
          />
          <div className="flex items-center justify-between mt-1.5">
            <p className="text-[11px] text-slate-400">Mỗi dòng 1 lời thoại (<code className="bg-slate-100 px-1 rounded text-indigo-600">Tên: lời thoại</code>) hoặc 1 đoạn văn</p>
            <p className="text-[11px] text-slate-400 font-mono">{block.content.length.toLocaleString()} ký tự</p>
          </div>
        </div>
      </div>
    </div>
  );
}
