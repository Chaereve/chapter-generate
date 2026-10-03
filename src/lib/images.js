export const TOKEN_RE = /\[\[IMG:([^|]+)(?:\|([^|]*))?\]\]/i; // có group, dùng để bóc payload

/* ---- ảnh: dữ liệu nằm riêng ở block.images, nội dung chỉ giữ token ngắn [[IMG:i…]] ---- */
export function makeImageId(n) {
  return "i" + Date.now().toString(36) + (n || 0).toString(36) + Math.random().toString(36).slice(2, 5);
}
export function addBlockImage(b, src, cz) {
  if (!b.images || typeof b.images !== "object") b.images = {};
  let id = makeImageId();
  while (b.images[id]) id = makeImageId();
  b.images[id] = { src: String(src) };
  if (cz) b.images[id].cz = cz; // nhớ mức nén → reload không nén lại
  return id;
}
/* trả về src thật của token: ưu tiên id trong kho ảnh, sau đó chấp nhận token cũ (URL/data dài) */
/* Chỉ nhận http(s) và data:image/ — chặn javascript:, vbscript:, data:text/html…
   src trong block.images cũng phải qua đây: backup nạp vào có thể chứa URL độc. */
const SAFE_SRC = /^(?:https?:\/\/|data:image\/)/i;
export function isSafeImageSrc(src) {
  return typeof src === "string" && SAFE_SRC.test(src.trim());
}
export function imageSrcOf(block, token) {
  const m = String(token || "").match(TOKEN_RE);
  if (!m) return null;
  const payload = m[1];
  const imgs = block && block.images;
  const stored = imgs && imgs[payload] && imgs[payload].src;
  if (stored && isSafeImageSrc(stored)) return stored;
  try {
    const dec = decodeURIComponent(payload);
    if (isSafeImageSrc(dec)) return dec;
  } catch (e) {}
  if (isSafeImageSrc(payload)) return payload;
  return null;
}
/* nạp dữ liệu cũ: kéo token dài (URL/base64 encode) ra kho ảnh, thay bằng token ngắn */
export function migrateBlockImages(b) {
  const images = (b.images && typeof b.images === "object") ? Object.assign({}, b.images) : {};
  let counter = 0;
  b.content = String(b.content || "").replace(/\[\[IMG:([^\]|]+)(?:\|[^|\]]*)?\]\]/gi, (m0, payload) => {
    if (images[payload] && images[payload].src) return "[[IMG:" + payload + "]]"; // đã ngắn, giữ nguyên
    let src = null;
    try {
      const dec = decodeURIComponent(payload);
      if (/^https?:\/\//i.test(dec) || /^data:image\//i.test(dec)) src = dec;
    } catch (e) {}
    if (!src && (/^https?:\/\//i.test(payload) || /^data:image\//i.test(payload))) src = payload;
    if (!src) return m0; // token lạ — đừng đụng vào
    let id = makeImageId(counter++);
    while (images[id]) id = makeImageId(counter++);
    images[id] = { src };
    return "[[IMG:" + id + "]]";
  });
  b.images = images;
  return b;
}

/* nén ảnh dán/tải lên: thu về tối đa maxPx + JPEG, giảm mạnh dung lượng lưu máy */
export function compressImageSrc(src, maxPx, quality) {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
      try {
        const w = img.naturalWidth, h = img.naturalHeight;
        if (!w || !h) return resolve(src);
        const MAX = maxPx || 1200;
        const k = Math.min(1, MAX / Math.max(w, h));
        if (k === 1 && src.length < 250000) return resolve(src); // ảnh nhỏ sẵn — giữ nguyên
        const cv = document.createElement("canvas");
        cv.width = Math.max(1, Math.round(w * k));
        cv.height = Math.max(1, Math.round(h * k));
        const ctx = cv.getContext("2d");
        if (!ctx) return resolve(src);
        ctx.fillStyle = "#ffffff"; // PNG trong suốt → nền trắng thay vì đen
        ctx.fillRect(0, 0, cv.width, cv.height);
        ctx.drawImage(img, 0, 0, cv.width, cv.height);
        resolve(cv.toDataURL("image/jpeg", quality || 0.8));
      } catch (e) { resolve(src); }
    };
    img.onerror = () => resolve(src);
    img.src = src;
  });
}
