/* ===== NHẬT KÝ CHẨN ĐOÁN — 200 mục gần nhất, xuất file được; thay cho `catch (e) {}` nuốt lỗi ===== */

const LIMIT = 200;
const entries = [];
let installed = false;

function stamp() {
  return new Date().toISOString();
}

export function log(level, scope, message, detail) {
  entries.push({
    t: stamp(),
    level,
    scope: scope || "app",
    message: String(message == null ? "" : message),
    detail: detail === undefined ? undefined : String(detail).slice(0, 800),
  });
  if (entries.length > LIMIT) entries.splice(0, entries.length - LIMIT);
}

export const logInfo = (scope, m, d) => log("info", scope, m, d);
export const logWarn = (scope, m, d) => log("warn", scope, m, d);
export const logError = (scope, m, d) => log("error", scope, m, d);

export function getEntries() {
  return entries.slice();
}

export function clearEntries() {
  entries.length = 0;
}

/** Bắt lỗi chưa xử lý + lỗi tài nguyên, và gói console.error. */
export function installGlobalHandlers() {
  if (installed) return;
  installed = true;
  if (typeof window === "undefined") return;

  window.addEventListener("error", (ev) => {
    logError("window", ev.message || "Lỗi không rõ", (ev.filename || "") + ":" + (ev.lineno || 0));
  });
  window.addEventListener("unhandledrejection", (ev) => {
    const r = ev.reason;
    logError("promise", (r && r.message) || String(r), r && r.stack);
  });

  const origError = console.error;
  console.error = function (...args) {
    logError("console", args.map((a) => (a && a.message) || String(a)).join(" "));
    return origError.apply(console, args);
  };
}

/** Dựng nội dung file chẩn đoán (.txt) để người dùng tải về. */
export function buildReport(extra) {
  const info = extra || {};
  const lines = [
    "Chuseoz — báo cáo chẩn đoán",
    "Thời điểm: " + stamp(),
    "Phiên bản: " + (info.version || "?"),
    "Trình duyệt: " + (typeof navigator !== "undefined" ? navigator.userAgent : "?"),
    "Ngôn ngữ: " + (typeof navigator !== "undefined" ? navigator.language : "?"),
    "Màn hình: " + (typeof window !== "undefined" ? window.innerWidth + "x" + window.innerHeight : "?"),
    "localStorage dùng được: " + (info.localStorage ? "có" : "không"),
    "IndexedDB dùng được: " + (info.indexedDB ? "có" : "không"),
    "Dung lượng đã dùng: " + (info.storageUsed || "?"),
    "Số truyện: " + (info.projects != null ? info.projects : "?"),
    "",
    "---- nhật ký (" + entries.length + " mục gần nhất) ----",
  ];
  entries.forEach((e) => {
    lines.push("[" + e.t + "] " + e.level.toUpperCase() + " " + e.scope + ": " + e.message + (e.detail ? " | " + e.detail : ""));
  });
  return lines.join("\n") + "\n";
}
