import { esc } from "./util.js";
import { parseSmartLine, stripInlineTags } from "./parser.js";
import { imageSrcOf } from "./images.js";

export function inlineRunParts(text) {
  const out = [];
  let bold = false, italic = false;
  String(text).split(/(<\/?[bi]>)/i).forEach(part => {
    if (!part) return;
    const tl = part.toLowerCase();
    if (tl === "<b>") { bold = true; return; }
    if (tl === "</b>") { bold = false; return; }
    if (tl === "<i>") { italic = true; return; }
    if (tl === "</i>") { italic = false; return; }
    out.push({ text: part, bold, italic });
  });
  return out;
}
export function wRunsFromInline(text, base) {
  const o = base || {};
  return inlineRunParts(text).map(seg =>
    wRun(seg.text, { bold: (o.bold || seg.bold) || undefined, italic: (o.italic || seg.italic) || undefined, size: o.size, color: o.color })
  ).join("");
}

export function crc32Table() {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; }
  return t;
}
const CRC_T = crc32Table();
export function crc32(bytes) {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < bytes.length; i++) c = CRC_T[(c ^ bytes[i]) & 255] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}
export function zipStore(entries) { // entries: [{name, data:Uint8Array}]
  const enc = new TextEncoder();
  const u32 = (v, n) => { const a = new Uint8Array(n); for (let i = 0; i < n; i++) a[i] = (v >>> (i * 8)) & 255; return a; };
  const join = arrs => { let len = 0; arrs.forEach(a => len += a.length); const out = new Uint8Array(len); let o = 0; arrs.forEach(a => { out.set(a, o); o += a.length; }); return out; };
  const locals = [], centrals = [];
  let offset = 0;
  for (const e of entries) {
    const name = enc.encode(e.name), crc = crc32(e.data), size = e.data.length;
    locals.push(join([u32(0x04034b50,4), u32(20,2), u32(0,2), u32(0,2), u32(0,2), u32(0,2), u32(crc,4), u32(size,4), u32(size,4), u32(name.length,2), u32(0,2), name, e.data]));
    centrals.push(join([u32(0x02014b50,4), u32(20,2), u32(20,2), u32(0,2), u32(0,2), u32(0,2), u32(0,2), u32(crc,4), u32(size,4), u32(size,4), u32(name.length,2), u32(0,2), u32(0,2), u32(0,2), u32(0,2), u32(0,4), u32(offset,4), name]));
    offset += locals[locals.length - 1].length;
  }
  const cdir = join(centrals), cdirLen = cdir.length, cdirOff = offset;
  const end = join([u32(0x06054b50,4), u32(0,2), u32(0,2), u32(entries.length,2), u32(entries.length,2), u32(cdirLen,4), u32(cdirOff,4), u32(0,2)]);
  return join([join(locals), cdir, end]);
}
export function dataUriToBytes(uri) {
  const m = String(uri).match(/^data:([^;,]+)?(;base64)?,(.*)$/s);
  if (!m) return null;
  const mime = m[1] || "application/octet-stream";
  if (!m[2]) return null; // chỉ hỗ trợ base64
  const bin = atob(m[3]);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return { mime, bytes };
}
export function loadImageDims(src) {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => resolve({ w: img.naturalWidth || 600, h: img.naturalHeight || 400 });
    img.onerror = () => resolve(null);
    img.src = src;
  });
}
export function bytesToDataUri(bytes, mime) {
  let bin = "";
  const CH = 32768;
  for (let i = 0; i < bytes.length; i += CH) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + CH));
  return "data:" + mime + ";base64," + btoa(bin);
}
async function convertToPng(src) { // webp/bmp... → png (Word đọc được)
  const img = new Image();
  await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = src; });
  const cv = document.createElement("canvas");
  cv.width = img.naturalWidth; cv.height = img.naturalHeight;
  cv.getContext("2d").drawImage(img, 0, 0);
  const blob = await new Promise((res, rej) => cv.toBlob(b => b ? res(b) : rej(new Error("canvas")), "image/png"));
  return { mime: "image/png", bytes: new Uint8Array(await blob.arrayBuffer()) };
}
async function resolveImage(src, onNote) {
  // trả về {bytes, mime, w, h} hoặc throw
  let bytes = null, mime = null, dataUri = null;
  if (/^data:image\//i.test(src)) {
    const d = dataUriToBytes(src);
    if (!d) throw new Error("ảnh base64 không đọc được");
    bytes = d.bytes; mime = d.mime; dataUri = src;
  } else {
    const resp = await fetch(src, { mode: "cors", cache: "force-cache" });
    if (!resp.ok) throw new Error("HTTP " + resp.status);
    const blob = await resp.blob();
    mime = blob.type || "image/png";
    bytes = new Uint8Array(await blob.arrayBuffer());
    dataUri = URL.createObjectURL(blob);
  }
  let dims = await loadImageDims(dataUri);
  if (dataUri.startsWith("blob:")) URL.revokeObjectURL(dataUri);
  const OK_MIME = { "image/png": "png", "image/jpeg": "jpg", "image/gif": "gif" };
  if (!OK_MIME[mime]) { // webp, bmp, svg... → chuyển PNG
    onNote && onNote("đang đổi ảnh sang PNG cho Word đọc được…");
    const conv = await convertToPng(/^data:/i.test(src) ? src : bytesToDataUri(bytes, mime || "image/png"));
    bytes = conv.bytes; mime = conv.mime;
    if (!dims) dims = await loadImageDims(bytesToDataUri(bytes, mime));
  }
  if (!dims) dims = { w: 600, h: 400 };
  return { bytes, ext: OK_MIME[mime] || "png", w: dims.w, h: dims.h };
}

