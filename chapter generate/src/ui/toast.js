import { $, escHtml, icon } from "../lib/util.js";

export function toast(msg, kind, ms) {
  const box = $("#toasts");
  const el = document.createElement("div");
  el.className = "toast" + (kind === "err" ? " err" : kind === "ok" ? " ok" : "");
  if (kind === "ok") el.innerHTML = '<span class="tk">✓</span> ' + escHtml(msg);
  else el.textContent = msg;
  box.appendChild(el);
  while (box.children.length > 3) box.firstChild.remove();
  setTimeout(() => { el.classList.add("out"); setTimeout(() => el.remove(), 300); }, ms || 3200);
}

export async function copyText(text, btn) {
  let ok = false;
  try { await navigator.clipboard.writeText(text); ok = true; }
  catch (e) {
    try {
      const ta = document.createElement("textarea");
      ta.value = text; ta.style.cssText = "position:fixed;opacity:0";
      document.body.appendChild(ta); ta.select();
      ok = document.execCommand("copy");
      ta.remove();
    } catch (e2) {}
  }
  if (btn) {
    const old = btn.innerHTML;
    btn.innerHTML = icon("check") + ' <span class="blabel">Đã copy</span>';
    setTimeout(() => { btn.innerHTML = old; }, 1600);
  }
  toast(ok ? "Đã sao chép vào clipboard." : "Không copy được — hãy chọn thủ công.", ok ? "ok" : "err");
}
