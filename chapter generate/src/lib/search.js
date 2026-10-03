/* ===== TÌM & THAY THẾ — hàm thuần. Không lookbehind (Safari cũ); "cả từ" theo \p{L}/\p{N} nên đúng tiếng Việt ===== */

function escapeRe(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const WORD_CHAR = /[\p{L}\p{N}_]/u;

function isWordChar(ch) {
  return !!ch && WORD_CHAR.test(ch);
}

/** Regex khớp chuỗi truy vấn (chưa kèm ràng buộc "cả từ"). */
export function buildRegExp(query, opts) {
  const o = opts || {};
  return new RegExp(escapeRe(query), o.caseSensitive ? "gu" : "gui");
}

/** @returns {{index:number,length:number}[]} mọi vị trí khớp trong 1 chuỗi */
export function findIn(text, query, opts) {
  if (!query) return [];
  const o = opts || {};
  const re = buildRegExp(query, o);
  const s = String(text);
  const out = [];
  let m;
  while ((m = re.exec(s)) !== null) {
    if (m[0].length === 0) { re.lastIndex++; continue; } // tránh lặp vô hạn
    if (o.wholeWord && (isWordChar(s[m.index - 1]) || isWordChar(s[m.index + m[0].length]))) {
      continue;
    }
    out.push({ index: m.index, length: m[0].length });
  }
  return out;
}

/** Thay tất cả trong 1 chuỗi, trả về chuỗi mới + số lần thay. */
export function replaceIn(text, query, replacement, opts) {
  if (!query) return { text: String(text), count: 0 };
  const s = String(text);
  // thay từ cuối về đầu để chỉ số không bị lệch
  const hits = findIn(s, query, opts);
  if (!hits.length) return { text: s, count: 0 };
  let out = s;
  for (let i = hits.length - 1; i >= 0; i--) {
    const h = hits[i];
    out = out.slice(0, h.index) + replacement + out.slice(h.index + h.length);
  }
  return { text: out, count: hits.length };
}

/** Thay đúng 1 lần tại vị trí cho trước (nút "Thay" khi đang đứng ở 1 kết quả). */
export function replaceAt(text, hit, replacement) {
  const s = String(text);
  return {
    text: s.slice(0, hit.index) + replacement + s.slice(hit.index + hit.length),
    count: 1,
  };
}

/** Gom kết quả tìm trên nhiều khối.
 *  @param {{id:string,text:string}[]} items
 *  @returns {{itemId:string,index:number,length:number}[]} */
export function findAcross(items, query, opts) {
  const out = [];
  (items || []).forEach((it) => {
    findIn(it.text, query, opts).forEach((h) => out.push({ itemId: it.id, ...h }));
  });
  return out;
}

/** Đếm số từ / ký tự / phút đọc — dùng cho thanh thống kê. */
export function textStats(text) {
  const s = String(text || "");
  const chars = s.length;
  const words = (s.replace(/<[^>]*>/g, " ").match(/\S+/g) || []).length;
  return { chars, words, minutes: Math.max(chars ? 1 : 0, Math.round(words / 200)) };
}
