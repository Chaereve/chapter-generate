/* eslint-disable no-useless-escape -- chuỗi <\/script> bên trong template literal là
   cố ý: dist/index.html được vite-plugin-singlefile nhúng JS vào trong thẻ script. */
import { escHtml } from "./util.js";
import { escInline, parseSmartLine, sideOf } from "./parser.js";
import { imageSrcOf } from "./images.js";

export function buildPart1() {
  return `<style>
html, body { background: #ffffff !important; color: #333333 !important; }
body { color-scheme: light !important; }
.post-labels { margin-top: 40px !important; margin-bottom: 20px !important; display: block !important; clear: both !important; }
.item-view .page_body, .item-view .centered-bottom, .item-view .main-container { padding-top: 180px !important; margin-top: 0 !important; }
.post-timestamp, .post-title-container, .post-header, .post-title, .bg-photo-container, .bg-photo { display: none !important; }
#footer { display: block !important; width: 100% !important; text-align: center !important; margin-top: 40px !important; }
#footer .widget-content, #footer .title, #footer h2, #footer a, .Attribution { color: #ffffff !important; font-size: 14px !important; text-shadow: 1px 1px 2px rgba(0,0,0,0.4) !important; }
.chapter-container { font-family: 'Segoe UI', Arial, sans-serif !important; max-width: 800px; margin: 0 auto; background: #ffffff; padding: 30px; border-radius: 12px; box-shadow: 0 5px 20px rgba(0,0,0,0.15); box-sizing: border-box; }
.chapter-title { font-size: 24px !important; font-weight: bold !important; text-align: center !important; color: #222 !important; margin-bottom: 15px !important; padding-bottom: 15px !important; border-bottom: 2px dashed #ddd; }
.chapter-content { font-family: 'Segoe UI', Arial, sans-serif !important; font-size: 15px !important; line-height: 1.8 !important; color: #333 !important; text-align: justify !important; white-space: pre-line !important; }
.chapter-content p, .chapter-content span, .chapter-content div { font-family: inherit !important; font-size: inherit !important; line-height: inherit !important; color: inherit !important; margin-bottom: 15px !important; }
.chapter-content div[style*="height: 12px"] { margin: 0 !important; padding: 0 !important; line-height: 0 !important; font-size: 0 !important; height: 12px !important; }
.story-inline-image { display: block !important; max-width: 100%; height: auto; margin: 18px auto !important; border-radius: 8px; }
.chat-container { display: flex; flex-direction: column; gap: 6px; margin: 15px 0; }
.msg { max-width: 78%; padding: 8px 12px; border-radius: 15px; font-size: 15px !important; line-height: 1.3 !important; position: relative; white-space: normal !important; }
.msg.left { align-self: flex-start; background: #f1f0f0 !important; color: #333 !important; border-bottom-left-radius: 4px; }
.msg.right { align-self: flex-end; background: #e2e2e2 !important; color: #333 !important; text-align: left; border-bottom-right-radius: 4px; }
.msg b { display: block; font-size: 10.5px; margin-bottom: 2px; text-transform: uppercase; letter-spacing: .3px; color: #a8302a; }
.msg.right b { color: #8f271f; }
.chapter-page { display: none; }
.chapter-page.active { display: block; animation: fadeIn 0.5s; }
.pagination-container { display: flex; flex-wrap: nowrap; overflow-x: auto; scroll-behavior: smooth; gap: 6px; margin-top: 30px; padding-bottom: 12px; border-top: 1px solid #eee; padding-top: 20px; }
.pagination-container::-webkit-scrollbar { height: 6px; }
.pagination-container::-webkit-scrollbar-track { background: #f1f0f0; border-radius: 4px; }
.pagination-container::-webkit-scrollbar-thumb { background: #ccc; border-radius: 4px; }
.pagination-container::-webkit-scrollbar-thumb:hover { background: #999; }
.page-btn { padding: 6px 14px; background: #f1f0f0; border: 1px solid #ccc; border-radius: 4px; cursor: pointer; font-weight: bold; font-size: 14px; transition: background 0.3s, color 0.3s; }
.page-btn:hover { background: #e0e0e0; }
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
}

export function buildPart2(blocks) {
  const pages = [], titles = [];
  blocks.forEach(block => {
    const parts = [];
    const flush = buf => {
      if (!buf.length) return;
      let html = '<div class="chat-container">';
      buf.forEach(m => { html += '<div class="msg ' + m.side + '"><b>' + escInline(m.name) + "</b>" + escInline(m.message) + "</div>"; });
      parts.push(html + "</div>");
      buf.length = 0;
    };
    const buf = [];
    const lines = String(block.content || "").replace(/(\r?\n){3,}/g, "\n\n").split("\n");
    lines.forEach(raw => {
      const line = raw.trimEnd();
      if (!line.trim()) { flush(buf); parts.push('<div style="height: 12px;"></div>'); return; }
      const isImgToken = line.trim().match(new RegExp("^\\[\\[IMG:[^\\]]+\\]\\]$", "i"));
      if (isImgToken) {
        const imgSrc = imageSrcOf(block, line.trim());
        // token ảnh nhưng src bị loại (javascript:, thiếu dữ liệu…) → bỏ hẳn dòng,
        // đừng để URL độc lọt ra ngoài dưới dạng chữ
        if (imgSrc) { flush(buf); parts.push('<img class="story-inline-image" src="' + escHtml(imgSrc) + '" alt="" loading="lazy" />'); }
        return;
      }
      const dlg = parseSmartLine(line);
      if (dlg) { buf.push({ name: dlg.name, message: dlg.message, side: sideOf(dlg.name, block.rightChars || "") }); return; }
      flush(buf);
      parts.push("<div>" + escInline(line) + "</div>");
    });
    flush(buf);
    const SP = '<div style="height: 12px;"></div>';
    while (parts.length && parts[0] === SP) parts.shift();
    while (parts.length && parts[parts.length - 1] === SP) parts.pop();
    pages.push(parts.join(""));
    titles.push(block.title || "Chương...");
  });
  let nav = '<div class="pagination-container">';
  titles.forEach((t, i) => {
    nav += '<button class="page-btn' + (i === 0 ? " active" : "") + '" id="btn-' + (i + 1) + '" onclick="showPage(' + (i + 1) + ')">' + (i + 1) + "</button>";
  });
  nav += "</div>";
  let out = '<div class="chapter-container">\n';
  pages.forEach((p, i) => {
    out += '    <div class="chapter-page' + (i === 0 ? " active" : "") + '" id="page-' + (i + 1) + '">\n';
    out += '        <h2 class="chapter-title">' + escInline(titles[i]) + "</h2>\n";
    out += '        <div class="chapter-content">' + p + "</div>\n";
    out += "    </div>\n";
  });
  out += nav + "\n</div>";
  return out;
}