export const xmlEsc = esc;
export function wRun(text, opts) {
  const o = opts || {};
  const props = [];
  if (o.bold) props.push("<w:b/>");
  if (o.italic) props.push("<w:i/>");
  if (o.caps) props.push("<w:caps/>");
  if (o.size) props.push('<w:sz w:val="' + o.size + '"/><w:szCs w:val="' + o.size + '"/>');
  if (o.color) props.push('<w:color w:val="' + o.color + '"/>');
  return "<w:r>" + (props.length ? "<w:rPr>" + props.join("") + "</w:rPr>" : "") + '<w:t xml:space="preserve">' + xmlEsc(text) + "</w:t></w:r>";
}
export function wPara(runs, pPr) { return "<w:p>" + (pPr ? "<w:pPr>" + pPr + "</w:pPr>" : "") + (runs || "") + "</w:p>"; }

export function imageParagraph(relId, docPrId, wPx, hPx) {
  const EMU_PX = 9525;
  const MAX_W = 5580000, MAX_H = 7600000; // ~6.1in x 8.3in
  let cx = Math.round(wPx * EMU_PX), cy = Math.round(hPx * EMU_PX);
  const s = Math.min(MAX_W / cx, MAX_H / cy, 1);
  cx = Math.round(cx * s); cy = Math.round(cy * s);
  return wPara('<w:r><w:drawing>' +
    '<wp:inline distT="0" distB="0" distL="0" distR="0">' +
    '<wp:extent cx="' + cx + '" cy="' + cy + '"/><wp:effectExtent l="0" t="0" r="0" b="0"/>' +
    '<wp:docPr id="' + docPrId + '" name="Hinh ' + docPrId + '"/>' +
    '<wp:cNvGraphicFramePr><a:graphicFrameLocks xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" noChangeAspect="1"/></wp:cNvGraphicFramePr>' +
    '<a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">' +
    '<a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">' +
    '<pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">' +
    '<pic:nvPicPr><pic:cNvPr id="' + docPrId + '" name="hinh' + docPrId + '"/><pic:cNvPicPr/></pic:nvPicPr>' +
    '<pic:blipFill><a:blip r:embed="' + relId + '"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>' +
    '<pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="' + cx + '" cy="' + cy + '"/></a:xfrm>' +
    '<a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr>' +
    "</pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r>",
    '<w:spacing w:before="120" w:after="160"/><w:jc w:val="center"/>');
}

