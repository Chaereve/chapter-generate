/* ---------- helpers ---------- */
export const $ = s => document.querySelector(s);
export const esc = s => String(s == null ? "" : s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&apos;");
export const escHtml = s => String(s == null ? "" : s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
export const uid = p => (p || "id_") + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 8);
export const debounce = (fn, ms) => { let t; const f = (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; f.cancel = () => clearTimeout(t); return f; };
export const fmtTime = d => new Date(d).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
export const fmtCount = n => n >= 1000 ? (n/1000).toFixed(n >= 10000 ? 0 : 1).replace(".", ",") + "k" : String(n);

export const ICONS = {
  plus:'<path d="M8 3v10M3 8h10"/>', trash:'<path d="M3 4.5h10M6.5 4.5V3h3v1.5M4.5 4.5l.6 8.5h5.8l.6-8.5"/>',
  copy:'<rect x="5.5" y="5.5" width="8" height="8" rx="1.5"/><path d="M10.5 5.5v-2a1 1 0 0 0-1-1h-6a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2"/>',
  up:'<path d="M4 10l4-4 4 4"/>', down:'<path d="M4 6l4 4 4-4"/>',
  image:'<rect x="2.5" y="3.5" width="11" height="9" rx="1.5"/><circle cx="6" cy="7" r="1.2"/><path d="M3.5 11.5l3-3 2.5 2.5 2-2 2.5 2.5"/>',
  doc:'<path d="M4 2.5h5l3 3v8H4z"/><path d="M9 2.5v3h3"/>',
  code:'<path d="M5.5 4.5L2 8l3.5 3.5M10.5 4.5L14 8l-3.5 3.5"/>',
  dots:'<circle cx="3.5" cy="8" r="1.2" fill="currentColor" stroke="none"/><circle cx="8" cy="8" r="1.2" fill="currentColor" stroke="none"/><circle cx="12.5" cy="8" r="1.2" fill="currentColor" stroke="none"/>',
  cloud:'<path d="M4.5 12.5a3 3 0 0 1-.4-5.97A4 4 0 0 1 11.9 7.6a2.6 2.6 0 0 1-.6 4.9z"/>',
  x:'<path d="M4 4l8 8M12 4l-8 8"/>', check:'<path d="M3 8.5l3.2 3L13 4.5"/>',
  eye:'<path d="M1.5 8s2.4-4.2 6.5-4.2S14.5 8 14.5 8 12.1 12.2 8 12.2 1.5 8 1.5 8z"/><circle cx="8" cy="8" r="1.8"/>',
  menu:'<path d="M3 4.5h10M3 8h10M3 11.5h10"/>',
  pencil:'<path d="M3 13l.8-3 7-7 2.2 2.2-7 7z"/>',
  dup:'<rect x="5.5" y="5.5" width="8" height="8" rx="1.5"/><rect x="2.5" y="2.5" width="8" height="8" rx="1.5"/>',
  download:'<path d="M8 2.5v7M5 7l3 3 3-3M3 12.5h10"/>', upload:'<path d="M8 10v-7M5 5.5L8 2.5l3 3M3 12.5h10"/>',
  refresh:'<path d="M13 8a5 5 0 1 1-1.5-3.5M13 2.5V5h-2.5"/>',
  file:'<path d="M4 2.5h5l3 3v8H4z"/>',
  moon:'<path d="M13.5 9.7A5.8 5.8 0 0 1 6.3 2.5a5.8 5.8 0 1 0 7.2 7.2z"/>',
  sun:'<circle cx="8" cy="8" r="3"/><path d="M8 1.2v1.7M8 13.1v1.7M1.2 8h1.7M13.1 8h1.7M3.2 3.2l1.2 1.2M11.6 11.6l1.2 1.2M12.8 3.2l-1.2 1.2M4.4 11.6l-1.2 1.2"/>',
  collapse:'<path d="M6 4.5L2.5 8 6 11.5M11 4.5L7.5 8 11 11.5"/>',
  expand:'<path d="M5 4.5L8.5 8 5 11.5M10 4.5L13.5 8 10 11.5"/>',
  search:'<circle cx="7" cy="7" r="4.2"/><path d="M10.2 10.2L13.5 13.5"/>',
  replace:'<path d="M2.5 5.5h8l-2-2M13.5 10.5h-8l2 2"/><path d="M2.5 10.5h4M9.5 5.5h4"/>',
  command:'<path d="M5.5 3.5a1.8 1.8 0 1 0 0 3.6h5a1.8 1.8 0 1 0 0-3.6v9a1.8 1.8 0 1 0 0-3.6h-5a1.8 1.8 0 1 0 0 3.6z"/>',
  focus:'<path d="M2.5 5.5v-3h3M13.5 5.5v-3h-3M2.5 10.5v3h3M13.5 10.5v3h-3"/>',
  unfocus:'<path d="M5.5 2.5v3h-3M10.5 2.5v3h3M5.5 13.5v-3h-3M10.5 13.5v-3h3"/>',
  history:'<path d="M8 4.5V8l2.4 1.6"/><path d="M3.2 8a4.8 4.8 0 1 0 1.5-3.5M3 2.5V5h2.5"/>',
  undo:'<path d="M5.5 4.5L3 7l2.5 2.5"/><path d="M3 7h6.5a3 3 0 0 1 0 6H6"/>',
  redo:'<path d="M10.5 4.5L13 7l-2.5 2.5"/><path d="M13 7H6.5a3 3 0 0 0 0 6H10"/>',
  md:'<path d="M2 3.5h12v9H2z"/><path d="M4.5 10V6l1.8 2.2L8.1 6v4M11 6v3M9.6 8.2L11 9.8l1.4-1.6"/>',
  txt:'<path d="M3.5 2.5h9v11h-9z"/><path d="M5.5 5.5h5M5.5 8h5M5.5 10.5h3"/>',
  sticker:'<circle cx="8" cy="8" r="5.8"/><path d="M8 5.6v.01M10.6 5.6v.01"/><path d="M5.6 9.4a3 3 0 0 0 4.8 0"/>',
  keyboard:'<rect x="1.5" y="4" width="13" height="8" rx="1.6"/><path d="M4 6.5v.01M6.5 6.5v.01M9 6.5v.01M11.5 6.5v.01M5 9.2h6"/>',
  monitor:'<rect x="2" y="3" width="12" height="8" rx="1.5"/><path d="M6 13.5h4M8 11v2.5"/>',
  drag:'<circle cx="6" cy="3.5" r="1.1" fill="currentColor" stroke="none"/><circle cx="10" cy="3.5" r="1.1" fill="currentColor" stroke="none"/><circle cx="6" cy="8" r="1.1" fill="currentColor" stroke="none"/><circle cx="10" cy="8" r="1.1" fill="currentColor" stroke="none"/><circle cx="6" cy="12.5" r="1.1" fill="currentColor" stroke="none"/><circle cx="10" cy="12.5" r="1.1" fill="currentColor" stroke="none"/>',
  caret:'<path d="M4 6l4 4 4-4"/>',
  bold:'<path d="M5 2.5h4a2.7 2.7 0 0 1 0 5.5H5zM5 8h4.6a2.9 2.9 0 0 1 0 5.5H5z"/>',
  italic:'<path d="M6.5 13.5h5M4.5 2.5h5M9.8 2.5l-3.6 11"/>',
  diag:'<path d="M8 2.5v6M8 11.2v.01"/><circle cx="8" cy="8" r="6"/>',
  layers:'<path d="M8 2.2L14 5.5 8 8.8 2 5.5z"/><path d="M2.6 8.2L8 11.2l5.4-3M2.6 10.9L8 13.9l5.4-3"/>',
  sparkle:'<path d="M8 2.2l1.3 3.4 3.4 1.3-3.4 1.3L8 11.6 6.7 8.2 3.3 6.9l3.4-1.3z"/><path d="M12.4 10.6l.6 1.5 1.5.6-1.5.6-.6 1.5-.6-1.5-1.5-.6 1.5-.6z"/>'
};
export const icon = n => '<svg class="ic" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + ICONS[n] + "</svg>";

export function fmtBytes(n) {
  if (n >= 1048576) return (n / 1048576).toFixed(1).replace(".", ",") + " MB";
  if (n >= 1024) return Math.round(n / 1024) + " KB";
  return n + " B";
}
