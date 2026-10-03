import { useMemo } from 'react';
import { StoryBlock } from '../types';
import { parseDialogueLine, detectSide } from '../utils/story';

interface Props {
  block: StoryBlock;
}

type PreviewItem =
  | { kind: 'chat'; side: 'left' | 'right'; name: string; message: string; isSticker: boolean }
  | { kind: 'text'; text: string }
  | { kind: 'spacer' };

export default function ChatPreview({ block }: Props) {
  const items = useMemo<PreviewItem[]>(() => {
    const out: PreviewItem[] = [];
    const lines = (block.content || '').replace(/(\r?\n){3,}/g, '\n\n').split('\n');
    for (const raw of lines) {
      const line = raw.trimEnd();
      if (!line.trim()) {
        out.push({ kind: 'spacer' });
        continue;
      }
      const dlg = parseDialogueLine(line);
      if (dlg) {
        out.push({
          kind: 'chat',
          side: detectSide(dlg.name, block.rightChars),
          name: dlg.name,
          message: dlg.message,
          isSticker: dlg.isSticker,
        });
      } else {
        out.push({ kind: 'text', text: line });
      }
    }
    return out;
  }, [block.content, block.rightChars]);

  if (items.length === 0) {
    return (
      <div className="text-slate-400 text-xs text-center py-8">
        Chương đang trống — viết vài dòng để xem trước dạng chat.
      </div>
    );
  }

  return (
    <div aria-live="polite">
      <div className="text-center font-bold text-slate-800 text-sm pb-2.5 mb-3 border-b border-dashed border-slate-300">
        {block.title || 'Chương...'}
      </div>
      {items.map((item, i) => {
        if (item.kind === 'spacer') return <div key={i} className="h-2.5" />;
        if (item.kind === 'text') {
          return (
            <div key={i} className="text-[13px] leading-relaxed text-slate-700 my-2 whitespace-pre-line">
              {item.text}
            </div>
          );
        }
        const right = item.side === 'right';
        return (
          <div key={i} className={`flex ${right ? 'justify-end' : 'justify-start'} mb-1.5`}>
            <div
              className={`max-w-[78%] px-3 py-2 text-[13px] leading-snug ${
                right
                  ? 'bg-slate-800 text-slate-100 rounded-2xl rounded-br-sm'
                  : 'bg-slate-100 text-slate-800 rounded-2xl rounded-bl-sm border border-slate-200'
              }`}
            >
              <span
                className={`block text-[9.5px] font-bold uppercase tracking-wide mb-0.5 ${
                  right ? 'text-rose-300' : 'text-red-600'
                }`}
              >
                {item.name}
              </span>
              {item.isSticker ? (
                <em className="opacity-75">{item.message}</em>
              ) : (
                item.message
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
