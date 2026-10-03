/* ============================================================
   ĐỊNH DẠNG IN ĐẬM / IN NGHIÊNG trong contenteditable
   bằng Range API — thay cho document.execCommand("bold"/"italic")
   đã bị loại bỏ khỏi chuẩn web.
   ============================================================ */

const INLINE = { b: "b", strong: "b", i: "i", em: "i" };

/** Tìm thẻ inline cùng loại bao quanh node (nếu có), dừng ở biên root. */
export function closestInline(node, tagName, root) {
  let n = node && node.nodeType === 3 ? node.parentNode : node;
  while (n && n !== root && n !== document.body) {
    if (n.nodeType === 1) {
      const t = INLINE[n.tagName.toLowerCase()];
      if (t === tagName) return n;
    }
    n = n.parentNode;
  }
  return null;
}

/** Bỏ thẻ <tag> nhưng giữ nội dung bên trong. */
export function unwrapTag(el) {
  const parent = el.parentNode;
  if (!parent) return;
  while (el.firstChild) parent.insertBefore(el.firstChild, el);
  parent.removeChild(el);
  parent.normalize && parent.normalize();
}

/** Mở rộng vùng chọn đang collapsed ra trọn từ dưới con trỏ. */
function expandToWord(range) {
  const node = range.startContainer;
  if (node.nodeType !== 3) return null;
  const text = node.nodeValue || "";
  let a = range.startOffset;
  let z = range.startOffset;
  while (a > 0 && /\S/.test(text[a - 1])) a--;
  while (z < text.length && /\S/.test(text[z])) z++;
  if (a === z) return null;
  const r = document.createRange();
  r.setStart(node, a);
  r.setEnd(node, z);
  return r;
}

/**
 * Liệt kê các node chữ nằm trong range.
 * Tự duyệt đệ quy thay vì TreeWalker(SHOW_TEXT) — một số môi trường
 * lọc whatToShow không đúng, và cách này chạy y hệt trên mọi trình duyệt.
 */
export function textNodesOf(root) {
  const out = [];
  const collect = (node) => {
    const kids = node.childNodes;
    for (let i = 0; i < kids.length; i++) {
      const n = kids[i];
      if (n.nodeType === 3) { if (n.nodeValue) out.push(n); }
      else if (n.nodeType === 1) collect(n);
    }
  };
  collect(root);
  return out;
}

export function textNodesIn(range) {
  const out = [];
  const root = range.commonAncestorContainer;
  const collect = (node) => {
    const kids = node.childNodes;
    for (let i = 0; i < kids.length; i++) {
      const n = kids[i];
      if (n.nodeType === 3) { if (n.nodeValue) out.push(n); }
      else if (n.nodeType === 1) collect(n);
    }
  };
  if (root.nodeType === 3) out.push(root);
  else collect(root);
  return out.filter((n) => rangeIntersects(range, n));
}

function rangeIntersects(range, node) {
  try {
    if (typeof range.intersectsNode === "function") return range.intersectsNode(node);
    const probe = document.createRange();
    probe.selectNodeContents(node);
    return range.compareBoundaryPoints(3 /* END_TO_START */, probe) <= 0 &&
           range.compareBoundaryPoints(1 /* START_TO_END */, probe) >= 0;
  } catch (e) {
    return true; // không xác định được thì cứ xét — an toàn hơn là bỏ sót
  }
}

/** Trả về thẻ <tag> đang bọc trọn vùng chọn, hoặc null. */
function enclosingTagOf(range, tagName, root) {
  const nodes = textNodesIn(range);
  if (!nodes.length) return null;
  let owner = null;
  for (const n of nodes) {
    const c = closestInline(n, tagName, root);
    if (!c) return null;
    if (owner === null) owner = c;
    else if (owner !== c) return null;
  }
  return owner;
}

/**
 * Bật/tắt in đậm (tagName = "b") hoặc in nghiêng (tagName = "i") cho vùng chọn.
 * @returns {boolean} true nếu DOM có thay đổi
 */
export function toggleInline(root, tagName) {
  const sel = typeof window !== "undefined" && window.getSelection && window.getSelection();
  if (!sel || !sel.rangeCount || !root) return false;
  let range = sel.getRangeAt(0);
  if (!root.contains(range.commonAncestorContainer)) return false;

  if (range.collapsed) {
    const w = expandToWord(range);
    if (!w) return false;
    range = w;
    sel.removeAllRanges();
    sel.addRange(range);
  }

  /* Nếu MỌI node chữ trong vùng chọn đều đã nằm trong cùng một thẻ <tag>
     thì bỏ định dạng. Kiểm tra theo từng node chứ không theo
     commonAncestorContainer — vì khi bôi đen cả thẻ, commonAncestor lại là
     phần tử cha và sẽ không thấy thẻ <b> bên trong. */
  const owner = enclosingTagOf(range, tagName, root);
  if (owner) {
    unwrapTag(owner);
    return true;
  }

  const el = document.createElement(tagName);
  try {
    el.appendChild(range.extractContents());
  } catch (e) {
    return false;
  }
  if (!el.textContent) return false; // không tạo thẻ rỗng
  range.insertNode(el);
  const r = document.createRange();
  r.selectNodeContents(el);
  sel.removeAllRanges();
  sel.addRange(r);
  return true;
}

/** Chèn văn bản thuần tại con trỏ (không dùng execCommand). */
export function insertTextAtCaret(root, text, fallbackRange) {
  const sel = window.getSelection();
  if (!sel) return false;
  let range;
  if (sel.rangeCount && root.contains(sel.getRangeAt(0).commonAncestorContainer)) {
    range = sel.getRangeAt(0);
  } else if (fallbackRange) {
    range = fallbackRange;
  } else {
    range = document.createRange();
    range.selectNodeContents(root);
    range.collapse(false);
  }
  range.deleteContents();
  const node = document.createTextNode(text);
  range.insertNode(node);
  range.setStartAfter(node);
  range.collapse(true);
  sel.removeAllRanges();
  sel.addRange(range);
  return true;
}

/** Chèn HTML (đã escape sẵn) tại con trỏ. */
export function insertHtmlAtCaret(root, html, fallbackRange) {
  const sel = window.getSelection();
  if (!sel) return false;
  let range;
  if (sel.rangeCount && root.contains(sel.getRangeAt(0).commonAncestorContainer)) {
    range = sel.getRangeAt(0);
  } else if (fallbackRange) {
    range = fallbackRange;
  } else {
    range = document.createRange();
    range.selectNodeContents(root);
    range.collapse(false);
  }
  range.deleteContents();
  const tmp = document.createElement("div");
  tmp.innerHTML = html;
  const frag = document.createDocumentFragment();
  let last = null;
  while (tmp.firstChild) { last = frag.appendChild(tmp.firstChild); }
  if (!last) return false;
  range.insertNode(frag);
  const r = document.createRange();
  r.setStartAfter(last);
  r.collapse(true);
  sel.removeAllRanges();
  sel.addRange(r);
  return true;
}
