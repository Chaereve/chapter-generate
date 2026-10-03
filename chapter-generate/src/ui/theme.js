import { store, KEY_THEME } from "../lib/store.js";

/* ============================================================
   GIAO DIỆN: 3 chế độ — sáng / tối / theo hệ thống
   (bản cũ chỉ có bật-tắt, người dùng theo hệ thống tối không giữ được lựa chọn)
   ============================================================ */

export const THEME_PREFS = ["auto", "light", "dark"];
export const THEME_LABELS = { auto: "Theo hệ thống", light: "Sáng", dark: "Tối" };

let currentPref = "auto";
let media = null;
let onChange = null;

function systemDark() {
  try { return !!(window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches); }
  catch (e) { return false; }
}

export function readThemePref() {
  const v = store.getItem(KEY_THEME);
  return THEME_PREFS.includes(v) ? v : "auto";
}

function apply() {
  const dark = currentPref === "dark" ? true : currentPref === "light" ? false : systemDark();
  const name = dark ? "dark" : "light";
  document.documentElement.dataset.theme = name;
  document.documentElement.dataset.themePref = currentPref;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", dark ? "#161311" : "#f7f5f1");
  if (onChange) onChange(currentPref, name);
  return { pref: currentPref, resolved: name };
}

export function getThemePref() {
  return currentPref;
}

export function setThemePref(pref) {
  currentPref = THEME_PREFS.includes(pref) ? pref : "auto";
  try { store.setItem(KEY_THEME, currentPref); } catch (e) {}
  return apply();
}

/** Chuyển sang chế độ kế tiếp: auto → light → dark → auto */
export function cycleTheme() {
  const i = THEME_PREFS.indexOf(currentPref);
  return setThemePref(THEME_PREFS[(i + 1) % THEME_PREFS.length]);
}

/** Khởi tạo; gọi `cb(pref, resolvedName)` mỗi khi theme đổi. */
export function initTheme(cb) {
  onChange = cb || null;
  currentPref = readThemePref();
  try { media = window.matchMedia("(prefers-color-scheme: dark)"); } catch (e) { media = null; }
  if (media) {
    const listener = () => { if (currentPref === "auto") apply(); };
    if (media.addEventListener) media.addEventListener("change", listener);
    else if (media.addListener) media.addListener(listener);
  }
  return apply();
}
