
/* Phiên bản lấy từ package.json qua Vite define — hiện ở menu ⋯ và console. */
export const CZ_VERSION = "v" + (typeof __APP_VERSION__ !== "undefined" ? __APP_VERSION__ : "0.0.0-dev");

/* ---------- storage an toàn (khung xem trước có thể chặn localStorage) ---------- */
export const store = (() => {
  try {
    const t = "__chuseoz_test__";
    localStorage.setItem(t, "1");
    localStorage.removeItem(t);
    return localStorage;
  } catch (e) {
    const mem = Object.create(null);
    return {
      __memory: true,
      getItem: k => (k in mem ? mem[k] : null),
      setItem: (k, v) => { mem[k] = String(v); },
      removeItem: k => { delete mem[k]; }
    };
  }
})();

export const KEY_PROJECTS = "chuseoz_saved_story_projects_v1";
export const KEY_ACTIVE   = "chuseoz_active_story_project_v1";
export const KEY_LEGACY   = "chuseoz_saved_story_blocks_v2";
export const KEY_CLOUD_URL = "chuseoz_cloud_backup_url_v1";
export const KEY_CLOUD_KEY = "chuseoz_cloud_sync_key_v1";
export const KEY_CLOUD_AT  = "chuseoz_cloud_pushed_at_v1";
export const KEY_PREVIEW   = "chuseoz_preview_open_v1";
export const KEY_THEME     = "chuseoz_theme_v1";
export const KEY_RAIL_COLLAPSED = "chuseoz_rail_collapsed_v1";
export const DEFAULT_LEFT  = "Wine, Nong Lal, PhoomJAI, NoomNim, Cheese";
export const DEFAULT_RIGHT = "Lullaby, Lal, Thitinan";

/* ---- đo dung lượng đã dùng trong trình duyệt ---- */
export function storageUsedBytes() {
  try {
    if (store.__memory) return -1;
    let total = 0;
    for (let i = 0; i < store.length; i++) {
      const k = store.key(i);
      if (!k || k.indexOf("chuseoz_") !== 0) continue;
      total += (k.length + (store.getItem(k) || "").length) * 2;
    }
    return total;
  } catch (e) { return -1; }
}