export async function buildDocx(blocks, storyTitle, onProgress) {
  const IMG_SPLIT = /(\[\[IMG:[^\]]+\]\])/gi;
  // 1) thu thập ảnh
  const srcList = [];
  blocks.forEach(b => {
    String(b.content || "").replace(/(\r?\n){3,}/g, "\n\n").split("\n").forEach(line => {
      line.split(IMG_SPLIT).forEach(part => {
        if (!part) return;
        const m = part.match(/^\s*\[\[IMG:[^\]]+\]\]\s*$/i);
        if (m) {
          const src = imageSrcOf(b, part.trim());
          if (src && !srcList.includes(src)) srcList.push(src);
        }
      });
    });
  });
  const media = [];   // {relId, ext, bytes, w, h}
  const bySrc = new Map();
  const failed = new Map(); // src -> hyperlink relId
  let docPrId = 1, hyperRelId = 1000;
  for (let i = 0; i < srcList.length; i++) {
    const src = srcList[i];
    onProgress && onProgress("Đang nhúng ảnh " + (i + 1) + "/" + srcList.length + "…");
    try {
      const img = await resolveImage(src, note => onProgress && onProgress("Ảnh " + (i + 1) + ": " + note));
      const relId = "rIdImg" + (media.length + 1);
      media.push({ relId, ext: img.ext, bytes: img.bytes, w: img.w, h: img.h });
      bySrc.set(src, relId);
    } catch (e) {
      failed.set(src, "rIdLink" + (++hyperRelId));
    }
  }
  // 2) dựng body
  const bodyParts = [];
  let hasContent = false;
  blocks.forEach((b, bi) => {
    if (bi > 0) bodyParts.push('<w:p><w:r><w:br w:type="page"/></w:r></w:p>');
    bodyParts.push(wPara(wRun(stripInlineTags(b.title || "Chương..."), { bold: true, size: 32, color: "222222" }),
      '<w:pStyle w:val="Heading1"/><w:spacing w:before="240" w:after="200"/><w:jc w:val="center"/>' +
      '<w:pBdr><w:bottom w:val="dashed" w:sz="6" w:space="6" w:color="CCCCCC"/></w:pBdr>'));
    const lines = String(b.content || "").replace(/(\r?\n){3,}/g, "\n\n").split("\n");
    lines.forEach(raw => {
      const line = raw.trimEnd();
      if (!line.trim()) {
        bodyParts.push('<w:p><w:pPr><w:spacing w:after="0" w:line="120" w:lineRule="exact"/></w:pPr></w:p>');
        return;
      }
      hasContent = true;
      // dòng chỉ toàn token ảnh?
      const solo = line.trim().match(/^\[\[IMG:[^\]]+\]\]$/i);
      if (solo) {
        const src = imageSrcOf(b, line.trim());
        if (bySrc.has(src)) {
          const img = media.find(x => x.relId === bySrc.get(src));
          bodyParts.push(imageParagraph(img.relId, docPrId++, img.w, img.h));
        } else if (failed.has(src)) {
          const url = /^data:/i.test(src) ? "[Ảnh dán từ máy — chưa nhúng được]" : src;
          bodyParts.push(wPara('<w:hyperlink r:id="' + failed.get(src) + '">' +
            wRun(url, { color: "0563C1", size: 20 }) + "</w:hyperlink>",
            '<w:spacing w:after="160"/><w:jc w:val="center"/>'));
        }
        return;
      }
      // dòng thường: tách token ảnh ở giữa câu
      if (/\[\[IMG:/i.test(line)) {
        line.split(IMG_SPLIT).forEach(part => {
          if (!part) return;
          const m = part.match(/\[\[IMG:[^\]]+\]\]/i);
          if (m) {
            const src = imageSrcOf(b, m[0]);
            if (bySrc.has(src)) {
              const img = media.find(x => x.relId === bySrc.get(src));
              bodyParts.push(imageParagraph(img.relId, docPrId++, img.w, img.h));
            } else if (failed.has(src)) {
              bodyParts.push(wPara('<w:hyperlink r:id="' + failed.get(src) + '">' +
                wRun(/^data:/i.test(src) ? "[ảnh]" : src, { color: "0563C1", size: 20 }) + "</w:hyperlink>", ""));
            }
          } else if (part.trim()) {
            bodyParts.push(wPara(wRunsFromInline(part, { size: 22, color: "333333" }), '<w:spacing w:after="120" w:line="288" w:lineRule="auto"/><w:jc w:val="both"/>'));
          }
        });
        return;
      }
      const dlg = parseSmartLine(line);
      if (dlg && dlg.message !== "(Nhãn dán: " + dlg.name + ")") {
        bodyParts.push(wPara(wRun(stripInlineTags(dlg.name), { bold: true, size: 22, color: "1F1F1F" }) + wRunsFromInline(": " + dlg.message, { size: 22, color: "333333" }),
          '<w:spacing w:after="120" w:line="288" w:lineRule="auto"/><w:jc w:val="both"/>'));
      } else if (dlg) { // nhãn dán
        bodyParts.push(wPara(wRunsFromInline(dlg.message, { italic: true, size: 22, color: "777777" }),
          '<w:spacing w:after="120"/><w:jc w:val="center"/>'));
      } else {
        bodyParts.push(wPara(wRunsFromInline(line, { size: 22, color: "333333" }), '<w:spacing w:after="120" w:line="288" w:lineRule="auto"/><w:jc w:val="both"/>'));
      }
    });
  });
  if (!hasContent && !media.length) throw new Error("EMPTY");
  // 3) các part của file
  const now = new Date().toISOString();
  const contentTypes = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
    '<Default Extension="xml" ContentType="application/xml"/>' +
    '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>' +
    '<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>' +
    '<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>' +
    '<Default Extension="png" ContentType="image/png"/><Default Extension="jpg" ContentType="image/jpeg"/><Default Extension="gif" ContentType="image/gif"/>' +
    "</Types>";
  const rootRels = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>' +
    '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>' +
    "</Relationships>";
  let docRels = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>';
  media.forEach(m => {
    docRels += '<Relationship Id="' + m.relId + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/' + m.relId + "." + m.ext + '"/>';
  });
  failed.forEach((relId, src) => {
    if (!/^data:/i.test(src)) {
      docRels += '<Relationship Id="' + relId + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink" Target="' + xmlEsc(src) + '" TargetMode="External"/>';
    }
  });
  docRels += "</Relationships>";
  const styles = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
    '<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">' +
    '<w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Segoe UI" w:hAnsi="Segoe UI" w:cs="Segoe UI"/>' +
    '<w:sz w:val="22"/><w:szCs w:val="22"/><w:lang w:val="vi-VN"/></w:rPr></w:rPrDefault></w:docDefaults>' +
    '<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style>' +
    '<w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:uiPriority w:val="9"/><w:qFormat/>' +
    '<w:pPr><w:keepNext/><w:keepLines/><w:outlineLvl w:val="0"/></w:pPr>' +
    '<w:rPr><w:b/><w:sz w:val="32"/><w:szCs w:val="32"/><w:color w:val="222222"/></w:rPr></w:style></w:styles>';
  const core = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
    '<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">' +
    "<dc:title>" + xmlEsc(storyTitle || "Truyện") + "</dc:title><dc:creator>Chuseoz Story Tool</dc:creator>" +
    "<cp:lastModifiedBy>Chuseoz Story Tool</cp:lastModifiedBy>" +
    '<dcterms:created xsi:type="dcterms:W3CDTF">' + now + "</dcterms:created>" +
    '<dcterms:modified xsi:type="dcterms:W3CDTF">' + now + "</dcterms:modified></cp:coreProperties>";
  const document = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
    '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing">' +
    "<w:body>" + bodyParts.join("") +
    '<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="708" w:footer="708" w:gutter="0"/></w:sectPr>' +
    "</w:body></w:document>";
  const enc = new TextEncoder();
  const entries = [
    { name: "[Content_Types].xml", data: enc.encode(contentTypes) },
    { name: "_rels/.rels", data: enc.encode(rootRels) },
    { name: "docProps/core.xml", data: enc.encode(core) },
    { name: "word/_rels/document.xml.rels", data: enc.encode(docRels) },
    { name: "word/styles.xml", data: enc.encode(styles) },
    { name: "word/document.xml", data: enc.encode(document) }
  ];
  media.forEach(m => entries.push({ name: "word/media/" + m.relId + "." + m.ext, data: m.bytes }));
  const zip = zipStore(entries);
  return new Blob([zip], { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
}
