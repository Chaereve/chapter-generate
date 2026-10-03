/* ---------- helpers ---------- */
export const $ = s => document.querySelector(s);
export const esc = s => String(s == null ? "" : s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&apos;");
export const escHtml = s => String(s == null ? "" : s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
export const uid = p => (p || "id_") + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 8);
export const debounce = (fn, ms) => { let t; const f = (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; f.cancel = () => clearTimeout(t); return f; };
export const fmtTime = d => new Date(d).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
export const fmtCount = n => n >= 1000 ? (n/1000).toFixed(n >= 10000 ? 0 : 1).replace(".", ",") + "k" : String(n);

export { icon } from "./icons.js";

export function fmtBytes(n) {
  if (n >= 1048576) return (n / 1048576).toFixed(1).replace(".", ",") + " MB";
  if (n >= 1024) return Math.round(n / 1024) + " KB";
  return n + " B";
}
