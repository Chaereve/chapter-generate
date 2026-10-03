/* ============================================================
   IndexedDB — kho lưu lớn cho ảnh và bản sao lịch sử.
   localStorage chỉ ~5MB; IndexedDB thường cho hàng trăm MB.
   Mọi hàm đều an toàn: nếu trình duyệt chặn IndexedDB thì trả giá trị
   "không dùng được" thay vì ném lỗi, để app chạy tiếp bằng localStorage.
   ============================================================ */

const DB_NAME = "chuseoz";
const DB_VERSION = 1;
const STORES = ["images", "snapshots"];

let dbPromise = null;
let unavailable = false;

export function idbAvailable() {
  return typeof indexedDB !== "undefined" && !unavailable;
}

function openDb() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve) => {
    if (!idbAvailable()) { resolve(null); return; }
    let req;
    try { req = indexedDB.open(DB_NAME, DB_VERSION); } catch (e) { unavailable = true; resolve(null); return; }
    req.onupgradeneeded = () => {
      const db = req.result;
      STORES.forEach((name) => {
        if (!db.objectStoreNames.contains(name)) db.createObjectStore(name);
      });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => { unavailable = true; resolve(null); };
    req.onblocked = () => { unavailable = true; resolve(null); };
  });
  return dbPromise;
}

const NO_RESULT = Symbol("no-result");

function tx(storeName, mode, fn) {
  return openDb().then(
    (db) =>
      new Promise((resolve) => {
        if (!db) { resolve(null); return; }
        try {
          const t = db.transaction(storeName, mode);
          const store = t.objectStore(storeName);
          let result = NO_RESULT;
          const req = fn(store);
          if (req) req.onsuccess = () => { result = req.result; };
          // lệnh ghi (put/delete) không có kết quả hữu ích → coi là true
          t.oncomplete = () => resolve(result === NO_RESULT ? true : result);
          t.onerror = () => resolve(null);
          t.onabort = () => resolve(null);
        } catch (e) { resolve(null); }
      }),
  );
}

/* ---------- ảnh ---------- */
export const putImage = (id, dataUrl) => tx("images", "readwrite", (s) => s.put(dataUrl, id));
export const getImage = (id) => tx("images", "readonly", (s) => s.get(id));
export const deleteImage = (id) => tx("images", "readwrite", (s) => s.delete(id));
export const imageKeys = () => tx("images", "readonly", (s) => s.getAllKeys());

/* ---------- bản sao lịch sử ---------- */
export const putSnapshot = (key, value) => tx("snapshots", "readwrite", (s) => s.put(value, key));
export const getSnapshot = (key) => tx("snapshots", "readonly", (s) => s.get(key));
export const snapshotKeys = () => tx("snapshots", "readonly", (s) => s.getAllKeys());
export const deleteSnapshot = (key) => tx("snapshots", "readwrite", (s) => s.delete(key));

/** Tổng dung lượng (byte) đang chiếm — ước lượng theo độ dài chuỗi data URL. */
export async function idbUsageBytes() {
  const keys = await imageKeys();
  if (!keys || !keys.length) return 0;
  let total = 0;
  for (const k of keys) {
    const v = await getImage(k);
    total += (typeof v === "string" ? v.length : 0) * 2;
  }
  return total;
}
