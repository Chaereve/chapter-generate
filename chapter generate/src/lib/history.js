/* ===== UNDO/REDO cấp ứng dụng — contenteditable chỉ hoàn tác trong 1 ô và mất khi DOM dựng lại ===== */

const DEFAULT_LIMIT = 80;

export function createHistory(opts) {
  const o = opts || {};
  const limit = o.limit || DEFAULT_LIMIT;
  const past = [];
  const future = [];
  let current = null;

  /** Chuỗi hoá phần có thể hoàn tác của blocks (bỏ ảnh base64 cho nhẹ). */
  const snap = (blocks) =>
    JSON.stringify(
      (blocks || []).map((b) => ({
        id: b.id,
        title: b.title || "",
        leftChars: b.leftChars || "",
        rightChars: b.rightChars || "",
        content: b.content || "",
      })),
    );

  return {
    get size() { return past.length; },
    get redoSize() { return future.length; },
    canUndo() { return past.length > 0; },
    canRedo() { return future.length > 0; },

    /** Đặt trạng thái gốc; gọi khi mở/truyện đổi. */
    reset(blocks) {
      past.length = 0;
      future.length = 0;
      current = snap(blocks);
    },

    /** Ghi trạng thái mới; nếu khác hiện tại thì đẩy bản cũ vào undo. @returns {boolean} */
    push(blocks) {
      const next = snap(blocks);
      if (next === current) return false;
      if (current !== null) {
        past.push(current);
        if (past.length > limit) past.shift();
      }
      future.length = 0;
      current = next;
      return true;
    },

    /** Lùi 1 bước. Trả về danh sách block đã khôi phục, hoặc null nếu không lùi được. */
    undo(blocks) {
      if (!past.length) return null;
      const prev = past.pop();
      future.push(snap(blocks));
      current = prev;
      return merge(prev, blocks);
    },

    /** Tiến 1 bước. */
    redo(blocks) {
      if (!future.length) return null;
      const next = future.pop();
      past.push(snap(blocks));
      current = next;
      return merge(next, blocks);
    },
  };
}

/** Áp snapshot lên blocks, GIỮ LẠI block.images cùng id (ảnh không nằm trong snapshot). */
export function merge(snapshotJson, blocks) {
  const list = JSON.parse(snapshotJson);
  const imagesById = new Map();
  (blocks || []).forEach((b) => { if (b.images) imagesById.set(b.id, b.images); });
  return list.map((s) => ({
    ...s,
    images: imagesById.get(s.id) || {},
  }));
}
