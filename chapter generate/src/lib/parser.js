import { escHtml } from "./util.js";

export function parseLine(line) {
  const t = String(line || "").trim();
  if (!t) return null;
  const st = t.match(/^\(Nhãn dán\s*:\s*(.+?)\)\s*$/i);
  if (st) return { name: st[1].trim(), message: "(Nhãn dán: " + st[1].trim() + ")" };
  const c = t.indexOf(":");
  if (c > 0 && c <= 40) {
    const name = t.slice(0, c).trim();
    if (name.length >= 1 && !/[.,!?。]/.test(name)) {
      const msg = t.slice(c + 1).trim();
      if (msg) return { name, message: msg };
    }
  }
  return null;
}
export function sideOf(name, rightChars) {
  const n = String(name).toLowerCase();
  return rightChars.split(",").map(s => s.trim().toLowerCase()).filter(Boolean)
    .some(w => n.includes(w) || w.includes(n)) ? "right" : "left";
}

/* ---- in đậm / in nghiêng: giữ tối thiểu <b>/<i> trong nội dung ---- */
export function stripInlineTags(s) { return String(s || "").replace(/<\/?(?:b|i)>/gi, ""); }
/* parse thoại khi dòng chứa <b>/<i>: tên lấy từ bản sạch tag,
   nhưng lờ i thoại lấy từ dòng gốc (giữ tag định dạng bên trong) */
export function parseSmartLine(line) {
  if (!/<\/?[bi]>/i.test(line)) return parseLine(line);
  const dlg = parseLine(stripInlineTags(line));
  if (!dlg) return null;
  if (dlg.message.indexOf("(Nhãn dán:") === 0) return dlg; // nhãn dán: không có tag
  let i = 0;
  while (i < line.length) {
    const m = line.slice(i).match(/^<\/?[bi]>/i);
    if (m) { i += m[0].length; continue; }
    if (line[i] === ":") {
      const msg = line.slice(i + 1).trim();
      if (msg) return { name: dlg.name, message: msg };
      return dlg;
    }
    i++;
  }
  return dlg;
}
/* escape toàn bộ rồi chỉ khôi phục <b>/<i> — an toàn chèn innerHTML/blog */
export function escInline(s) {
  return escHtml(String(s == null ? "" : s)).replace(/&lt;(\/?)(b|i)&gt;/g, (m, sl, t) => "<" + sl + t + ">");
}
/* tách <b>/<i> thành các đoạn run — dùng cho file Word */

/* ---- soạn thảo giàu định dạng: contenteditable <-> văn bản giữ <b>/<i> ---- */
export const ED_BLOCKS = new Set(["div", "p", "section", "article", "header", "footer", "li", "ul", "ol", "table", "tr", "blockquote", "h1", "h2", "h3", "h4", "h5", "h6", "pre"]);
export function editorToText(root) {
  let out = "";
  const walk = node => {
    node.childNodes.forEach(n => {
      if (n.nodeType === 3) { out += n.nodeValue.replace(/\u00a0/g, " "); return; }
      if (n.nodeType !== 1) return;
      const t = n.tagName.toLowerCase();
      if (t === "br") { out += "\n"; return; }
      if (t === "b" || t === "strong") { out += "<b>"; walk(n); out += "</b>"; return; }
      if (t === "i" || t === "em") { out += "<i>"; walk(n); out += "</i>"; return; }
      if (t === "img") {
        const src = n.getAttribute("src") || "";
        if (/^https?:\/\//i.test(src) || /^data:image\//i.test(src)) out += "\n[[IMG:" + src + "]]\n";
        return;
      }
      if (t === "td" || t === "th") { walk(n); out += " "; return; }
      if (ED_BLOCKS.has(t)) {
        if (out && !out.endsWith("\n")) out += "\n";
        walk(n);
        if (!out.endsWith("\n")) out += "\n";
        return;
      }
      walk(n);
    });
  };
  walk(root);
  return out.replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n");
}
export function textToEditorHtml(v) {
  return escHtml(v).replace(/&lt;(\/?)(b|i)&gt;/g, (m, sl, t) => "<" + sl + t + ">");
}
/* dán HTML từ web/Word → văn bản tối thiểu (giữ đậm/nghiêng/xuống dòng/ảnh web) */
export function pasteHtmlToClean(html) {
  const doc = new DOMParser().parseFromString(html, "text/html");
  doc.querySelectorAll("script,style,meta,link,title").forEach(x => x.remove());
  return editorToText(doc.body).trim();
}
