import { parseSmartLine, sideOf, stripInlineTags } from "./parser.js";
import { imageSrcOf } from "./images.js";

/* ============================================================
   XUẤT MARKDOWN / VĂN BẢN THÔ
   Dùng lại đúng bộ parser của trình tạo HTML để kết quả khớp nhau.
   ============================================================ */

/** '<b>x</b>' -> '**x**', '<i>y</i>' -> '*y*' */
export function inlineToMarkdown(s) {
  return String(s || "")
    .replace(/<b>/gi, "**")
    .replace(/<\/b>/gi, "**")
    .replace(/<i>/gi, "*")
    .replace(/<\/i>/gi, "*");
}

const IMG_LINE = /^\[\[IMG:[^\]]+\]\]$/i;

/**
 * @param {{title:string,content:string,rightChars:string,images?:object}[]} blocks
 * @param {object} [opts] {storyTitle, chatAs:'quote'|'bold', embedImages:boolean}
 */
export function blocksToMarkdown(blocks, opts) {
  const o = Object.assign({ storyTitle: "", chatAs: "bold", embedImages: true }, opts || {});
  const out = [];
  if (o.storyTitle) out.push("# " + stripInlineTags(o.storyTitle), "");

  (blocks || []).forEach((b, bi) => {
    out.push("## " + (stripInlineTags(b.title) || "Chương " + (bi + 1)), "");
    String(b.content || "").replace(/(\r?\n){3,}/g, "\n\n").split("\n").forEach((raw) => {
      const line = raw.trimEnd();
      if (!line.trim()) { out.push(""); return; }
      if (IMG_LINE.test(line.trim())) {
        const src = imageSrcOf(b, line.trim());
        if (src && o.embedImages) out.push("![](" + src + ")", "");
        else if (src) out.push("_(ảnh)_", "");
        return;
      }
      const dlg = parseSmartLine(line);
      if (dlg) {
        const side = sideOf(dlg.name, b.rightChars || "");
        const name = stripInlineTags(dlg.name);
        const msg = inlineToMarkdown(dlg.message);
        out.push(o.chatAs === "quote" ? "> **" + name + "** (" + side + "): " + msg : "**" + name + "**: " + msg);
        return;
      }
      out.push(inlineToMarkdown(line));
    });
    // dọn khoảng trắng thừa cuối chương
    while (out.length && out[out.length - 1] === "") out.pop();
    out.push("");
  });
  while (out.length && out[out.length - 1] === "") out.pop();
  return out.join("\n") + "\n";
}

/** Bản văn bản thuần: không định dạng, ảnh thay bằng [Ảnh]. */
export function blocksToPlainText(blocks, opts) {
  const o = Object.assign({ storyTitle: "" }, opts || {});
  const out = [];
  if (o.storyTitle) out.push(stripInlineTags(o.storyTitle), "");
  (blocks || []).forEach((b, bi) => {
    out.push(stripInlineTags(b.title) || "Chương " + (bi + 1));
    out.push("");
    String(b.content || "").split("\n").forEach((raw) => {
      const line = raw.trimEnd();
      if (IMG_LINE.test(line.trim())) { out.push("[Ảnh]"); return; }
      const dlg = parseSmartLine(line);
      out.push(dlg ? stripInlineTags(dlg.name) + ": " + stripInlineTags(dlg.message) : stripInlineTags(line));
    });
    out.push("");
  });
  return out.join("\n").replace(/\n{3,}/g, "\n\n").trim() + "\n";
}

/** Tên file an toàn: bỏ ký tự cấm trên Windows/macOS. */
export function safeFileName(name, fallback) {
  const s = String(name || "").trim().replace(/[\\/:*?"<>|]+/g, "-").replace(/\s+/g, " ").slice(0, 80);
  return s || fallback || "truyen";
}
