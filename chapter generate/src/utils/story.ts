import { StoryBlock } from '../types';

export const STORAGE_KEY = 'chuseoz_saved_story_blocks_v2';
export const SERVER_URL = 'https://chuseoz.pythonanywhere.com';

export const BLOGGER_STYLE_SCRIPT = `<div style="display: none;">
  <img src="https://pbs.twimg.com/media/G3yj-joWoAALLuQ?format=jpg&name=large" />
</div>

<style>
.post-labels { margin-top: 40px !important; margin-bottom: 20px !important; display: block !important; clear: both !important; }
.item-view .page_body, .item-view .centered-bottom, .item-view .main-container { padding-top: 180px !important; margin-top: 0 !important; }
.post-timestamp, .post-title-container, .post-header, .post-title, .bg-photo-container, .bg-photo { display: none !important; }
#footer { display: block !important; width: 100% !important; text-align: center !important; margin-top: 40px !important; }
#footer .widget-content, #footer .title, #footer h2, #footer a, .Attribution { color: #ffffff !important; font-size: 14px !important; text-shadow: 1px 1px 2px rgba(0,0,0,0.4) !important; }
.chapter-container { font-family: 'Segoe UI', Arial, sans-serif !important; max-width: 800px; margin: 0 auto; background: #ffffff; padding: 30px; border-radius: 12px; box-shadow: 0 5px 20px rgba(0,0,0,0.15); box-sizing: border-box; }
.chapter-title { font-size: 24px !important; font-weight: bold !important; text-align: center !important; color: #222 !important; margin-bottom: 15px !important; padding-bottom: 15px !important; border-bottom: 2px dashed #ddd; }
.chapter-content { font-family: 'Segoe UI', Arial, sans-serif !important; font-size: 15px !important; line-height: 1.8 !important; color: #333 !important; text-align: justify !important; white-space: pre-line !important; }
.chapter-content p, .chapter-content span, .chapter-content div { font-family: inherit !important; font-size: inherit !important; line-height: inherit !important; color: inherit !important; margin-bottom: 15px !important; }
.chat-container { display: flex; flex-direction: column; gap: 6px; margin: 15px 0; }
.msg { max-width: 70%; padding: 8px 12px; border-radius: 15px; font-size: 14px !important; line-height: 1.3 !important; position: relative; white-space: normal !important; }
.msg.left { align-self: flex-start; background: #f1f0f0 !important; color: #333 !important; border-bottom-left-radius: 4px; }
.msg.right { align-self: flex-end; background: #e2e2e2 !important; color: #333 !important; text-align: left; border-bottom-right-radius: 4px; }
.msg b { display: block; font-size: 10px; margin-bottom: 2px; text-transform: uppercase; color: #d9534f; }
.chapter-page { display: none; }
.chapter-page.active { display: block; animation: fadeIn 0.5s; }
.pagination-container { display: flex; flex-wrap: nowrap; overflow-x: auto; scroll-behavior: smooth; gap: 6px; margin-top: 30px; padding-bottom: 12px; border-top: 1px solid #eee; padding-top: 20px; }
.pagination-container::-webkit-scrollbar { height: 6px; }
.pagination-container::-webkit-scrollbar-track { background: #f1f0f0; border-radius: 4px; }
.pagination-container::-webkit-scrollbar-thumb { background: #ccc; border-radius: 4px; }
.pagination-container::-webkit-scrollbar-thumb:hover { background: #999; }
.page-btn { padding: 6px 14px; background: #f1f0f0; border: 1px solid #ccc; border-radius: 4px; cursor: pointer; font-weight: bold; font-size: 14px; transition: 0.3s; color: #333; flex-shrink: 0; }
.page-btn.active { background: #222; color: #fff; border-color: #222; }
@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
</style>

<script type="text/javascript">
//<![CDATA[
function showPage(p, init=false) {
 document.querySelectorAll('.chapter-page').forEach(x=>x.classList.remove('active'));
 document.querySelectorAll('.page-btn').forEach(x=>x.classList.remove('active'));
 let target = document.getElementById('page-'+p); let btn = document.getElementById('btn-'+p);
 if(target&&btn){ target.classList.add('active'); btn.classList.add('active');
 let con = document.querySelector('.pagination-container');
 if(con){ con.scrollTo({left: btn.offsetLeft-(con.offsetWidth/2)+(btn.offsetWidth/2), behavior:'smooth'}); }}
 if(!init) document.querySelector('.chapter-container').scrollIntoView({behavior:'smooth', block:'start'});
 history.replaceState(null, null, '#page-'+p);
}
window.addEventListener('DOMContentLoaded', ()=>{ let h=window.location.hash; if(h.startsWith('#page-')) showPage(h.replace('#page-',''), true); });
//]]>
<\/script>`;

