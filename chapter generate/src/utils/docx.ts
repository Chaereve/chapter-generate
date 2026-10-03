import { StoryBlock } from '../types';
import { parseDialogueLine } from './story';

/* ============================================================
   XUẤT WORD (.DOCX) — tạo file Office Open-XML trực tiếp trong
   trình duyệt, không cần thư viện ngoài. ZIP "stored" (không
   nén) tự viết tay, đã kiểm chứng bằng `unzip -t`.
   ============================================================ */

const XML_ESC_MAP: [RegExp, string][] = [
  [/&/g, '&amp;'],
  [/</g, '&lt;'],
  [/>/g, '&gt;'],
  [/"/g, '&quot;'],
  [/'/g, '&apos;'],
];

function xmlEsc(s: string): string {
  let out = s ?? '';
  for (const [re, rep] of XML_ESC_MAP) out = out.replace(re, rep);
  return out;
}

/* ---------- CRC32 + ZIP (stored, no compression) ---------- */
const CRC_TABLE: Uint32Array = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 255] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

interface ZipEntry {
  name: string;
  data: Uint8Array;
}

function zipStore(entries: ZipEntry[]): Uint8Array {
  const enc = new TextEncoder();
  const u32 = (v: number, n: number): Uint8Array => {
    const a = new Uint8Array(n);
    for (let i = 0; i < n; i++) a[i] = (v >>> (i * 8)) & 255;
    return a;
  };
  const join = (arrs: Uint8Array[]): Uint8Array => {
    let len = 0;
    arrs.forEach((a) => (len += a.length));
    const out = new Uint8Array(len);
    let o = 0;
    arrs.forEach((a) => {
      out.set(a, o);
      o += a.length;
    });
    return out;
  };

  const locals: Uint8Array[] = [];
  const centrals: Uint8Array[] = [];
  let offset = 0;
  for (const e of entries) {
    const name = enc.encode(e.name);
    const crc = crc32(e.data);
    const size = e.data.length;
    locals.push(
      join([
        u32(0x04034b50, 4), u32(20, 2), u32(0, 2), u32(0, 2), u32(0, 2), u32(0, 2),
        u32(crc, 4), u32(size, 4), u32(size, 4), u32(name.length, 2), u32(0, 2),
        name, e.data,
      ])
    );
    centrals.push(
      join([
        u32(0x02014b50, 4), u32(20, 2), u32(20, 2), u32(0, 2), u32(0, 2), u32(0, 2),
        u32(0, 2), u32(crc, 4), u32(size, 4), u32(size, 4), u32(name.length, 2),
        u32(0, 2), u32(0, 2), u32(0, 2), u32(0, 2), u32(0, 4), u32(offset, 4),
        name,
      ])
    );
    offset += locals[locals.length - 1].length;
  }
  const cdir = join(centrals);
  const end = join([
    u32(0x06054b50, 4), u32(0, 2), u32(0, 2), u32(entries.length, 2), u32(entries.length, 2),
    u32(cdir.length, 4), u32(offset, 4), u32(0, 2),
  ]);
  return join([join(locals), cdir, end]);
}

/* ---------- Word-ML helpers ---------- */
interface RunOpts {
  bold?: boolean;
  italic?: boolean;
  caps?: boolean;
  size?: number;
  color?: string;
}

function wRun(text: string, opts?: RunOpts): string {
  const o = opts ?? {};
  const props: string[] = [];
  if (o.bold) props.push('<w:b/>');
  if (o.italic) props.push('<w:i/>');
  if (o.caps) props.push('<w:caps/>');
  if (o.size) props.push(`<w:sz w:val="${o.size}"/><w:szCs w:val="${o.size}"/>`);
  if (o.color) props.push(`<w:color w:val="${o.color}"/>`);
  return (
    '<w:r>' +
    (props.length ? `<w:rPr>${props.join('')}</w:rPr>` : '') +
    `<w:t xml:space="preserve">${xmlEsc(text)}</w:t></w:r>`
  );
}

function wPara(runs: string, pPr?: string): string {
  return '<w:p>' + (pPr ? `<w:pPr>${pPr}</w:pPr>` : '') + runs + '</w:p>';
}

/* ---------- Build .docx từ các chương ---------- */
export function buildDocx(blocks: StoryBlock[], storyTitle: string): Blob {
  const bodyParts: string[] = [];
  let hasContent = false;

  blocks.forEach((b, bi) => {
    if (bi > 0) bodyParts.push('<w:p><w:r><w:br w:type="page"/></w:r></w:p>');
    bodyParts.push(
      wPara(
        wRun(b.title || 'Chương...', { bold: true, size: 32, color: '222222' }),
        '<w:pStyle w:val="Heading1"/><w:spacing w:before="240" w:after="200"/><w:jc w:val="center"/>' +
          '<w:pBdr><w:bottom w:val="dashed" w:sz="6" w:space="6" w:color="CCCCCC"/></w:pBdr>'
      )
    );

    const lines = (b.content || '').replace(/(\r?\n){3,}/g, '\n\n').split('\n');
    lines.forEach((raw) => {
      const line = raw.trimEnd();
      if (!line.trim()) {
        bodyParts.push('<w:p><w:pPr><w:spacing w:after="0" w:line="120" w:lineRule="exact"/></w:pPr></w:p>');
        return;
      }
      hasContent = true;
      const dlg = parseDialogueLine(line);
      if (dlg && dlg.isSticker) {
        bodyParts.push(
          wPara(wRun(dlg.message, { italic: true, size: 22, color: '777777' }),
            '<w:spacing w:after="120"/><w:jc w:val="center"/>')
        );
      } else if (dlg) {
        bodyParts.push(
          wPara(
            wRun(dlg.name, { bold: true, size: 22, color: '1F1F1F' }) +
              wRun(': ' + dlg.message, { size: 22, color: '333333' }),
            '<w:spacing w:after="120" w:line="288" w:lineRule="auto"/><w:jc w:val="both"/>'
          )
        );
      } else {
        bodyParts.push(
          wPara(wRun(line, { size: 22, color: '333333' }),
            '<w:spacing w:after="120" w:line="288" w:lineRule="auto"/><w:jc w:val="both"/>')
        );
      }
    });
  });

  if (!hasContent) throw new Error('EMPTY');

  const now = new Date().toISOString();
  const contentTypes =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
    '<Default Extension="xml" ContentType="application/xml"/>' +
    '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>' +
    '<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>' +
    '<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>' +
    '</Types>';

  const rootRels =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>' +
    '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>' +
    '</Relationships>';

  const docRels =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>' +
    '</Relationships>';

  const styles =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
    '<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">' +
    '<w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Segoe UI" w:hAnsi="Segoe UI" w:cs="Segoe UI"/>' +
    '<w:sz w:val="22"/><w:szCs w:val="22"/><w:lang w:val="vi-VN"/></w:rPr></w:rPrDefault></w:docDefaults>' +
    '<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style>' +
    '<w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:uiPriority w:val="9"/><w:qFormat/>' +
    '<w:pPr><w:keepNext/><w:keepLines/><w:outlineLvl w:val="0"/></w:pPr>' +
    '<w:rPr><w:b/><w:sz w:val="32"/><w:szCs w:val="32"/><w:color w:val="222222"/></w:rPr></w:style></w:styles>';

  const core =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
    '<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">' +
    `<dc:title>${xmlEsc(storyTitle || 'Truyện')}</dc:title><dc:creator>Chuseoz Story Tool</dc:creator>` +
    '<cp:lastModifiedBy>Chuseoz Story Tool</cp:lastModifiedBy>' +
    `<dcterms:created xsi:type="dcterms:W3CDTF">${now}</dcterms:created>` +
    `<dcterms:modified xsi:type="dcterms:W3CDTF">${now}</dcterms:modified></cp:coreProperties>`;

  const document =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
    '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing">' +
    '<w:body>' +
    bodyParts.join('') +
    '<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="708" w:footer="708" w:gutter="0"/></w:sectPr>' +
    '</w:body></w:document>';

  const enc = new TextEncoder();
  const entries: ZipEntry[] = [
    { name: '[Content_Types].xml', data: enc.encode(contentTypes) },
    { name: '_rels/.rels', data: enc.encode(rootRels) },
    { name: 'docProps/core.xml', data: enc.encode(core) },
    { name: 'word/_rels/document.xml.rels', data: enc.encode(docRels) },
    { name: 'word/styles.xml', data: enc.encode(styles) },
    { name: 'word/document.xml', data: enc.encode(document) },
  ];
  const zip = zipStore(entries);
  return new Blob([zip as unknown as BlobPart], {
    type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  });
}

/** Tạo blob + tải xuống, trả về tên file đã xuất. */
export function downloadDocx(blocks: StoryBlock[], storyTitle: string): string {
  const blob = buildDocx(blocks, storyTitle);
  const fileName =
    (storyTitle.replace(/[\\/:*?"<>|]+/g, ' ').trim() || 'truyen') + '.docx';
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  return fileName;
}