export function escapeHtml(s: string): string {
  if (!s) return '';
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function parseDialogueLine(line: string): { name: string; message: string } | null {
  const trimmed = line.trim();
  if (!trimmed) return null;
  const sticker = trimmed.match(/^\(Nhãn dán\s*:\s*(.+?)\)\s*$/i);
  if (sticker) return { name: sticker[1].trim(), message: `(Nhãn dán: ${sticker[1].trim()})` };
  const colIdx = trimmed.indexOf(':');
  if (colIdx > 0 && colIdx <= 40) {
    const name = trimmed.slice(0, colIdx).trim();
    if (!/[.,!?。]/.test(name) && name.length >= 1) {
      const msg = trimmed.slice(colIdx + 1).trim();
      if (msg.length > 0) return { name, message: msg };
    }
  }
  return null;
}

export function createNewBlock(prev?: StoryBlock | null): StoryBlock {
  let num = 1;
  if (prev?.title) {
    const m = prev.title.match(/\d+/);
    if (m) num = parseInt(m[0], 10) + 1;
  }
  return {
    id: 'blk_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
    title: `Chương ${num}`,
    leftChars: prev ? prev.leftChars : 'Wine, Nong Lal, PhoomJAI, NoomNim, Cheese',
    rightChars: prev ? prev.rightChars : 'Lullaby, Lal, Thitinan',
    content: '',
  };
}

export function generateLocalHTML(blocks: StoryBlock[]): string {
  const htmlPages: string[] = [];
  const titles: string[] = [];

  blocks.forEach((blk) => {
    const rightNames = blk.rightChars.split(',').map((x) => x.trim().toLowerCase()).filter(Boolean);
    const lines = blk.content.replace(/(\r?\n){3,}/g, '\n\n').split('\n');
    let chunks: string[] = [];
    let chatBuf: Array<{ name: string; message: string; side: string }> = [];

    const flushChat = () => {
      if (chatBuf.length === 0) return;
      let div = `<div class="chat-container">\n`;
      chatBuf.forEach((m) => {
        div += `  <div class="msg ${m.side}"><b>${escapeHtml(m.name)}</b>${escapeHtml(m.message)}</div>\n`;
      });
      div += `</div>`;
      chunks.push(div);
      chatBuf = [];
    };

    lines.forEach((line) => {
      const clean = line.trimEnd();
      if (!clean.trim()) {
        flushChat();
        chunks.push(`<div style="height: 12px;"></div>`);
        return;
      }
      const parsed = parseDialogueLine(clean);
      if (parsed) {
        const lName = parsed.name.toLowerCase();
        const isRight = rightNames.some((r) => lName.includes(r) || r.includes(lName));
        chatBuf.push({ ...parsed, side: isRight ? 'right' : 'left' });
      } else {
        flushChat();
        chunks.push(`<div>${escapeHtml(clean)}</div>`);
      }
    });
    flushChat();

    while (chunks.length && chunks[0] === `<div style="height: 12px;"></div>`) chunks.shift();
    while (chunks.length && chunks[chunks.length - 1] === `<div style="height: 12px;"></div>`) chunks.pop();

    htmlPages.push(chunks.join('\n'));
    titles.push(blk.title || 'Chương...');
  });

  let pagination = `<div class="pagination-container">\n`;
  titles.forEach((_, i) => {
    pagination += `    <button class="page-btn${i === 0 ? ' active' : ''}" id="btn-${i + 1}" onclick="showPage(${i + 1})">${i + 1}</button>\n`;
  });
  pagination += `</div>`;

  let total = `<div class="chapter-container">\n`;
  htmlPages.forEach((content, i) => {
    total += `    <div class="chapter-page${i === 0 ? ' active' : ''}" id="page-${i + 1}">\n`;
    total += `        <h2 class="chapter-title">${escapeHtml(titles[i])}</h2>\n`;
    total += `        <div class="chapter-content">\n${content}\n        </div>\n`;
    total += `    </div>\n\n`;
  });
  total += `${pagination}\n</div>`;

  return total;
}

export function loadFromStorage(): StoryBlock[] | null {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (_) {}
  return null;
}

export function saveToStorage(blocks: StoryBlock[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(blocks));
}

export function clearStorage(): void {
  localStorage.removeItem(STORAGE_KEY);
}
