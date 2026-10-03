import { $, debounce, esc, escHtml, fmtBytes, fmtCount, fmtTime, icon, uid } from "./lib/util.js";
import { copyText, toast } from "./ui/toast.js";
import { editorToText, escInline, parseSmartLine, pasteHtmlToClean, sideOf, stripInlineTags, textToEditorHtml } from "./lib/parser.js";
import { addBlockImage, compressImageSrc, imageSrcOf, migrateBlockImages } from "./lib/images.js";
import { CZ_VERSION, DEFAULT_LEFT, DEFAULT_RIGHT, KEY_ACTIVE, KEY_CLOUD_AT, KEY_CLOUD_KEY, KEY_CLOUD_URL, KEY_LEGACY, KEY_PREVIEW, KEY_PROJECTS, KEY_RAIL_COLLAPSED, storageUsedBytes, store } from "./lib/store.js";
import { buildPart1, buildPart2 } from "./lib/blogHtml.js";
import { buildDocx } from "./lib/docx.js";
import { openModal, closeModal, confirmDialog, choiceDialog } from "./ui/modal.js";
import { initTheme, cycleTheme, getThemePref, THEME_LABELS } from "./ui/theme.js";
import { createHistory } from "./lib/history.js";
import { findAcross, replaceIn, replaceAt, textStats } from "./lib/search.js";
import { blocksToMarkdown, blocksToPlainText, safeFileName } from "./lib/markdown.js";
import { installGlobalHandlers, logInfo, logWarn, logError, buildReport, getEntries } from "./lib/diagnostics.js";
import { idbAvailable, putSnapshot, getSnapshot, snapshotKeys, deleteSnapshot } from "./lib/idb.js";
import { toggleInline, insertTextAtCaret, insertHtmlAtCaret, textNodesOf } from "./lib/richText.js";

function updateStorageMeter() {
  const el = document.getElementById("storeMeter");
  if (!el) return;
  const used = storageUsedBytes();
  if (used < 0) { el.style.display = "none"; return; }
  el.style.display = "flex";
  el.classList.remove("warn", "full");
  if (used > 4600000) el.classList.add("full");
  else if (used > 3600000) el.classList.add("warn");
  el.title = "Dung lượng truyện + ảnh đang lưu trong trình duyệt (giới hạn khoảng 5MB). Ảnh được tự nén ngầm khi gần đầy — không cần bấm gì cả.";
  el.innerHTML = icon("image") + " <span>" + fmtBytes(used) + " / ~5MB</span>";
}

/* ===== TỰ NÉN ẢNH — chạy ngầm, không hỏi, không hộp thoại ===== */
const AUTO_SHRINK_AT = 3300000;   // vượt mức này là tự nén ngầm (~5MB là trần)
const SHRINK_LEVELS = [           // nén chưa ăn thua → lần sau nén mạnh tay hơn
  { px: 1200, q: 0.78 },
  { px: 1000, q: 0.70 },
  { px: 860, q: 0.62 },
  { px: 720, q: 0.55 }
].map(l => ({ px: l.px, q: l.q, tag: l.px + "@" + l.q }));
const CZ_KEEP = "keep";           // ảnh nhỏ sẵn / không nén được — giữ nguyên, đừng thử lại
/* images[id].cz = mức đã nén: -1 chưa nén, 0..N mức đó, 99 giữ nguyên.
   Có cờ này để mở trang khỏi nén lại (nén lại chỉ làm ảnh mờ thêm). */
function czStrength(tag) {
  if (!tag) return -1;
  if (tag === CZ_KEEP) return 99;
  return SHRINK_LEVELS.findIndex(l => l.tag === tag);
}
let shrinking = false;
let shrinkLevel = 0;
let autoTimer = 0;
let autoTries = 0;                // số lần nén liên tiếp mà không giảm được bao nhiêu
let autoGaveUp = false;           // ngừng tự nén tới khi bộ nhớ nhẹ lại / người dùng tự bấm
let fullWarnAt = 0;

const shrinkCfg = () => SHRINK_LEVELS[Math.min(shrinkLevel, SHRINK_LEVELS.length - 1)];

function setSaveText(text, ok) {
  const box = $("#saveStatus");
  if (!box) return;
  box.classList.toggle("saved", !!ok);
  const t = $("#saveStatusText");
  if (t) t.textContent = text;
}

/* báo "vẫn đầy" bằng toast — tối đa 1 lần / 10 phút, không hộp thoại chắn màn hình */
function warnStillFull(msg) {
  // Chạy nền im lặng; không giảm thêm được thì chỉ cập nhật trạng thái lưu.
  const now = Date.now();
  if (now - fullWarnAt < 600000) return;
  fullWarnAt = now;
  setSaveText("Bộ nhớ đầy — không thể nén thêm", false);
}

/* gom mọi ảnh base64 đang lưu trong các chương */
function collectStoredImages() {
  const jobs = [];
  let total = 0;
  state.projects.forEach(pr => pr.blocks.forEach(b => {
    const imgs = b.images || {};
    Object.keys(imgs).forEach(id => {
      const obj = imgs[id];
      const src = obj && obj.src;
      if (src && /^data:image\//i.test(src)) {
        total += src.length;
        jobs.push({ imgs, id, obj, src });
      }
    });
  }));
  return { jobs, total };
}

/* lên lịch nén ngầm — gọi bao nhiêu lần cũng chỉ chạy một đợt */
function autoShrinkSoon(delay) {
  if (store.__memory || shrinking || autoGaveUp || autoTimer) return;
  autoTimer = setTimeout(() => {
    autoTimer = 0;
    if (autoGaveUp || shrinking) return;
    shrinkAllImages({ auto: true });
  }, delay == null ? 600 : delay);
}

/* sau mỗi lần lưu: gần đầy thì tự nén; chỉ "tha" cho cờ dừng khi đã lưu được */
function maybeAutoShrink(savedOk) {
  if (store.__memory) return;
  const used = storageUsedBytes();
  if (used < 0) return;
  if (used < AUTO_SHRINK_AT) {
    if (savedOk) { autoGaveUp = false; autoTries = 0; shrinkLevel = 0; }
    return;
  }
  autoShrinkSoon(400);
}

/* Nén toàn bộ ảnh. opts.auto = chạy ngầm im lặng; opts.force = nén lại cả ảnh đã nén. */
async function shrinkAllImages(opts) {
  opts = opts || {};
  const auto = !!opts.auto;
  if (shrinking) return false;
  const found = collectStoredImages();
  const totalBefore = found.total;
  /* chỉ đụng vào ảnh CHƯA nén hoặc nén yếu hơn mức đang cần */
  const jobs = opts.force ? found.jobs.slice() : found.jobs.filter(j => czStrength(j.obj && j.obj.cz) < shrinkLevel);
  if (!jobs.length) {
    const used = storageUsedBytes();
    if (auto && used >= 0 && used <= AUTO_SHRINK_AT) return true; // bộ nhớ đã ổn — im lặng, không có gì phải làm
    if (auto) {
      /* mọi ảnh đều đã nén ở mức hiện tại mà vẫn đầy → nhảy thẳng sang mức mạnh hơn */
      const strengths = found.jobs.map(j => czStrength(j.obj && j.obj.cz)).filter(s => s >= 0 && s < 90);
      const next = strengths.length ? Math.max.apply(null, strengths) + 1 : -1;
      if (next > shrinkLevel && next < SHRINK_LEVELS.length) {
        shrinkLevel = next;
        autoShrinkSoon(400);
        return false;
      }
      autoGaveUp = true;
      warnStillFull("Bộ nhớ vẫn đầy mà không nén thêm được nữa — hãy tải backup (.json) rồi xóa bớt chương hoặc truyện cũ.");
      return false;
    }
    toast("Không có ảnh nào lưu trong máy để nén. Nếu vẫn đầy bộ nhớ, thử tải backup rồi nạp lại, hoặc bớt chương.", "err", 6000);
    return false;
  }
  shrinking = true;
  const cfg = shrinkCfg();
  setSaveText((auto ? "Đang tự nén " : "Đang nén ") + jobs.length + " ảnh…", false);
  if (!auto) toast("Đang nén " + jobs.length + " ảnh, khoảng 1 phút…");
  let count = 0, after = 0;
  for (const j of jobs) {
    let done = false;
    try {
      const out = await compressImageSrc(j.src, cfg.px, cfg.q);
      /* ảnh nhỏ sẵn / không nén được → giữ nguyên và ĐÁNH DẤU để lần sau khỏi thử lại */
      if (!out || out === j.src) { j.obj.cz = CZ_KEEP; }
      else {
        j.obj.cz = cfg.tag;
        if (out.length < j.src.length) { j.obj.src = out; count++; done = true; }
      }
    } catch (e) { /* lỗi canvas — để nguyên, lần sau thử lại */ }
    after += done ? j.obj.src.length : j.src.length;
    await new Promise(r => setTimeout(r, 0)); // nhường UI giữa hai ảnh để không đơ trang
  }
  shrinking = false;
  const savedOk = writeProjects(state.projects);
  updateStorageMeter();
  if (savedOk) queueCloudPush();
  renderPreview();
  const gained = totalBefore - after;

  if (!auto) {
    if (savedOk) {
      setSaveText("Đã nén ảnh · " + fmtTime(Date.now()), true);
      toast("Đã nén " + count + "/" + jobs.length + " ảnh: " + fmtBytes(totalBefore) + " → " + fmtBytes(after) + ". Lưu bình thường trở lại.", "ok", 6000);
    }
    return savedOk;
  }

  /* ---- đường chạy ngầm: không toast, không hộp thoại, chỉ dòng trạng thái ---- */
  if (gained > 20000) {
    autoTries = 0;
    if (savedOk) setSaveText("Đã tự nén ảnh · " + fmtTime(Date.now()), true);
  } else {
    autoTries++;
    shrinkLevel = Math.min(shrinkLevel + 1, SHRINK_LEVELS.length - 1); // lần sau nén mạnh hơn
  }
  if (!savedOk || storageUsedBytes() > AUTO_SHRINK_AT) {
    if (autoTries >= 2) {
      autoGaveUp = true;
      warnStillFull("Đã nén ảnh hết cỡ mà bộ nhớ vẫn đầy — hãy tải backup (.json) rồi xóa bớt chương hoặc truyện cũ.");
      if (!savedOk) setSaveText("Chưa lưu được — bộ nhớ đầy", false);
    } else {
      autoShrinkSoon(500); // nén tiếp ở mức mạnh hơn
    }
  }
  return savedOk;
}

/* ===== DỮ LIỆU — projects / blocks (giữ nguyên key cũ) ===== */
function makeBlock(prev) {
  let n = 1;
  if (prev && prev.title) {
    const m = prev.title.match(/\d+/);
    if (m) n = parseInt(m[0], 10) + 1;
  }
  return {
    id: uid("blk_"),
    title: "Chương " + n,
    leftChars: prev ? prev.leftChars : DEFAULT_LEFT,
    rightChars: prev ? prev.rightChars : DEFAULT_RIGHT,
    content: "",
    images: {}
  };
}
function normalizeProject(p) {
  return {
    id: p.id || uid("story_"),
    title: typeof p.title === "string" ? p.title : "",
    updatedAt: p.updatedAt || new Date().toISOString(),
    blocks: (Array.isArray(p.blocks) ? p.blocks : []).filter(b => b && typeof b === "object").map(b => migrateBlockImages({
      id: b.id || uid("blk_"),
      title: b.title || "Chương...",
      leftChars: b.leftChars || "",
      rightChars: b.rightChars || "",
      content: b.content || "",
      images: b.images
    }))
  };
}
function readProjects() {
  try {
    const raw = store.getItem(KEY_PROJECTS);
    if (raw) {
      const parsed = JSON.parse(raw);
      const list = Array.isArray(parsed) ? parsed : parsed && Array.isArray(parsed.projects) ? parsed.projects : [];
      return list.filter(p => p && p.id && Array.isArray(p.blocks)).map(normalizeProject);
    }
    // migration từ bản cũ (blocks rời)
    const legacy = store.getItem(KEY_LEGACY);
    if (legacy) {
      const arr = JSON.parse(legacy);
      if (Array.isArray(arr) && arr.length) return [normalizeProject({ blocks: arr })];
    }
  } catch (e) {}
  return [];
}
function writeProjects(list) {
  try {
    store.setItem(KEY_PROJECTS, JSON.stringify({ version: 1, projects: list }));
    return true;
  } catch (e) {
    if (store.__memory) {
      setSaveText("Không lưu được — bị chặn lưu trữ", false);
    } else if (autoGaveUp) {
      setSaveText("Chưa lưu được — bộ nhớ đầy", false);
    } else {
      /* bộ nhớ đầy → tự nén ảnh ngầm rồi tự lưu lại, không hỏi người dùng */
      setSaveText("Bộ nhớ đầy — đang tự nén ảnh…", false);
      autoShrinkSoon(300);
    }
    return false;
  }
}

const state = {
  projects: [],
  activeId: "",
  focusedBlock: "",
  previewOpen: false,
  collapsed: new Set(),   // id chương đang thu gọn
  dragBlock: "",          // id chương đang được kéo
  railTab: "stories",     // "stories" | "chapters"
  focusMode: false
};

/* ---------- lịch sử hoàn tác cấp ứng dụng ---------- */
const history = createHistory({ limit: 100 });
const scheduleHistory = debounce(() => {
  const p = activeProject();
  if (p) history.push(p.blocks);
}, 900);
function activeProject() {
  return state.projects.find(p => p.id === state.activeId) || null;
}
function touchProject(p) {
  p.updatedAt = new Date().toISOString();
}
function gcUnusedImages() {
  state.projects.forEach(pr => pr.blocks.forEach(b => {
    if (!b.images || typeof b.images !== "object") return;
    const content = String(b.content || "");
    Object.keys(b.images).forEach(id => {
      if (content.indexOf("[[IMG:" + id + "]]") < 0) delete b.images[id];
    });
  }));
}
const saveProjects = debounce(() => {
  gcUnusedImages();
  const saved = writeProjects(state.projects);
  if (saved) setSaveText("Đã tự lưu · " + fmtTime(Date.now()), true);
  updateStorageMeter();
  maybeAutoShrink(saved); // gần đầy bộ nhớ thì tự nén ngầm
  queueCloudPush();
}, 400);

/* Lưu ngay (thao tác cấu trúc) — gồm gc ảnh, cập nhật meter và đồng bộ cloud */
function persistNow() {
  gcUnusedImages();
  const ok = writeProjects(state.projects);
  if (ok) setSaveText("Đã tự lưu · " + fmtTime(Date.now()), true);
  updateStorageMeter();
  maybeAutoShrink(ok);
  queueCloudPush();
  return ok;
}

/* ===== DRIVE — cùng giao thức Apps Script với bản gốc ===== */
function cloudCfg() {
  return {
    url: (store.getItem(KEY_CLOUD_URL) || "").trim(),
    key: (store.getItem(KEY_CLOUD_KEY) || "").trim()
  };
}
function normalizeCloudUrl(v) {
  const url = (v || "").trim().replace(/\/+$/, "");
  return url && /\/macros\/s\/[^/]+$/.test(url) ? url + "/exec" : url;
}
function unwrapJsonp(raw) {
  const open = raw.indexOf("("), close = raw.lastIndexOf(")");
  try {
    return open >= 0 && close > open ? JSON.parse(raw.slice(open + 1, close)) : JSON.parse(raw);
  } catch (e) { return null; }
}
let cloudTimer = null, cloudState = "idle";
function setCloudState(st, text) {
  cloudState = st;
  const box = $("#cloudStatus");
  box.style.display = "flex";
  box.classList.remove("saving", "saved", "error");
  if (st && st !== "idle") box.classList.add(st);
  $("#cloudStatusText").textContent = text;
}
function queueCloudPush() {
  const { url, key } = cloudCfg();
  if (!normalizeCloudUrl(url) || !key) return;
  clearTimeout(cloudTimer);
  cloudTimer = setTimeout(() => cloudPush(), 1800);
}
/* Đọc trạng thái bản backup trên Drive (dùng chung cho kiểm tra và vòng xác nhận). */
async function remoteStatus(U, key) {
  const sep = U.includes("?") ? "&" : "?";
  const txt = await fetch(U + sep + "action=status&key=" + encodeURIComponent(key) + "&t=" + Date.now(), { cache: "no-store" }).then(r => r.text());
  return unwrapJsonp(txt);
}

let conflictAsked = false;

/** Drive giữ bản mới hơn lần đẩy cuối, mà máy này cũng đã sửa sau đó.
 *  @returns {Promise<boolean>} true = ghi đè, false = dừng */
async function checkCloudConflict(U, key) {
  if (conflictAsked) return true;
  const lastPush = Date.parse(store.getItem(KEY_CLOUD_AT) || "") || 0;
  if (!lastPush) return true; // chưa từng đẩy từ máy này → không có mốc để so
  let remoteAt = 0;
  try {
    const st = await remoteStatus(U, key);
    remoteAt = Date.parse((st && st.updatedAt) || "") || 0;
  } catch (e) { return true; } // không đọc được thì cứ đẩy, đừng chặn người dùng
  const localAt = state.projects.reduce((m, p) => Math.max(m, Date.parse(p.updatedAt || "") || 0), 0);
  if (!(remoteAt > lastPush && localAt > lastPush)) return true;

  conflictAsked = true; // chỉ hỏi một lần mỗi phiên
  logWarn("drive", "xung đột: Drive " + new Date(remoteAt).toISOString() + " vs máy này " + new Date(localAt).toISOString());
  const choice = await choiceDialog({
    title: "Drive có bản mới hơn",
    body: "Bản trên Google Drive được lưu lúc <b>" + escHtml(new Date(remoteAt).toLocaleString("vi-VN")) +
      "</b>, mới hơn lần đồng bộ cuối của máy này (" + escHtml(new Date(lastPush).toLocaleString("vi-VN")) +
      ").<br><br>Có thể bạn đã sửa truyện ở một máy/tab khác.",
    options: [
      { label: "Vẫn ghi đè bản trên Drive", cls: "btn btn-primary", value: "push" },
      { label: "Dừng lại để tôi kiểm tra", cls: "btn", value: "stop" },
    ],
    cancelLabel: "Dừng lại",
    width: "560px",
  });
  if (choice === "push") return true;
  setCloudState("error", "Tạm dừng đồng bộ — Drive có bản mới hơn");
  toast("Đã tạm dừng đồng bộ. Vào menu ⋯ → “Khôi phục từ Drive…” để xem bản trên đó.", "err");
  return false;
}

async function cloudPush(quiet) {
  if (cloudState === "saving") return false; // đang đẩy rồi — đừng chồng lượt khác lên
  const { url, key } = cloudCfg();
  const U = normalizeCloudUrl(url);
  if (!U || !key) { if (!quiet) toast("Cần Link Apps Script + Mã đồng bộ trước đã.", "err"); return false; }
  const list = state.projects;
  if (!list.length) { if (!quiet) toast("Danh sách truyện đang trống.", "err"); return false; }

  if (!(await checkCloudConflict(U, key))) return false;

  const now = new Date().toISOString();
  setCloudState("saving", "Đang gửi lên Drive…");
  try {
    await fetch(U, {
      method: "POST",
      mode: "no-cors",
      body: new URLSearchParams({ action: "save", key, payload: JSON.stringify({ version: 2, exportedAt: now, updatedAt: now, activeProjectId: state.activeId, projects: list }) })
    });
  } catch (e) {
    logError("drive", "không gửi được", e && e.message);
    setCloudState("error", "Không gửi được lên Drive");
    if (!quiet) toast("Không gửi được lên Drive: trình duyệt chặn kết nối. Hãy mở file bằng tab trình duyệt thường.", "err");
    return false;
  }
  for (let i = 0; i < 3; i++) {
    await new Promise(d => setTimeout(d, 500 * (i + 1)));
    try {
      const data = await remoteStatus(U, key);
      if (data && data.ok === false) {
        setCloudState("error", "Script báo lỗi");
        logError("drive", "script báo lỗi", data.error);
        if (!quiet) toast("Script báo lỗi: " + (data.error || "không rõ"), "err");
        return false;
      }
      if (data && (Date.parse(data.updatedAt || "") || 0) >= Date.parse(now)) {
        store.setItem(KEY_CLOUD_AT, now);
        setCloudState("saved", "Drive đã lưu · " + fmtTime(Date.now()));
        if (!quiet) toast("Đã lưu lên Google Drive.", "ok");
        return true;
      }
    } catch (e) { break; }
  }
  setCloudState("saved", "Đã gửi · Drive chưa xác nhận");
  if (!quiet) toast("Đã gửi nhưng Drive chưa xác nhận — kiểm tra script đã Deploy phiên bản mới chưa.", "err");
  return true;
}

function ingestBackupData(data, mode) {
  let list = null, activeId = "";
  if (Array.isArray(data)) list = data;
  else if (data && Array.isArray(data.projects)) { list = data.projects; activeId = data.activeProjectId || ""; }
  if (!list) return { added: 0 };
  const clean = list.filter(p => p && p.id && Array.isArray(p.blocks)).map(normalizeProject);
  if (!clean.length) return { added: 0 };
  if (mode === "replace") {
    state.projects = clean;
    state.activeId = clean[0].id;
  } else {
    const map = new Map(state.projects.map(p => [p.id, p]));
    clean.forEach(p => map.set(p.id, p)); // file thắng khi trùng ID
    state.projects = Array.from(map.values());
    if (activeId && state.projects.some(p => p.id === activeId)) state.activeId = activeId;
  }
  state.focusedBlock = "";
  writeProjects(state.projects);
  renderAll();
  return { added: clean.length };
}

async function driveRestoreModal() {
  const { url, key } = cloudCfg();
  const U = normalizeCloudUrl(url);
  if (!U || !key) { openDriveModal(); toast("Nhập Link Apps Script + Mã đồng bộ trước đã.", "err"); return; }
  const scrim = openModal('<h2>Bản backup trên Google Drive</h2>', '<div id="drvList" style="color:var(--ink2);font-size:13px">Đang đọc danh sách file…</div>',
    '<span style="font-size:12px;color:var(--ink3)">Gộp = nạp thêm, giữ truyện hiện có · Thay thế = chỉ giữ file này · Tải = lưu về máy</span>',
    [{ label: "Đóng", cls: "btn" }]);
  const ask = async qs => {
    const raw = await fetch(U + (U.includes("?") ? "&" : "?") + qs + "&t=" + Date.now(), { cache: "no-store" }).then(r => r.text());
    const data = unwrapJsonp(raw);
    if (!data) throw new Error("script trả về nội dung không hiểu được (Code.gs cũ?)");
    return data;
  };
  try {
    const data = await ask("action=list&key=" + encodeURIComponent(key));
    if (!data || !data.ok) throw new Error((data && data.error) || "Script không trả về danh sách");
    const rows = data.files || [];
    const box = scrim.querySelector("#drvList");
    if (!rows.length) { box.innerHTML = '<div style="color:var(--ink3)">Chưa có file backup nào trên Drive.</div>'; return; }
    box.innerHTML = '<div style="font-size:12px;color:var(--ink3);margin-bottom:10px">Thư mục <b>' + escHtml(data.folderName || "") + "</b> · " + rows.length + " file</div>" +
      rows.map((f, i) =>
        '<div class="dfile"><div class="df-body"><div class="df-name">' + escHtml(f.storyTitle || f.name) +
        (f.kind === "master" ? ' <span style="font-size:11px;color:#2563eb">· tất cả truyện</span>' : "") +
        '</div><div class="df-meta">' + escHtml(f.name) + " · " + escHtml(String(f.sizeKB || "?")) + " KB" + (f.stories ? " · " + f.stories + " truyện" : "") +
        (f.modifiedText ? " · sửa " + escHtml(f.modifiedText) : "") +
        '</div></div><div class="df-actions">' +
        '<button class="btn" data-i="' + i + '" data-act="merge">Gộp</button>' +
        '<button class="btn" data-i="' + i + '" data-act="replace">Thay thế</button>' +
        '<button class="btn" data-i="' + i + '" data-act="download">' + icon("download") + '</button></div></div>').join("");
    box.addEventListener("click", async ev => {
      const btn = ev.target.closest("button[data-act]");
      if (!btn) return;
      const f = rows[+btn.dataset.i];
      btn.disabled = true;
      try {
        const fd = await ask("action=file&key=" + encodeURIComponent(key) + "&name=" + encodeURIComponent(f.name));
        if (!fd || !fd.ok) throw new Error((fd && fd.error) || "không đọc được file");
        if (btn.dataset.act === "download") {
          const a = document.createElement("a");
          a.href = URL.createObjectURL(new Blob([fd.text], { type: "application/json" }));
          a.download = f.name;
          a.click();
          setTimeout(() => URL.revokeObjectURL(a.href), 4000);
          toast("Đã tải " + f.name + " về máy.", "ok");
        } else {
          const r = ingestBackupData(JSON.parse(fd.text), btn.dataset.act);
          toast("Đã nạp " + r.added + " truyện từ file (" + (btn.dataset.act === "merge" ? "gộp" : "thay thế") + ").", "ok");
          closeModal(scrim);
        }
      } catch (err) {
        toast(err.message || String(err), "err");
        btn.disabled = false;
      }
    });
  } catch (err) {
    scrim.querySelector("#drvList").textContent = "Lỗi: " + (err.message || err);
  }
}

/* ===== RENDER — rail / chapters / preview ===== */
function applyStoryFilter(q) {
  const needle = String(q || "").trim().toLowerCase();
  document.querySelectorAll("#storyList .story-item").forEach(el => {
    el.style.display = !needle || el.textContent.toLowerCase().includes(needle) ? "" : "none";
  });
}

function renderRail() {
  const list = $("#storyList");
  list.innerHTML = "";
  state.projects.forEach(p => {
    const chars = p.blocks.reduce((n, b) => n + (b.content || "").length, 0);
    const letter = ((p.title || "").trim().charAt(0) || "•").toUpperCase();
    const el = document.createElement("div");
    const active = p.id === state.activeId;
    el.className = "story-item" + (active ? " active" : "");
    el.setAttribute("role", "button");
    el.setAttribute("tabindex", "0");
    el.setAttribute("aria-current", active ? "true" : "false");
    const label = (p.title || "Truyện chưa đặt tên") + " — " + p.blocks.length + " chương · " + fmtCount(chars) + " ký tự";
    el.setAttribute("aria-label", label);
    el.title = label;
    el.innerHTML = '<span class="si-ava" aria-hidden="true">' + escHtml(letter) + "</span>" +
      '<div class="si-body"><div class="si-title">' + escHtml(p.title || "Truyện chưa đặt tên") +
      '</div><div class="si-meta">' + p.blocks.length + " chương · " + fmtCount(chars) + " ký tự</div></div>" +
      '<div class="si-actions"><button class="iconbtn" data-a="dup" title="Nhân bản truyện" aria-label="Nhân bản truyện ' + esc(p.title || "") + '">' + icon("dup") +
      '</button><button class="iconbtn" data-a="del" title="Xóa truyện" aria-label="Xóa truyện ' + esc(p.title || "") + '">' + icon("trash") + "</button></div>";
    const activate = () => switchStory(p.id);
    el.addEventListener("click", ev => {
      const a = ev.target.closest("[data-a]");
      if (a) { ev.stopPropagation(); storyAction(a.dataset.a, p); return; }
      activate();
    });
    el.addEventListener("keydown", ev => {
      if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); activate(); }
    });
    list.appendChild(el);
  });
  $("#storyCount").textContent = state.projects.length ? state.projects.length : "";
  const ap = activeProject();
  document.title = (ap && ap.title && ap.title.trim() ? ap.title.trim() : "Truyện chưa đặt tên") + " — Chuseoz";
  const storyTitle = $("#storyTitle");
  if (storyTitle) storyTitle.title = ap && ap.title ? ap.title : "Truyện chưa đặt tên";
  const sf = $("#storyFilter");
  if (sf && sf.value) applyStoryFilter(sf.value);
  renderOutline();
  renderStats();
}

/* Nhân bản / xóa truyện — tách ra để dùng chung cho rail, bảng lệnh và palette */
async function storyAction(act, p) {
  if (act === "del") {
    if (state.projects.length <= 1) {
      toast("Cần giữ lại ít nhất một truyện. Dùng “Xóa nội dung truyện này” để làm trống.", "err");
      return;
    }
    const ok = await confirmDialog({
      title: "Xóa truyện",
      body: 'Xóa truyện <span class="cb-strong">“' + escHtml(p.title || "chưa đặt tên") + "”</span> gồm " +
        p.blocks.length + " chương?",
      warning: "Các chương sẽ mất vĩnh viễn khỏi trình duyệt. Nếu đã bật đồng bộ Drive thì bản trên Drive vẫn còn.",
      confirmLabel: "Xóa truyện",
      cancelLabel: "Giữ lại",
      danger: true,
    });
    if (!ok) return;
    logInfo("story", "đã xóa truyện " + (p.title || "(không tên)"));
    state.projects = state.projects.filter(x => x.id !== p.id);
    if (state.activeId === p.id) state.activeId = state.projects[0].id;
    persistNow();
    renderAll();
    toast("Đã xóa truyện.", "ok");
  } else if (act === "dup") {
    const copy = normalizeProject(JSON.parse(JSON.stringify(p)));
    copy.id = uid("story_");
    copy.title = (p.title || "Truyện") + " (bản sao)";
    copy.updatedAt = new Date().toISOString();
    state.projects.unshift(copy);
    state.activeId = copy.id;
    persistNow();
    renderAll();
    toast("Đã nhân bản truyện.", "ok");
  }
}

function renderChapters() {
  const p = activeProject();
  const box = $("#chapters");
  box.innerHTML = "";
  const empty = !p || !p.blocks.length;
  $("#emptyState").style.display = empty ? "block" : "none";
  $("#addChapter").style.display = "flex";
  $("#statsBar").style.display = empty ? "none" : "flex";
  if (!p) return;
  p.blocks.forEach((b, i) => box.appendChild(chapterCard(p, b, i)));
  if (!state.focusedBlock && p.blocks.length) state.focusedBlock = p.blocks[0].id;
}

function chapterCard(p, b, i) {
  const card = document.createElement("div");
  const collapsed = state.collapsed.has(b.id);
  card.className = "chapter" + (b.id === state.focusedBlock ? " focused" : "") + (collapsed ? " collapsed" : "");
  card.dataset.bid = b.id;
  card.draggable = false;
  const n = b.id.replace(/[^a-zA-Z0-9]/g, "");
  card.innerHTML =
    '<div class="chapter-head">' +
    '<button class="iconbtn ch-drag" data-t="drag" title="Kéo để sắp xếp chương" aria-label="Kéo để sắp xếp chương ' + (i + 1) + '">' + icon("drag") + "</button>" +
    '<span class="ch-index">' + (i + 1) + "</span>" +
    '<label class="sr-only" for="chTitle' + n + '">Tên chương ' + (i + 1) + "</label>" +
    '<input type="text" id="chTitle' + n + '" class="ch-title" placeholder="Tên chương..." value="' + esc(b.title) + '" title="' + esc(b.title) + '"/>' +
    '<span class="ch-sum" data-sum aria-hidden="true"></span>' +
    '<div class="ch-tools">' +
    '<button class="iconbtn" data-t="caret" title="Thu gọn / mở rộng chương" aria-label="Thu gọn hoặc mở rộng chương ' + (i + 1) + '" aria-expanded="' + (collapsed ? "false" : "true") + '">' + icon("caret") + "</button>" +
    '<button class="iconbtn" data-t="up" title="Đưa lên" aria-label="Đưa chương ' + (i + 1) + ' lên trên" style="display:' + (i > 0 ? "inline-flex" : "none") + '">' + icon("up") + "</button>" +
    '<button class="iconbtn" data-t="down" title="Đi xuống" aria-label="Đưa chương ' + (i + 1) + ' xuống dưới" style="display:' + (i < p.blocks.length - 1 ? "inline-flex" : "none") + '">' + icon("down") + "</button>" +
    '<button class="iconbtn" data-t="dup" title="Nhân bản chương" aria-label="Nhân bản chương ' + (i + 1) + '">' + icon("dup") + "</button>" +
    '<button class="iconbtn" data-t="del" title="Xóa chương" aria-label="Xóa chương ' + (i + 1) + '">' + icon("trash") + "</button>" +
    "</div></div>" +
    '<div class="chapter-body">' +
    '<div class="chars-grid">' +
    '<div class="field"><label for="chLeft' + n + '">Nhân vật bên trái</label><input type="text" id="chLeft' + n + '" data-f="leftChars" value="' + esc(b.leftChars) + '" title="' + esc(b.leftChars) + '" placeholder="Tên, cách nhau bởi dấu phẩy"/></div>' +
    '<div class="field"><label for="chRight' + n + '">Nhân vật bên phải</label><input type="text" id="chRight' + n + '" data-f="rightChars" value="' + esc(b.rightChars) + '" title="' + esc(b.rightChars) + '" placeholder="Tên, cách nhau bởi dấu phẩy"/></div>' +
    "</div>" +
    '<div class="ch-content editor" data-f="content" contenteditable="true" role="textbox" aria-multiline="true" ' +
    'aria-label="Nội dung chương ' + (i + 1) + '" aria-describedby="chHint' + n + '" spellcheck="false" ' +
    'data-placeholder="Tên: lời thoại — dán từ web giữ in đậm/in nghiêng (Ctrl+B / Ctrl+I)"></div>' +
    '<div class="img-row">' +
    '<label class="sr-only" for="chUrl' + n + '">Dán URL ảnh</label>' +
    '<input type="url" id="chUrl' + n + '" class="url" placeholder="Dán URL ảnh…"/>' +
    '<button class="btn" data-t="insert">' + icon("image") + " Chèn</button>" +
    '<button class="btn" data-t="upload">' + icon("upload") + " Tải ảnh</button>" +
    '<button class="btn btn-ghost" data-t="sticker" title="Chèn nhãn dán">' + icon("sticker") + " Nhãn dán</button>" +
    '<button class="btn btn-ghost" data-t="bold" title="In đậm (Ctrl+B)" aria-label="In đậm">' + icon("bold") + "</button>" +
    '<button class="btn btn-ghost" data-t="italic" title="In nghiêng (Ctrl+I)" aria-label="In nghiêng">' + icon("italic") + "</button>" +
    '<span class="char-count" data-count role="status"></span>' +
    "</div>" +
    '<p class="img-hint" id="chHint' + n + '">Dán từ web khác giữ <b>in đậm</b>/<i>in nghiêng</i>. Ảnh dán vào lưu <b>riêng khỏi văn bản</b> — ô nội dung chỉ giữ token ngắn. <b>Ctrl+V</b> hoặc kéo–thả ảnh thẳng vào ô nội dung.</p>' +
    "</div>";

  const ed = card.querySelector(".ch-content");
  ed.innerHTML = textToEditorHtml(b.content || "");
  const count = card.querySelector("[data-count]");
  const sum = card.querySelector("[data-sum]");
  const updateCount = () => {
    const raw = editorToText(ed);
    const st = textStats(ed.textContent);
    const nImg = (raw.match(/\[\[IMG:/g) || []).length;
    count.textContent =
      (st.chars ? fmtCount(st.chars) + " ký tự · ~" + fmtCount(st.words) + " từ" : "") +
      (nImg ? (st.chars ? " · " : "") + nImg + " ảnh" : "");
    count.title = count.textContent;
    sum.textContent = (st.chars ? fmtCount(st.chars) + " ký tự" : "trống") + (nImg ? " · " + nImg + " ảnh" : "");
    sum.title = sum.textContent;
  };
  updateCount();
  const onEdit = (structural) => {
    if (!ed.textContent && !ed.querySelector("img")) ed.innerHTML = ""; // placeholder hiện lại khi trống
    b.content = editorToText(ed);
    updateCount();
    state.focusedBlock = b.id;
    touchProject(p);
    saveProjects();
    schedulePreview();
    scheduleOutline();
    if (structural) history.reset(p.blocks);
    else scheduleHistory();
  };
  ed.addEventListener("input", () => onEdit(false));
  const markFocused = () => {
    if (state.focusedBlock !== b.id) {
      state.focusedBlock = b.id;
      document.querySelectorAll(".chapter.focused").forEach(x => x.classList.remove("focused"));
      card.classList.add("focused");
      document.querySelectorAll("#chapterOutline .ol-item").forEach(x => x.classList.toggle("active", x.dataset.bid === b.id));
      schedulePreview();
    }
  };
  ed.addEventListener("focus", markFocused);
  card.addEventListener("focusin", markFocused);

  // phím tắt định dạng: Ctrl+B / Ctrl+I — dùng Range API, không dùng execCommand
  ed.addEventListener("keydown", ev => {
    if (!(ev.ctrlKey || ev.metaKey)) return;
    const k = ev.key.toLowerCase();
    if (k === "b" || k === "i") {
      ev.preventDefault();
      if (toggleInline(ed, k)) onEdit(false);
    }
  });

  card.querySelector(".ch-title").addEventListener("input", ev => {
    b.title = ev.target.value;
    ev.target.title = ev.target.value;
    touchProject(p); saveProjects(); schedulePreview(); scheduleOutline();
  });
  ["leftChars", "rightChars"].forEach(f => {
    card.querySelector('[data-f="' + f + '"]').addEventListener("input", ev => {
      b[f] = ev.target.value;
      ev.target.title = ev.target.value;
      touchProject(p); saveProjects(); schedulePreview();
    });
  });

  // chèn ảnh + dán giàu định dạng: URL / upload / paste / drop — ảnh lớn tự nén, chèn đúng vị trí con trỏ
  let savedRange = null;
  const saveRange = () => {
    try {
      const sel = window.getSelection();
      if (sel && sel.rangeCount && ed.contains(sel.getRangeAt(0).commonAncestorContainer)) {
        savedRange = sel.getRangeAt(0).cloneRange();
      }
    } catch (e) {}
  };
  ["keyup", "mouseup", "focus", "input", "touchend"].forEach(t => ed.addEventListener(t, saveRange));
  const rangeToEnd = () => {
    const r = document.createRange();
    r.selectNodeContents(ed);
    r.collapse(false);
    return r;
  };
  const validSaved = () => savedRange && ed.contains(savedRange.commonAncestorContainer);
  const insertPlainTextAtCaret = text => {
    ed.focus();
    insertTextAtCaret(ed, text, validSaved() ? savedRange : rangeToEnd());
    saveRange();
  };
  const insertHtml = html => {
    ed.focus();
    if (!insertHtmlAtCaret(ed, html, validSaved() ? savedRange : rangeToEnd())) {
      insertPlainTextAtCaret(stripInlineTags(html.replace(/<[^>]+>/g, "")));
    }
    saveRange();
  };
  const insertAtCursor = (src, cz) => {
    const token = "[[IMG:" + addBlockImage(b, src, cz) + "]]";
    const before = editorToText(ed);
    insertPlainTextAtCaret((before && !before.endsWith("\n") ? "\n" : "") + token + "\n");
    onEdit(false);
    ed.scrollTop = ed.scrollHeight; // nhìn thấy token vừa chèn
  };
  const insertImageCompressed = src => {
    // bộ nhớ đang căng → nén mạnh tay hơn để không bao giờ chạm trần 5MB
    const tight = storageUsedBytes() > AUTO_SHRINK_AT - 700000;
    const lvl = SHRINK_LEVELS[tight ? 1 : 0];
    compressImageSrc(src, lvl.px, lvl.q).then(out => {
      // ảnh đã nén ngay lúc chèn → đánh dấu, không nén lại lúc mở trang (không thông báo gì)
      insertAtCursor(out, out === src ? CZ_KEEP : lvl.tag);
      autoGaveUp = false;      // có ảnh mới → cho phép tự nén tiếp
      maybeAutoShrink(true);
    }).catch(err => {
      logError("image", "không nén được ảnh", err && err.message);
      toast("Không đọc được ảnh này.", "err");
    });
  };
  const urlInput = card.querySelector(".url");
  card.querySelector('[data-t="insert"]').addEventListener("click", () => {
    const url = urlInput.value.trim();
    if (!/^https?:\/\//i.test(url) && !/^data:image\//i.test(url)) { toast("URL ảnh chưa đúng — phải bắt đầu bằng https://", "err"); return; }
    insertAtCursor(url);
    urlInput.value = "";
  });
  urlInput.addEventListener("keydown", ev => { if (ev.key === "Enter") { ev.preventDefault(); card.querySelector('[data-t="insert"]').click(); } });
  const fileInput = $("#fileImage");
  card.querySelector('[data-t="upload"]').addEventListener("click", () => {
    fileInput.onchange = () => {
      const f = fileInput.files && fileInput.files[0];
      if (!f || !f.type.startsWith("image/")) return;
      const reader = new FileReader();
      reader.onload = () => insertImageCompressed(reader.result);
      reader.onerror = () => toast("Không đọc được file ảnh.", "err");
      reader.readAsDataURL(f);
      fileInput.value = "";
    };
    fileInput.click();
  });
  // dán: ưu tiên ảnh → HTML (giữ đậm/nghiêng) → văn bản thường mặc định
  ed.addEventListener("paste", ev => {
    const dt = ev.clipboardData;
    if (!dt) return;
    for (let ii = 0; ii < (dt.items ? dt.items.length : 0); ii++) {
      const it = dt.items[ii];
      if (it.type && it.type.startsWith("image/")) {
        ev.preventDefault();
        const f = it.getAsFile();
        const reader = new FileReader();
        reader.onload = () => insertImageCompressed(reader.result);
        reader.readAsDataURL(f);
        toast("Đã chèn ảnh vừa dán.", "ok");
        return;
      }
    }
    const html = dt.getData("text/html");
    if (html) {
      const clean = pasteHtmlToClean(html);
      if (clean) {
        ev.preventDefault();
        insertHtml(escInline(clean).replace(/\n/g, "<br>"));
        onEdit(false);
      }
    }
  });
  ["dragover", "dragenter"].forEach(t => ed.addEventListener(t, ev => {
    if (ev.dataTransfer && [...(ev.dataTransfer.types || [])].includes("application/x-chuseoz-chapter")) return;
    ev.preventDefault();
    ed.classList.add("dragover");
  }));
  ["dragleave", "drop"].forEach(t => ed.addEventListener(t, ev => { ev.preventDefault(); ed.classList.remove("dragover"); }));
  ed.addEventListener("drop", ev => {
    if (ev.dataTransfer && [...(ev.dataTransfer.types || [])].includes("application/x-chuseoz-chapter")) return;
    const f = ev.dataTransfer && ev.dataTransfer.files && ev.dataTransfer.files[0];
    if (f && f.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = () => insertImageCompressed(reader.result);
      reader.readAsDataURL(f);
      return;
    }
    // kéo–thả HTML từ web → giữ đậm/nghiêng, chèn tại điểm thả
    const html = ev.dataTransfer && ev.dataTransfer.getData("text/html");
    if (html) {
      const clean = pasteHtmlToClean(html);
      if (clean) {
        ev.preventDefault();
        try {
          if (document.caretRangeFromPoint) {
            const r = document.caretRangeFromPoint(ev.clientX, ev.clientY);
            if (r && ed.contains(r.commonAncestorContainer)) { savedRange = r.cloneRange(); }
          } else if (document.caretPositionFromPoint) {
            const pos = document.caretPositionFromPoint(ev.clientX, ev.clientY);
            if (pos && ed.contains(pos.offsetNode)) { const r = document.createRange(); r.setStart(pos.offsetNode, pos.offset); r.collapse(true); savedRange = r; }
          }
        } catch (e) {}
        insertHtml(escInline(clean).replace(/\n/g, "<br>"));
        onEdit(false);
      }
    }
  });

  /* ---- kéo–thả để sắp xếp chương ---- */
  const handle = card.querySelector('[data-t="drag"]');
  handle.addEventListener("pointerdown", () => { card.draggable = true; });
  ["pointerup", "pointercancel"].forEach(t => handle.addEventListener(t, () => { card.draggable = false; }));
  card.addEventListener("dragstart", ev => {
    if (!card.draggable) { ev.preventDefault(); return; }
    state.dragBlock = b.id;
    card.classList.add("dragging");
    try {
      ev.dataTransfer.effectAllowed = "move";
      ev.dataTransfer.setData("application/x-chuseoz-chapter", b.id);
      ev.dataTransfer.setData("text/plain", b.title || "Chương " + (i + 1));
    } catch (e) {}
  });
  card.addEventListener("dragend", () => {
    card.draggable = false;
    card.classList.remove("dragging");
    document.querySelectorAll(".chapter.drop-before,.chapter.drop-after").forEach(x => x.classList.remove("drop-before", "drop-after"));
    state.dragBlock = "";
  });
  card.addEventListener("dragover", ev => {
    if (!state.dragBlock || state.dragBlock === b.id) return;
    ev.preventDefault();
    ev.dataTransfer.dropEffect = "move";
    const r = card.getBoundingClientRect();
    const before = ev.clientY < r.top + r.height / 2;
    card.classList.toggle("drop-before", before);
    card.classList.toggle("drop-after", !before);
  });
  card.addEventListener("dragleave", () => card.classList.remove("drop-before", "drop-after"));
  card.addEventListener("drop", ev => {
    const fromId = state.dragBlock || (ev.dataTransfer && ev.dataTransfer.getData("application/x-chuseoz-chapter"));
    if (!fromId || fromId === b.id) return;
    ev.preventDefault();
    const from = p.blocks.findIndex(x => x.id === fromId);
    if (from < 0) return;
    const r = card.getBoundingClientRect();
    const before = ev.clientY < r.top + r.height / 2;
    const [moved] = p.blocks.splice(from, 1);
    let to = p.blocks.findIndex(x => x.id === b.id);
    if (!before) to += 1;
    p.blocks.splice(to, 0, moved);
    touchProject(p);
    history.push(p.blocks);
    persistNow();
    renderChapters(); renderRail(); schedulePreview();
    toast("Đã chuyển chương “" + (moved.title || "không tên") + "”.", "ok");
  });

  card.addEventListener("click", async ev => {
    const t = ev.target.closest("[data-t]");
    if (!t) return;
    const act = t.dataset.t;
    if (act === "caret") {
      if (state.collapsed.has(b.id)) state.collapsed.delete(b.id); else state.collapsed.add(b.id);
      renderChapters();
      return;
    }
    if (act === "bold" || act === "italic") {
      ed.focus();
      if (toggleInline(ed, act === "bold" ? "b" : "i")) onEdit(false);
      return;
    }
    if (act === "sticker") { openStickerPicker(b, insertPlainTextAtCaret, () => onEdit(false)); return; }
    if (act === "drag") return;
    if (act === "up" || act === "down") {
      const j = act === "up" ? i - 1 : i + 1;
      if (j < 0 || j >= p.blocks.length) return;
      [p.blocks[i], p.blocks[j]] = [p.blocks[j], p.blocks[i]];
      touchProject(p); history.push(p.blocks); persistNow(); renderChapters(); renderRail(); schedulePreview();
    } else if (act === "del") {
      if (p.blocks.length <= 1) { toast("Chương cuối — hãy thêm chương mới trước khi xóa.", "err"); return; }
      const st = textStats(b.content || "");
      const ok = await confirmDialog({
        title: "Xóa chương",
        body: 'Xóa <span class="cb-strong">“' + escHtml(b.title || "chương không tên") + "”</span>?" +
          (st.chars ? " Chương có " + fmtCount(st.chars) + " ký tự." : ""),
        warning: "Có thể hoàn tác ngay bằng Ctrl+Z.",
        confirmLabel: "Xóa chương",
        cancelLabel: "Giữ lại",
        danger: true,
      });
      if (!ok) return;
      p.blocks.splice(i, 1);
      touchProject(p); history.push(p.blocks); persistNow(); renderChapters(); renderRail(); schedulePreview();
      toast("Đã xóa chương — Ctrl+Z để hoàn tác.", "ok");
    } else if (act === "dup") {
      const copy = JSON.parse(JSON.stringify(b));
      copy.id = uid("blk_");
      copy.title = (b.title || "Chương") + " (bản sao)";
      p.blocks.splice(i + 1, 0, copy);
      state.focusedBlock = copy.id;
      touchProject(p); history.push(p.blocks); persistNow(); renderChapters(); renderRail();
      toast("Đã nhân bản chương.", "ok");
    }
  });
  return card;
}

/* ---------- preview ---------- */
const schedulePreview = debounce(renderPreview, 160);
const renderRailSoft = debounce(renderRail, 500);
function renderPreview() {
  const p = activeProject();
  const body = $("#pvBody");
  const nearBottom = body.scrollHeight - body.scrollTop - body.clientHeight < 80;
  if (!p || !p.blocks.length) { body.innerHTML = '<div class="pv-empty">Chưa có gì để xem trước.</div>'; return; }
  const b = p.blocks.find(x => x.id === state.focusedBlock) || p.blocks[0];
  $("#pvChapterName").textContent = b.title || "";
  let html = '<div class="pv-title">' + escInline(b.title || "Chương") + "</div>";
  let buf = [];
  const flush = () => {
    if (!buf.length) return;
    html += '<div class="pv-chat">';
    buf.forEach(m => { html += '<div class="pv-msg ' + m.side + '"><span class="pv-name">' + escInline(stripInlineTags(m.name)) + "</span>" + escInline(m.message) + "</div>"; });
    html += "</div>";
    buf = [];
  };
  String(b.content || "").replace(/(\r?\n){3,}/g, "\n\n").split("\n").forEach(raw => {
    const line = raw.trimEnd();
    if (!line.trim()) { flush(); html += '<div class="pv-spacer"></div>'; return; }
    const solo = line.trim().match(/^\[\[IMG:[^\]]+\]\]$/i);
    if (solo) {
      const src = imageSrcOf(b, line.trim());
      flush();
      html += src ? '<img class="pv-img" src="' + escHtml(src) + '" alt=""/>' : "";
      return;
    }
    const dlg = parseSmartLine(line);
    if (dlg) { buf.push({ name: dlg.name, message: dlg.message, side: sideOf(dlg.name, b.rightChars || "") }); return; }
    flush();
    html += '<div class="pv-text">' + escInline(line) + "</div>";
  });
  flush();
  body.innerHTML = html || '<div class="pv-empty">Chương đang trống — viết vài dòng để xem trước.</div>';
  if (nearBottom) body.scrollTop = body.scrollHeight;
}

/* ===== HÀNH ĐỘNG CHÍNH ===== */
function currentStoryTitle() {
  const p = activeProject();
  return (p && p.title && p.title.trim()) || "Truyện chưa đặt tên";
}
function openCodeModal() {
  const p = activeProject();
  if (!p || !p.blocks.some(b => (b.content || "").trim())) { toast("Chưa có nội dung chương nào — hãy viết trước đã.", "err"); return; }
  const part1 = buildPart1();
  const part2 = buildPart2(p.blocks);
  const body =
    '<div class="code-section"><div class="cs-head"><span class="cs-num">1</span><span class="cs-title">Style &amp; Script</span>' +
    '<button class="btn" data-copy="p1">' + icon("copy") + " Sao chép</button></div>" +
    '<p class="cs-sub">Dán vào <b>đầu bài đăng</b> Blogger, ở chế độ xem HTML.</p>' +
    '<div class="code-box" id="cb1"></div></div>' +
    '<div class="code-section"><div class="cs-head"><span class="cs-num">2</span><span class="cs-title">Nội dung truyện</span>' +
    '<button class="btn" data-copy="p2">' + icon("copy") + " Sao chép</button></div>" +
    '<p class="cs-sub">Dán tiếp vào <b>phía dưới</b> phần Style &amp; Script, cùng bài đăng đó.</p>' +
    '<div class="code-box" id="cb2"></div></div>';
  const scrim = openModal("<h2>Mã HTML đã sẵn sàng</h2>", body, currentStoryTitle() + " · " + p.blocks.length + " chương",
    [
      { label: "Sao chép gộp (dán 1 lần)", cls: "btn btn-ink", onClick: () => copyText(part1 + "\n\n" + part2) },
      { label: "Đóng", cls: "btn" }
    ]);
  scrim.querySelector("#cb1").textContent = part1;
  scrim.querySelector("#cb2").textContent = part2;
  scrim.addEventListener("click", ev => {
    const c = ev.target.closest("[data-copy]");
    if (!c) return;
    copyText(c.dataset.copy === "p1" ? part1 : part2, c);
  });
}

async function exportWord() {
  const p = activeProject();
  if (!p || !p.blocks.some(b => (b.content || "").trim())) { toast("Chưa có nội dung chương nào để xuất Word.", "err"); return; }
  const btn = $("#btnWord");
  const old = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = icon("doc") + ' <span class="blabel">Đang nhúng ảnh…</span>';
  try {
    const blob = await buildDocx(p.blocks, currentStoryTitle(), msg => { btn.innerHTML = icon("doc") + ' <span class="blabel">' + escHtml(msg) + "</span>"; });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = (currentStoryTitle().replace(/[\\/:*?"<>|]+/g, " ").trim() || "truyen") + ".docx";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    toast("Đã xuất file Word — ảnh chèn trong truyện hiển thị nguyên vẹn.", "ok");
  } catch (e) {
    toast(e.message === "EMPTY" ? "Chưa có nội dung để xuất." : "Không tạo được file Word: " + (e.message || e), "err");
  } finally {
    btn.disabled = false;
    btn.innerHTML = old;
  }
}

/* ---------- backup file ---------- */
function downloadBackup() {
  if (!state.projects.length) { toast("Chưa có truyện nào để backup.", "err"); return; }
  const payload = { version: 2, exportedAt: new Date().toISOString(), activeProjectId: state.activeId, projects: state.projects };
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([JSON.stringify(payload)], { type: "application/json" }));
  a.download = "chuseoz-story-backup-" + new Date().toISOString().slice(0, 10) + ".json";
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  toast("Đã tải backup toàn bộ truyện về máy.", "ok");
}
function uploadBackup() {
  const inp = $("#fileBackup");
  inp.onchange = () => {
    const f = inp.files && inp.files[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = async () => {
      let data;
      try {
        data = JSON.parse(reader.result);
      } catch (err) {
        logError("backup", "không đọc được JSON", err && err.message);
        toast("File backup không đọc được.", "err");
        return;
      }
      const incoming = Array.isArray(data) ? data.length : (data && Array.isArray(data.projects) ? data.projects.length : 0);
      if (!incoming) { toast("File không có dữ liệu truyện hợp lệ.", "err"); return; }
      /* Quyết định phá huỷ dữ liệu — hỏi rõ ràng thay vì OK/Cancel mơ hồ */
      const mode = await choiceDialog({
        title: "Nạp " + incoming + " truyện từ file",
        body: "Bạn muốn nạp theo cách nào?<br><br>" +
          "<b>Gộp vào danh sách hiện có</b> — giữ nguyên " + state.projects.length +
          " truyện đang có; truyện nào trùng mã thì lấy bản trong file.<br><br>" +
          "<b>Thay toàn bộ</b> — xóa hết danh sách hiện tại và dùng đúng nội dung file.",
        options: [
          { label: "Gộp vào danh sách hiện có", cls: "btn btn-primary", value: "merge" },
          { label: "Thay toàn bộ danh sách", cls: "btn btn-danger", value: "replace" },
        ],
        cancelLabel: "Hủy, không nạp",
        width: "560px",
      });
      if (!mode) return;
      if (mode === "replace") {
        const ok = await confirmDialog({
          title: "Xác nhận thay toàn bộ",
          body: "Toàn bộ " + state.projects.length + " truyện hiện tại sẽ bị thay bằng nội dung file.",
          warning: "Nếu chưa tải backup, dữ liệu cũ sẽ không lấy lại được.",
          confirmLabel: "Thay toàn bộ",
          cancelLabel: "Quay lại",
          danger: true,
        });
        if (!ok) return;
      }
      const r = ingestBackupData(data, mode);
      if (!r.added) { toast("File không có dữ liệu truyện hợp lệ.", "err"); return; }
      const p = activeProject();
      if (p) history.reset(p.blocks);
      logInfo("backup", "đã nạp " + r.added + " truyện theo chế độ " + mode);
      toast("Đã nạp " + r.added + " truyện từ file.", "ok");
    };
    reader.onerror = () => toast("Không đọc được file.", "err");
    reader.readAsText(f, "utf-8");
    inp.value = "";
  };
  inp.click();
}

/* ---------- Drive modal ---------- */
function openDriveModal() {
  const cfg = cloudCfg();
  const body =
    '<div class="field-lg"><label>Link Google Apps Script</label>' +
    '<input id="drvUrl" type="url" placeholder="https://script.google.com/macros/s/…/exec" value="' + esc(cfg.url) + '"/></div>' +
    '<div class="field-lg"><label>Mã đồng bộ</label>' +
    '<input id="drvKey" type="text" placeholder="Mã riêng của bạn" value="' + esc(cfg.key) + '"/></div>' +
    '<p style="font-size:12.5px;color:var(--ink2);margin:4px 0 0">Sau khi điền, mọi thay đổi trong truyện sẽ <b>tự đẩy lên Drive</b>. Dùng “Khôi phục” trong menu ⋯ để đọc lại bản backup.</p>';
  openModal("<h2>Đồng bộ Google Drive</h2>", body, "",
    [
      { label: "Lưu & gửi ngay", cls: "btn btn-primary", onClick: async s => {
          const url = s.querySelector("#drvUrl").value.trim();
          const key = s.querySelector("#drvKey").value.trim();
          store.setItem(KEY_CLOUD_URL, url);
          store.setItem(KEY_CLOUD_KEY, key);
          closeModal(s);
          if (!normalizeCloudUrl(url) || !key) { setCloudState("idle", ""); $("#cloudStatus").style.display = "none"; toast("Đã tắt đồng bộ Drive."); return; }
          await cloudPush();
        } },
      { label: "Đóng", cls: "btn" }
    ]);
}

/* ---------- story ops ---------- */
function switchStory(id) {
  if (state.activeId === id) { closeRail(); return; }
  state.activeId = id;
  const p = activeProject();
  state.focusedBlock = p && p.blocks.length ? p.blocks[0].id : "";
  state.collapsed.clear();
  history.reset(p ? p.blocks : []);
  store.setItem(KEY_ACTIVE, id);
  $("#storyTitle").value = p ? p.title : "";
  renderAll();
  closeRail();
}
function newStory() {
  const p = normalizeProject({ id: uid("story_"), title: "", blocks: [makeBlock(null)] });
  state.projects.unshift(p);
  persistNow();
  switchStory(p.id);
  $("#storyTitle").focus();
  $("#storyTitle").select();
  toast("Đã tạo truyện mới.", "ok");
}
function renderAll() {
  renderRail();
  renderChapters();
  renderPreview();
}

/* ---------- rail mobile ---------- */
function closeRail() { $("#rail").classList.remove("open"); $("#railScrim").classList.remove("open"); }

/* ===== THỐNG KÊ · DÀN BÀI · NHÃN DÁN · BẢNG LỆNH · TÌM KIẾM · TẬP TRUNG · LỊCH SỬ · CHẨN ĐOÁN ===== */

/* ---------- thanh thống kê ---------- */
function renderStats() {
  const bar = $("#statsBar");
  if (!bar) return;
  const p = activeProject();
  if (!p || !p.blocks.length) { bar.innerHTML = ""; return; }
  let chars = 0, words = 0, imgs = 0;
  p.blocks.forEach(b => {
    const st = textStats(b.content || "");
    chars += st.chars; words += st.words;
    imgs += ((b.content || "").match(/\[\[IMG:/g) || []).length;
  });
  const mins = Math.max(chars ? 1 : 0, Math.round(words / 200));
  bar.innerHTML =
    '<span class="stat"><b>' + p.blocks.length + "</b> chương</span>" +
    '<span class="stat"><b>' + fmtCount(chars) + "</b> ký tự</span>" +
    '<span class="stat"><b>' + fmtCount(words) + "</b> từ</span>" +
    '<span class="stat"><b>~' + mins + "</b> phút đọc</span>" +
    (imgs ? '<span class="stat"><b>' + imgs + "</b> ảnh</span>" : "");
}

/* ---------- dàn bài chương trong thanh bên ---------- */
function renderOutline() {
  const box = $("#chapterOutline");
  if (!box) return;
  const p = activeProject();
  box.innerHTML = "";
  if (!p) return;
  p.blocks.forEach((b, i) => {
    const st = textStats(b.content || "");
    const el = document.createElement("button");
    el.type = "button";
    el.className = "ol-item" + (b.id === state.focusedBlock ? " active" : "");
    el.dataset.bid = b.id;
    el.innerHTML = '<span class="ol-n">' + (i + 1) + '</span><span class="ol-t">' +
      escHtml(stripInlineTags(b.title) || "Chương chưa đặt tên") + '</span><span class="ol-c">' +
      (st.chars ? fmtCount(st.chars) : "—") + "</span>";
    el.title = (b.title || "Chương chưa đặt tên") + " · " + st.chars + " ký tự";
    el.addEventListener("click", () => {
      state.focusedBlock = b.id;
      const card = document.querySelector('.chapter[data-bid="' + b.id + '"]');
      if (card) {
        if (state.collapsed.has(b.id)) { state.collapsed.delete(b.id); renderChapters(); }
        const target = document.querySelector('.chapter[data-bid="' + b.id + '"]') || card;
        try { target.scrollIntoView({ behavior: "smooth", block: "center" }); } catch (e) {}
        const ed = target.querySelector(".ch-content");
        if (ed) ed.focus();
      }
      if (window.innerWidth <= 920) closeRail();
    });
    box.appendChild(el);
  });
}
const scheduleOutline = debounce(renderOutline, 400);

function setRailTab(tab) {
  state.railTab = tab;
  const stories = tab === "stories";
  $("#storyList").classList.toggle("hidden", !stories);
  $("#chapterOutline").classList.toggle("open", !stories);
  $("#storyFilterWrap").style.display = stories ? "" : "none";
  $("#tabStories").setAttribute("aria-selected", stories ? "true" : "false");
  $("#tabChapters").setAttribute("aria-selected", stories ? "false" : "true");
  $("#railHeadLabel").textContent = stories ? "Kho truyện" : "Chương";
  $("#storyCount").textContent = stories
    ? (state.projects.length ? state.projects.length : "")
    : ((activeProject() || { blocks: [] }).blocks.length || "");
  if (!stories) renderOutline();
}

/* ---------- nhãn dán ---------- */
const KEY_STICKERS = "chuseoz_stickers_v1";
const DEFAULT_STICKERS = [
  ["🥰", "yêu"], ["😂", "cười"], ["🥺", "năn nỉ"], ["😭", "khóc"], ["😡", "giận"],
  ["😴", "ngủ"], ["🤔", "nghĩ"], ["👍", "đồng ý"], ["👏", "vỗ tay"], ["🎉", "ăn mừng"],
  ["💔", "tan vỡ"], ["🌙", "chúc ngủ ngon"], ["☕", "cà phê"], ["🍜", "ăn"]
];
function readStickers() {
  try {
    const raw = JSON.parse(store.getItem(KEY_STICKERS) || "null");
    if (Array.isArray(raw) && raw.length) return raw;
  } catch (e) {}
  return DEFAULT_STICKERS.slice();
}
function writeStickers(list) {
  try { store.setItem(KEY_STICKERS, JSON.stringify(list)); } catch (e) {}
}
function openStickerPicker(block, insert, after) {
  const list = readStickers();
  const grid = list.map((s, i) =>
    '<button class="stk" data-i="' + i + '" type="button"><span class="stk-e">' + escHtml(s[0]) +
    "</span><span>" + escHtml(s[1]) + "</span></button>").join("");
  const body = '<div class="stk-grid">' + grid + "</div>" +
    '<div class="stk-add"><label class="sr-only" for="stkEmoji">Emoji</label>' +
    '<input id="stkEmoji" type="text" maxlength="4" placeholder="😀" style="max-width:90px"/>' +
    '<label class="sr-only" for="stkName">Tên nhãn dán</label>' +
    '<input id="stkName" type="text" placeholder="Tên nhãn dán (vd: cười)"/>' +
    '<button class="btn" id="stkAdd" type="button">' + icon("plus") + " Thêm</button></div>" +
    '<p style="font-size:12px;color:var(--ink3);margin:10px 0 0">Dòng chèn vào có dạng <code>(Nhãn dán: Tên)</code> — khi xuất blog sẽ thành một dòng riêng.</p>';
  const scrim = openModal("<h2>Chèn nhãn dán</h2>", body, "", [
    { label: "Xong", cls: "btn btn-primary", onClick: s => closeModal(s) }
  ], { width: "560px" });
  const doInsert = (name) => {
    insert("\n(Nhãn dán: " + name + ")\n");
    if (after) after();
    toast('Đã chèn "(Nhãn dán: ' + name + ')".', "ok");
  };
  scrim.querySelector(".stk-grid").addEventListener("click", ev => {
    const b = ev.target.closest("[data-i]");
    if (!b) return;
    doInsert(list[+b.dataset.i][1]);
    closeModal(scrim);
  });
  scrim.querySelector("#stkAdd").addEventListener("click", () => {
    const e = (scrim.querySelector("#stkEmoji").value || "").trim();
    const nm = (scrim.querySelector("#stkName").value || "").trim();
    if (!nm) { toast("Cần nhập tên nhãn dán.", "err"); return; }
    const cur = readStickers();
    cur.push([e || "🏷️", nm]);
    writeStickers(cur);
    doInsert(nm);
    closeModal(scrim);
  });
}

/* ---------- bảng phím tắt ---------- */
const SHORTCUTS = [
  ["Chung", [
    ["Mở bảng lệnh", ["Ctrl", "K"]],
    ["Tìm & thay thế", ["Ctrl", "F"]],
    ["Tạo mã HTML", ["Ctrl", "Enter"]],
    ["Lưu ngay", ["Ctrl", "S"]],
    ["Hoàn tác", ["Ctrl", "Z"]],
    ["Làm lại", ["Ctrl", "Shift", "Z"]],
    ["Chế độ tập trung", ["F9"]],
    ["Bảng phím tắt", ["?"]],
  ]],
  ["Trong ô nội dung", [
    ["In đậm", ["Ctrl", "B"]],
    ["In nghiêng", ["Ctrl", "I"]],
    ["Dán ảnh", ["Ctrl", "V"]],
    ["Thêm chương", ["Ctrl", "Shift", "Enter"]],
  ]],
];
function openShortcuts() {
  const body = SHORTCUTS.map(sec =>
    '<div class="keys-sec">' + escHtml(sec[0]) + "</div>" +
    sec[1].map(row =>
      '<div class="key-row"><span>' + escHtml(row[0]) + '</span><span class="kr-k">' +
      row[1].map(k => '<span class="kbd">' + escHtml(k) + "</span>").join("") +
      "</span></div>").join("")
  ).join("");
  openModal("<h2>Phím tắt</h2>", '<div class="keys-grid" style="grid-template-columns:1fr">' + body + "</div>", "", [
    { label: "Đóng", cls: "btn btn-primary", onClick: s => closeModal(s) }
  ], { width: "520px" });
}

/* ---------- bảng lệnh (Ctrl+K) ---------- */
function paletteCommands() {
  const p = activeProject();
  const cmd = [
    { icon: "code", title: "Tạo mã HTML cho Blogger", sub: "Ctrl+Enter", run: () => openCodeModal() },
    { icon: "doc", title: "Xuất file Word (.docx)", sub: "", run: () => exportWord() },
    { icon: "md", title: "Xuất Markdown (.md)", sub: "", run: () => exportMarkdown() },
    { icon: "txt", title: "Xuất văn bản thô (.txt)", sub: "", run: () => exportPlainText() },
    { icon: "plus", title: "Thêm chương mới", sub: "Ctrl+Shift+Enter", run: () => addChapter(true) },
    { icon: "search", title: "Tìm & thay thế", sub: "Ctrl+F", run: () => openFindBar() },
    { icon: "eye", title: state.previewOpen ? "Ẩn khung xem trước" : "Hiện khung xem trước", sub: "", run: () => togglePreview() },
    { icon: "focus", title: state.focusMode ? "Thoát chế độ tập trung" : "Chế độ tập trung", sub: "F9", run: () => toggleFocusMode() },
    { icon: "layers", title: state.railTab === "chapters" ? "Xem kho truyện" : "Xem dàn bài chương", sub: "", run: () => setRailTab(state.railTab === "chapters" ? "stories" : "chapters") },
    { icon: getThemePref() === "dark" ? "sun" : getThemePref() === "light" ? "monitor" : "moon", title: "Đổi giao diện (" + THEME_LABELS[getThemePref()] + ")", sub: "", run: () => { cycleTheme(); syncThemeUi(); } },
    { icon: "sparkle", title: "Nạp truyện mẫu", sub: "", run: () => loadSampleStory() },
    { icon: "sticker", title: "Chèn nhãn dán vào chương hiện tại", sub: "", run: () => insertStickerToFocused() },
    { icon: "history", title: "Lịch sử phiên bản", sub: "", run: () => openHistoryModal() },
    { icon: "download", title: "Tải backup (.json)", sub: "", run: () => downloadBackup() },
    { icon: "upload", title: "Nạp backup từ máy…", sub: "", run: () => uploadBackup() },
    { icon: "cloud", title: "Cài đặt đồng bộ Google Drive…", sub: "", run: () => openDriveModal() },
    { icon: "image", title: "Nén lại toàn bộ ảnh", sub: "", run: () => { autoGaveUp = false; autoTries = 0; shrinkLevel = 0; shrinkAllImages({ force: true }); } },
    { icon: "keyboard", title: "Xem phím tắt", sub: "?", run: () => openShortcuts() },
    { icon: "diag", title: "Xuất báo cáo chẩn đoán", sub: "", run: () => downloadDiagnostics() },
    { icon: "trash", title: "Xóa trắng nội dung truyện này", sub: "", run: () => clearStory(), danger: true },
  ];
  if (p && p.blocks.length) {
    p.blocks.forEach((b, i) => cmd.push({
      icon: "file",
      title: stripInlineTags(b.title) || "Chương " + (i + 1),
      sub: "Chương " + (i + 1) + " · " + textStats(b.content || "").chars + " ký tự",
      chapter: true,
      run: () => {
        state.focusedBlock = b.id;
        if (state.collapsed.has(b.id)) { state.collapsed.delete(b.id); renderChapters(); }
        const el = document.querySelector('.chapter[data-bid="' + b.id + '"]');
        if (el) { try { el.scrollIntoView({ behavior: "smooth", block: "center" }); } catch (e) {} const ed = el.querySelector(".ch-content"); if (ed) ed.focus(); }
      },
    }));
  }
  return cmd;
}

let palItems = [], palIndex = 0;
function renderPalette() {
  const q = ($("#palInput").value || "").trim().toLowerCase();
  palItems = paletteCommands().filter(c => {
    if (!q) return !c.chapter;
    return (c.title + " " + (c.sub || "")).toLowerCase().includes(q);
  }).slice(0, 40);
  palIndex = 0;
  const list = $("#palList");
  if (!palItems.length) { list.innerHTML = '<div class="pal-empty">Không tìm thấy lệnh nào khớp.</div>'; return; }
  list.innerHTML = palItems.map((c, i) =>
    '<button class="pal-item" type="button" role="option" data-i="' + i + '" aria-selected="' + (i === 0 ? "true" : "false") + '">' +
    '<span class="pi-ic">' + icon(c.icon) + '</span><span class="pi-tx">' + escHtml(c.title) +
    (c.sub ? '<div class="pi-sub">' + escHtml(c.sub) + "</div>" : "") + "</span></button>").join("");
}
function movePalette(d) {
  if (!palItems.length) return;
  palIndex = (palIndex + d + palItems.length) % palItems.length;
  $("#palList").querySelectorAll(".pal-item").forEach((el, i) => {
    el.setAttribute("aria-selected", i === palIndex ? "true" : "false");
    if (i === palIndex) el.scrollIntoView({ block: "nearest" });
  });
}
function openPalette() {
  $("#palInput").value = "";
  renderPalette();
  $("#palette").classList.add("open");
  $("#palInput").focus();
}
function closePalette() { $("#palette").classList.remove("open"); }
function runPalette(i) {
  const c = palItems[i];
  closePalette();
  if (c) setTimeout(() => c.run(), 0);
}

/* ---------- tìm & thay thế ---------- */
let fbHits = [], fbIdx = 0;
function fbOpts() {
  return { caseSensitive: $("#fbCase").checked, wholeWord: $("#fbWord").checked };
}
function openFindBar() {
  $("#findbar").classList.add("open");
  const inp = $("#findInput");
  inp.focus();
  inp.select();
  runFind();
}
function closeFindBar() {
  $("#findbar").classList.remove("open");
  fbHits = [];
  $("#findCount").textContent = "";
}
function runFind() {
  const q = $("#findInput").value;
  const p = activeProject();
  if (!q || !p) { fbHits = []; $("#findCount").textContent = ""; return; }
  fbHits = findAcross(p.blocks.map(b => ({ id: b.id, text: stripInlineTags(b.content || "") })), q, fbOpts());
  fbIdx = 0;
  $("#findCount").textContent = fbHits.length ? fbHits.length + " kết quả" : "0 kết quả";
  const hit = fbHits[0];
  if (hit) jumpToHit(hit);
}
function moveHit(d) {
  if (!fbHits.length) return;
  fbIdx = (fbIdx + d + fbHits.length) % fbHits.length;
  jumpToHit(fbHits[fbIdx]);
}
function jumpToHit(hit) {
  $("#findCount").textContent = (fbIdx + 1) + "/" + fbHits.length;
  const card = document.querySelector('.chapter[data-bid="' + hit.itemId + '"]');
  if (!card) return;
  if (state.collapsed.has(hit.itemId)) { state.collapsed.delete(hit.itemId); renderChapters(); }
  const el = document.querySelector('.chapter[data-bid="' + hit.itemId + '"]');
  if (el) { try { el.scrollIntoView({ behavior: "smooth", block: "center" }); } catch (e) {} }
  const ed = el && el.querySelector(".ch-content");
  if (!ed) return;
  ed.querySelectorAll("mark.fb-hit").forEach(m => {
    const t = document.createTextNode(m.textContent);
    m.replaceWith(t);
  });
  ed.normalize();
  // dò vị trí trong DOM theo offset trên văn bản đã bỏ thẻ
  const texts = textNodesOf(ed);
  let seen = 0, node = null, off = 0;
  for (const t of texts) {
    if (seen + t.nodeValue.length >= hit.index) { node = t; off = hit.index - seen; break; }
    seen += t.nodeValue.length;
  }
  if (!node) return;
  try {
    const r = document.createRange();
    r.setStart(node, off);
    r.setEnd(node, Math.min(node.nodeValue.length, off + hit.length));
    const mark = document.createElement("mark");
    mark.className = "fb-hit cur";
    r.surroundContents(mark);
  } catch (e) { /* vùng chọn vắt qua nhiều thẻ — bỏ qua đánh dấu */ }
}
async function doReplace(all) {
  const q = $("#findInput").value;
  const rep = $("#replaceInput").value;
  const p = activeProject();
  if (!q || !p) return;
  const commit = () => {
    touchProject(p); history.push(p.blocks); persistNow();
    renderChapters(); renderPreview(); scheduleOutline();
  };
  if (all) {
    let total = 0;
    p.blocks.forEach(b => {
      const r = replaceIn(b.content || "", q, rep, fbOpts());
      if (r.count) { b.content = r.text; total += r.count; }
    });
    if (!total) { toast("Không có gì để thay.", "err"); return; }
    commit();
    runFind();
    toast("Đã thay " + total + " chỗ.", "ok");
    return;
  }
  if (!fbHits.length) return;
  const hit = fbHits[fbIdx];
  const b = p.blocks.find(x => x.id === hit.itemId);
  if (!b) return;
  // Vị trí khớp tính trên văn bản đã bỏ <b>/<i>, nên chỉ thay khi chương không định dạng.
  if (stripInlineTags(b.content || "") !== (b.content || "")) {
    toast("Chương này có in đậm/nghiêng — hãy dùng “Thay tất cả”.", "err");
    return;
  }
  b.content = replaceAt(b.content || "", hit, rep).text;
  commit();
  runFind();
  toast("Đã thay 1 chỗ.", "ok");
}

/* ---------- chế độ tập trung ---------- */
function toggleFocusMode(force) {
  state.focusMode = force === undefined ? !state.focusMode : !!force;
  document.body.classList.toggle("focusmode", state.focusMode);
  $("#btnFocus").setAttribute("aria-pressed", state.focusMode ? "true" : "false");
  $("#btnFocus").innerHTML = icon(state.focusMode ? "unfocus" : "focus") + ' <span class="blabel">' + (state.focusMode ? "Thoát tập trung" : "Tập trung") + "</span>";
  try { store.setItem("chuseoz_focus_v1", state.focusMode ? "1" : "0"); } catch (e) {}
}

/* ---------- kéo giãn khung xem trước ---------- */
function initPreviewResizer() {
  const rz = $("#previewResizer");
  if (!rz) return;
  let startX = 0, startW = 0, dragging = false;
  const sync = () => rz.classList.toggle("on", state.previewOpen && window.innerWidth > 1280);
  window.addEventListener("resize", sync);
  const onMove = ev => {
    if (!dragging) return;
    const w = Math.max(280, Math.min(720, startW + (startX - ev.clientX)));
    document.documentElement.style.setProperty("--preview-w", w + "px");
  };
  const stop = () => {
    if (!dragging) return;
    dragging = false;
    document.body.classList.remove("resizing");
    rz.classList.remove("dragging");
    try { store.setItem("chuseoz_preview_w_v1", getComputedStyle(document.documentElement).getPropertyValue("--preview-w").trim()); } catch (e) {}
  };
  rz.addEventListener("pointerdown", ev => {
    dragging = true;
    startX = ev.clientX;
    startW = $("#preview").getBoundingClientRect().width;
    document.body.classList.add("resizing");
    rz.classList.add("dragging");
    try { rz.setPointerCapture(ev.pointerId); } catch (e) {}
  });
  window.addEventListener("pointermove", onMove);
  window.addEventListener("pointerup", stop);
  const saved = store.getItem("chuseoz_preview_w_v1");
  if (saved && /^\d+px$/.test(saved)) document.documentElement.style.setProperty("--preview-w", saved);
  return sync;
}

/* ---------- lịch sử phiên bản (IndexedDB) ---------- */
function snapshotPayload() {
  return {
    at: new Date().toISOString(),
    title: currentStoryTitle(),
    projects: state.projects.map(p => ({
      id: p.id, title: p.title, updatedAt: p.updatedAt,
      blocks: p.blocks.map(b => ({ id: b.id, title: b.title, content: b.content || "", leftChars: b.leftChars, rightChars: b.rightChars })),
    })),
    activeProjectId: state.activeId,
  };
}
async function pushSnapshot(reason) {
  if (!idbAvailable()) return false;
  const key = "snap_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 6);
  const ok = await putSnapshot(key, Object.assign({ reason: reason || "" }, snapshotPayload()));
  if (!ok) return false;
  // giữ tối đa 25 bản
  const keys = (await snapshotKeys()) || [];
  if (keys.length > 25) {
    const sorted = keys.slice().sort();
    for (const k of sorted.slice(0, keys.length - 25)) await deleteSnapshot(k);
  }
  return true;
}
const scheduleSnapshot = debounce(() => { pushSnapshot("tự động"); }, 5 * 60 * 1000);
async function openHistoryModal() {
  if (!idbAvailable()) {
    toast("Trình duyệt không cho dùng IndexedDB nên chưa lưu được lịch sử phiên bản.", "err");
    return;
  }
  const body = '<div id="verList" class="ver-list"><div class="ver-empty">Đang đọc…</div></div>';
  const scrim = openModal("<h2>Lịch sử phiên bản</h2>", body, "Bản sao tự động mỗi 5 phút, giữ 25 bản gần nhất — chỉ nằm trong máy bạn.", [
    { label: "Sao lưu ngay", cls: "btn", onClick: async () => { await pushSnapshot("thủ công"); toast("Đã lưu bản sao.", "ok"); openHistoryModal(); } },
    { label: "Đóng", cls: "btn btn-primary", onClick: s => closeModal(s) }
  ], { width: "620px" });
  const box = scrim.querySelector("#verList");
  const keys = ((await snapshotKeys()) || []).slice().sort().reverse();
  if (!keys.length) { box.innerHTML = '<div class="ver-empty">Chưa có bản sao nào. Bấm “Sao lưu ngay” để tạo bản đầu tiên.</div>'; return; }
  box.innerHTML = "";
  for (const k of keys.slice(0, 25)) {
    const v = await getSnapshot(k);
    if (!v) continue;
    const el = document.createElement("div");
    el.className = "ver-item";
    const d = new Date(v.at || Date.now());
    const chapters = (v.projects || []).reduce((n, pr) => n + (pr.blocks || []).length, 0);
    el.innerHTML = '<div class="v-body"><div class="v-when">' + escHtml(d.toLocaleString("vi-VN")) + "</div>" +
      '<div class="v-meta">' + escHtml(v.title || "không tên") + " · " + (v.projects || []).length + " truyện · " + chapters + " chương" +
      (v.reason ? " · " + escHtml(v.reason) : "") + "</div></div>" +
      '<div class="df-actions"><button class="btn" data-r>Khôi phục</button></div>';
    el.querySelector("[data-r]").addEventListener("click", async () => {
      const ok = await confirmDialog({
        title: "Khôi phục bản sao",
        body: "Thay toàn bộ nội dung hiện tại bằng bản sao lúc <b>" + escHtml(d.toLocaleString("vi-VN")) + "</b>?",
        warning: "Ảnh không nằm trong bản sao nên sẽ được giữ nguyên theo chương còn trùng mã.",
        confirmLabel: "Khôi phục",
        cancelLabel: "Hủy",
        danger: true,
      });
      if (!ok) return;
      ingestBackupData({ version: 2, exportedAt: v.at, activeProjectId: v.activeProjectId, projects: v.projects }, "replace");
      closeModal(scrim);
      toast("Đã khôi phục bản sao.", "ok");
    });
    box.appendChild(el);
  }
}

/* ---------- chẩn đoán ---------- */
function downloadDiagnostics() {
  const used = storageUsedBytes();
  const text = buildReport({
    version: CZ_VERSION,
    localStorage: !store.__memory,
    indexedDB: idbAvailable(),
    storageUsed: used < 0 ? "không đo được" : fmtBytes(used),
    projects: state.projects.length,
  });
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "chuseoz-chan-doan-" + new Date().toISOString().slice(0, 10) + ".txt";
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  toast("Đã tải báo cáo chẩn đoán (" + getEntries().length + " mục nhật ký).", "ok");
}

/* ---------- xuất Markdown / văn bản thô ---------- */
function downloadTextFile(name, content, mime) {
  const blob = new Blob([content], { type: (mime || "text/plain") + ";charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
function exportMarkdown() {
  const p = activeProject();
  if (!p) return;
  if (p.blocks.every(b => !(b.content || "").trim())) { toast("Chưa có nội dung để xuất.", "err"); return; }
  const md = blocksToMarkdown(p.blocks, { storyTitle: p.title });
  const name = safeFileName(p.title, "truyen") + ".md";
  downloadTextFile(name, md, "text/markdown");
  toast('Đã xuất "' + name + '".', "ok");
}
function exportPlainText() {
  const p = activeProject();
  if (!p) return;
  if (p.blocks.every(b => !(b.content || "").trim())) { toast("Chưa có nội dung để xuất.", "err"); return; }
  const txt = blocksToPlainText(p.blocks, { storyTitle: p.title });
  const name = safeFileName(p.title, "truyen") + ".txt";
  downloadTextFile(name, txt, "text/plain");
  toast('Đã xuất "' + name + '".', "ok");
}

/* ---------- nhãn dán cho chương đang chọn ---------- */
function insertStickerToFocused() {
  const p = activeProject();
  if (!p) return;
  const b = p.blocks.find(x => x.id === state.focusedBlock) || p.blocks[0];
  const card = document.querySelector('.chapter[data-bid="' + b.id + '"]');
  const ed = card && card.querySelector(".ch-content");
  if (!ed) return;
  ed.focus();
  openStickerPicker(b, text => {
    ed.focus();
    insertTextAtCaret(ed, text);
  }, () => {
    b.content = editorToText(ed);
    touchProject(p); history.push(p.blocks); saveProjects(); renderPreview(); scheduleOutline();
  });
}

/* ---------- truyện mẫu ---------- */
function sampleStory() {
  const mk = (title, content) => ({
    id: uid("blk_"), title,
    leftChars: DEFAULT_LEFT, rightChars: DEFAULT_RIGHT,
    content, images: {},
  });
  return normalizeProject({
    title: "Truyện mẫu — Buổi chiều ở quán cũ",
    blocks: [
      mk("Chương 1: Quán cũ",
        "Quán vẫn vậy, chỉ có người là khác.\n\n" +
        "Wine: Cậu đến muộn mười phút.\n" +
        "Lal: Xin lỗi, tắc đường kinh khủng.\n\n" +
        "(Nhãn dán: năn nỉ)\n\n" +
        "Wine: <b>Mười phút</b> mà cứ như mười năm.\n" +
        "Lal: Vậy thì tớ bù cho cậu một ly cà phê nhé?\n\n" +
        "Ngoài kia trời bắt đầu tối."),
      mk("Chương 2: Chuyện chưa kể",
        "Lal: Tớ có chuyện muốn nói từ lâu rồi.\n" +
        "Wine: Nói đi, tớ nghe.\n\n" +
        "(Nhãn dán: nghĩ)\n\n" +
        "Lal: <i>Hôm đó tớ không hề bỏ về trước.</i>\n" +
        "Wine: …\n\n" +
        "Ly cà phê nguội dần trên bàn."),
    ],
  });
}
function loadSampleStory() {
  const p = sampleStory();
  state.projects.unshift(p);
  state.activeId = p.id;
  state.focusedBlock = p.blocks[0].id;
  persistNow();
  history.reset(p.blocks);
  $("#storyTitle").value = p.title;
  renderAll();
  toast("Đã nạp truyện mẫu — bạn có thể xóa bất cứ lúc nào.", "ok");
}

/* ---------- xóa trắng truyện hiện tại ---------- */
async function clearStory() {
  const p = activeProject();
  if (!p) return;
  const ok = await confirmDialog({
    title: "Xóa nội dung truyện",
    body: 'Xóa trắng nội dung truyện <span class="cb-strong">“' + escHtml(currentStoryTitle()) + "”</span>?",
    warning: "Các truyện khác vẫn an toàn. Có thể hoàn tác bằng Ctrl+Z ngay sau đó.",
    confirmLabel: "Xóa nội dung",
    cancelLabel: "Giữ lại",
    danger: true,
  });
  if (!ok) return;
  p.blocks = [makeBlock(null)];
  state.collapsed.clear();
  touchProject(p);
  history.push(p.blocks);
  persistNow();
  $("#storyTitle").value = p.title;
  renderAll();
  toast("Đã xóa nội dung truyện hiện tại — Ctrl+Z để hoàn tác.", "ok");
}

/* ===== HÀNH ĐỘNG DÙNG CHUNG (được gọi từ topbar, menu, bảng lệnh và phím tắt) ===== */
function togglePreview() {
  state.previewOpen = !state.previewOpen;
  $("#preview").classList.toggle("open", state.previewOpen);
  $("#previewToggle").classList.toggle("btn-ink", state.previewOpen);
  $("#previewToggle").setAttribute("aria-pressed", state.previewOpen ? "true" : "false");
  try { store.setItem(KEY_PREVIEW, state.previewOpen ? "1" : "0"); } catch (e) {}
  renderPreview();
  const rz = $("#previewResizer");
  if (rz) rz.classList.toggle("on", state.previewOpen && window.innerWidth > 1280);
}

function addChapter(scrollTo) {
  const p = activeProject();
  if (!p) return;
  const b = makeBlock(p.blocks[p.blocks.length - 1]);
  p.blocks.push(b);
  state.focusedBlock = b.id;
  touchProject(p);
  history.push(p.blocks);
  persistNow();
  renderChapters(); renderRail();
  schedulePreview();
  if (scrollTo !== false) {
    const cards = $("#chapters").children;
    if (cards.length) {
      const last = cards[cards.length - 1];
      last.querySelector(".ch-title").focus();
      try { last.scrollIntoView({ behavior: "smooth", block: "center" }); } catch (e) {}
    }
  }
}

function undo() {
  const p = activeProject();
  if (!p) return;
  const blocks = history.undo(p.blocks);
  if (!blocks) { toast("Không còn gì để hoàn tác.", "err"); return; }
  p.blocks = blocks;
  touchProject(p); persistNow(); renderChapters(); renderPreview(); renderOutline(); renderStats();
  toast("Đã hoàn tác.", "ok");
}
function redo() {
  const p = activeProject();
  if (!p) return;
  const blocks = history.redo(p.blocks);
  if (!blocks) { toast("Không còn gì để làm lại.", "err"); return; }
  p.blocks = blocks;
  touchProject(p); persistNow(); renderChapters(); renderPreview(); renderOutline(); renderStats();
  toast("Đã làm lại.", "ok");
}

let syncThemeUi = () => {};

/* ===== KHỞI TẠO ===== */
function init() {
  installGlobalHandlers();
  logInfo("boot", "khởi động Chuseoz " + CZ_VERSION);

  $("#burger").innerHTML = icon("menu");
  $("#btnFind").innerHTML = icon("search") + ' <span class="blabel">Tìm</span>';
  $("#btnPalette").innerHTML = icon("command");
  $("#previewToggle").innerHTML = icon("eye") + ' <span class="blabel">Xem trước</span>';
  $("#btnFocus").innerHTML = icon("focus") + ' <span class="blabel">Tập trung</span>';
  $("#exitFocus").innerHTML = icon("unfocus") + ' <span class="blabel">Thoát tập trung</span>';
  $("#btnWord").innerHTML = icon("doc") + ' <span class="blabel">Xuất Word</span>';
  $("#btnCode").innerHTML = icon("code") + ' <span class="blabel">Tạo mã HTML</span>';
  $("#moreBtn").innerHTML = icon("dots");
  $("#btnNewStory").innerHTML = icon("plus") + ' <span class="rl">Truyện mới</span>';
  $("#addChapter").innerHTML = icon("plus") + " Thêm chương";
  $("#mBackupDl").innerHTML = icon("download") + " Tải backup (.json)" + '<span class="m-kbd kbd"></span>';
  $("#mBackupUl").innerHTML = icon("upload") + " Nạp backup từ máy…";
  $("#mHistory").innerHTML = icon("history") + " Lịch sử phiên bản…";
  $("#mShrink").innerHTML = icon("image") + " Nén ảnh ngay";
  $("#mShrink").title = "App tự nén ảnh ngầm khi gần đầy bộ nhớ. Bấm đây chỉ khi muốn nén lại toàn bộ ảnh ngay bây giờ.";
  $("#mDrive").innerHTML = icon("cloud") + " Cài đặt Drive…";
  $("#mDriveRestore").innerHTML = icon("refresh") + " Khôi phục từ Drive…";
  $("#mExportMd").innerHTML = icon("md") + " Xuất Markdown (.md)";
  $("#mExportTxt").innerHTML = icon("txt") + " Xuất văn bản thô (.txt)";
  $("#mStickers").innerHTML = icon("sticker") + " Quản lý nhãn dán…";
  $("#mKeys").innerHTML = icon("keyboard") + " Phím tắt" + '<span class="m-kbd kbd">?</span>';
  $("#mDiag").innerHTML = icon("diag") + " Xuất báo cáo chẩn đoán";
  $("#mClear").innerHTML = icon("trash") + " Xóa nội dung truyện này";
  const verEl = $("#menuVer");
  if (verEl) verEl.textContent = "Chuseoz " + CZ_VERSION + " · " + (idbAvailable() ? "IndexedDB sẵn sàng" : "chỉ localStorage");
  try { console.info("[Chuseoz] phiên bản " + CZ_VERSION); } catch (e) {}

  $("#mbCode").innerHTML = icon("code") + " Tạo mã";
  $("#mbWord").innerHTML = icon("doc") + " Word";
  $("#mbPreview").innerHTML = icon("eye") + " Xem";
  $("#mbCode").addEventListener("click", openCodeModal);
  $("#mbWord").addEventListener("click", exportWord);
  $("#mbPreview").addEventListener("click", togglePreview);

  // theme 3 chế độ: sáng / tối / theo hệ thống
  const themeBtn = $("#themeBtn");
  syncThemeUi = () => {
    const pref = getThemePref();
    const dark = document.documentElement.dataset.theme === "dark";
    themeBtn.innerHTML = icon(pref === "auto" ? "monitor" : dark ? "sun" : "moon");
    const label = "Giao diện: " + THEME_LABELS[pref] + " — bấm để đổi";
    themeBtn.title = label;
    themeBtn.setAttribute("aria-label", label);
  };
  initTheme(syncThemeUi);
  themeBtn.addEventListener("click", () => { cycleTheme(); syncThemeUi(); });

  const railEl = $("#rail"), railToggle = $("#railToggle");
  const syncRailUi = () => {
    const c = railEl.classList.contains("collapsed");
    railToggle.innerHTML = icon(c ? "expand" : "collapse");
    railToggle.title = c ? "Mở rộng danh sách" : "Thu gọn danh sách";
    railToggle.setAttribute("aria-label", railToggle.title);
    railToggle.setAttribute("aria-expanded", c ? "false" : "true");
  };
  if (store.getItem(KEY_RAIL_COLLAPSED) === "1") railEl.classList.add("collapsed");
  syncRailUi();
  railToggle.addEventListener("click", () => {
    railEl.classList.toggle("collapsed");
    try { store.setItem(KEY_RAIL_COLLAPSED, railEl.classList.contains("collapsed") ? "1" : "0"); } catch (e) {}
    syncRailUi();
  });

  // hai ngăn trong thanh bên: kho truyện / dàn bài chương
  $("#tabStories").addEventListener("click", () => setRailTab("stories"));
  $("#tabChapters").addEventListener("click", () => setRailTab("chapters"));

  if (store.__memory) {
    $("#storageWarn").innerHTML = "<b>Khung xem trước bị giới hạn.</b> Dữ liệu chỉ lưu tạm trong phiên này. Tải file về và mở bằng trình duyệt để lưu trữ, đồng bộ Drive và dùng đầy đủ tính năng.";
    $("#storageWarn").style.display = "block";
  }

  state.projects = readProjects();
  if (!state.projects.length) state.projects.push(normalizeProject({ blocks: [makeBlock(null)] }));
  const savedActive = store.getItem(KEY_ACTIVE);
  state.activeId = state.projects.some(p => p.id === savedActive) ? savedActive : state.projects[0].id;
  writeProjects(state.projects); // lưu ngay nếu vừa rút gọn token ảnh của dữ liệu cũ
  const p0 = activeProject();
  $("#storyTitle").value = p0 ? p0.title : "";
  if (p0) history.reset(p0.blocks);

  // khung xem trước: hạ ngưỡng xuống 1024px và tôn trọng lựa chọn đã lưu
  state.previewOpen = store.getItem(KEY_PREVIEW) === "1" && window.innerWidth >= 1024;
  if (state.previewOpen) {
    $("#preview").classList.add("open");
    $("#previewToggle").classList.add("btn-ink");
    $("#previewToggle").setAttribute("aria-pressed", "true");
  }
  const syncResizer = initPreviewResizer();
  if (syncResizer) syncResizer();

  if (store.getItem("chuseoz_focus_v1") === "1") toggleFocusMode(true); else toggleFocusMode(false);

  const cfg = cloudCfg();
  if (cfg.url && cfg.key) {
    const cloudAt = Date.parse(store.getItem(KEY_CLOUD_AT) || "");
    setCloudState("saved", "Drive: " + (cloudAt ? "lưu lúc " + fmtTime(cloudAt) : "đã kết nối"));
  }

  renderAll();
  setRailTab("stories");
  updateStorageMeter();
  // Lúc mở trang chỉ nén khi còn ảnh chưa nén hoặc bộ nhớ vượt ngưỡng.
  const needShrink = !store.__memory && (
    storageUsedBytes() > AUTO_SHRINK_AT ||
    collectStoredImages().jobs.some(j => czStrength(j.obj && j.obj.cz) < 0)
  );
  if (needShrink) {
    autoGaveUp = false;
    autoTries = 0;
    shrinkLevel = 0;
    autoShrinkSoon(0);
  }
  if (idbAvailable()) scheduleSnapshot();

  $("#storyTitle").addEventListener("input", ev => {
    const p = activeProject();
    if (!p) return;
    p.title = ev.target.value;
    ev.target.title = ev.target.value || "Truyện chưa đặt tên";
    touchProject(p);
    saveProjects();
    renderRailSoft();
  });

  $("#btnNewStory").addEventListener("click", newStory);
  const storyFilter = $("#storyFilter");
  if (storyFilter) storyFilter.addEventListener("input", () => applyStoryFilter(storyFilter.value));
  $("#btnCode").addEventListener("click", openCodeModal);
  $("#btnWord").addEventListener("click", exportWord);
  $("#btnFind").addEventListener("click", openFindBar);
  $("#btnPalette").addEventListener("click", openPalette);
  $("#btnFocus").addEventListener("click", () => toggleFocusMode());
  $("#exitFocus").addEventListener("click", () => toggleFocusMode(false));
  $("#btnLoadSample").addEventListener("click", loadSampleStory);
  $("#btnShowKeys").addEventListener("click", openShortcuts);
  const openRail = () => {
    $("#rail").classList.add("open");
    $("#railScrim").classList.add("open");
    $("#burger").setAttribute("aria-expanded", "true");
  };
  $("#burger").addEventListener("click", openRail);
  $("#railScrim").addEventListener("click", closeRail);
  $("#previewToggle").addEventListener("click", togglePreview);
  $("#addChapter").addEventListener("click", () => addChapter(true));

  $("#fbClose").innerHTML = icon("x");
  $("#fbPrev").innerHTML = icon("up");
  $("#fbNext").innerHTML = icon("down");
  const scheduleFind = debounce(runFind, 220);
  $("#findInput").addEventListener("input", scheduleFind);
  ["fbCase", "fbWord"].forEach(id => $("#" + id).addEventListener("change", runFind));
  $("#fbNext").addEventListener("click", () => moveHit(1));
  $("#fbPrev").addEventListener("click", () => moveHit(-1));
  $("#fbReplace").addEventListener("click", () => doReplace(false));
  $("#fbReplaceAll").addEventListener("click", () => doReplace(true));
  $("#fbClose").addEventListener("click", closeFindBar);
  $("#findInput").addEventListener("keydown", ev => {
    if (ev.key === "Enter") { ev.preventDefault(); ev.shiftKey ? moveHit(-1) : moveHit(1); }
    if (ev.key === "Escape") { ev.preventDefault(); closeFindBar(); }
  });

  $("#palette").addEventListener("click", ev => {
    if (ev.target === $("#palette")) closePalette();
    const it = ev.target.closest(".pal-item");
    if (it) runPalette(+it.dataset.i);
  });
  $("#palInput").addEventListener("input", renderPalette);
  $("#palInput").addEventListener("keydown", ev => {
    if (ev.key === "ArrowDown") { ev.preventDefault(); movePalette(1); }
    else if (ev.key === "ArrowUp") { ev.preventDefault(); movePalette(-1); }
    else if (ev.key === "Enter") { ev.preventDefault(); runPalette(palIndex); }
    else if (ev.key === "Escape") { ev.preventDefault(); closePalette(); }
  });

  const menu = $("#moreMenu");
  const closeMenu = () => { menu.classList.remove("open"); $("#moreBtn").setAttribute("aria-expanded", "false"); };
  $("#moreBtn").addEventListener("click", ev => {
    ev.stopPropagation();
    const open = !menu.classList.contains("open");
    menu.classList.toggle("open", open);
    $("#moreBtn").setAttribute("aria-expanded", open ? "true" : "false");
  });
  document.addEventListener("click", ev => { if (!ev.target.closest(".menu-wrap")) closeMenu(); });
  menu.addEventListener("click", ev => {
    const b = ev.target.closest("[data-act]");
    if (!b) return;
    closeMenu();
    const act = b.dataset.act;
    if (act === "backup-dl") downloadBackup();
    else if (act === "backup-ul") uploadBackup();
    else if (act === "history") openHistoryModal();
    else if (act === "shrink") { autoGaveUp = false; autoTries = 0; shrinkLevel = 0; shrinkAllImages({ force: true }); }
    else if (act === "drive") openDriveModal();
    else if (act === "drive-restore") driveRestoreModal();
    else if (act === "export-md") exportMarkdown();
    else if (act === "export-txt") exportPlainText();
    else if (act === "stickers") insertStickerToFocused();
    else if (act === "keys") openShortcuts();
    else if (act === "diag") downloadDiagnostics();
    else if (act === "clear") clearStory();
  });

  document.addEventListener("keydown", ev => {
    const mod = ev.ctrlKey || ev.metaKey;
    const tag = (ev.target && ev.target.tagName || "").toLowerCase();
    const typing = tag === "input" || tag === "textarea" || (ev.target && ev.target.isContentEditable);

    if (ev.key === "Escape") {
      if ($("#palette").classList.contains("open")) { closePalette(); return; }
      if ($("#findbar").classList.contains("open")) { closeFindBar(); return; }
      if (state.focusMode) { toggleFocusMode(false); return; }
      closeMenu();
      return;
    }
    if (mod && ev.key === "Enter" && !ev.shiftKey) { ev.preventDefault(); openCodeModal(); return; }
    if (mod && ev.shiftKey && ev.key === "Enter") { ev.preventDefault(); addChapter(true); return; }
    if (mod && ev.key.toLowerCase() === "k") { ev.preventDefault(); openPalette(); return; }
    if (mod && ev.key.toLowerCase() === "f") { ev.preventDefault(); openFindBar(); return; }
    if (mod && ev.key.toLowerCase() === "s") {
      ev.preventDefault();
      const ok = writeProjects(state.projects);
      if (ok) { setSaveText("Đã lưu · " + fmtTime(Date.now()), true); toast("Đã lưu.", "ok"); }
      return;
    }
    // Hoàn tác cấp app chỉ khi con trỏ ngoài ô soạn (trong ô soạn để contenteditable tự lo).
    if (mod && !ev.shiftKey && ev.key.toLowerCase() === "z" && !typing) { ev.preventDefault(); undo(); return; }
    if (mod && ev.key.toLowerCase() === "z" && ev.shiftKey && !typing) { ev.preventDefault(); redo(); return; }
    if (mod && ev.key.toLowerCase() === "y" && !typing) { ev.preventDefault(); redo(); return; }
    if (ev.key === "F9") { ev.preventDefault(); toggleFocusMode(); return; }
    if (!mod && ev.key === "?" && !typing) { ev.preventDefault(); openShortcuts(); }
  });

  window.addEventListener("beforeunload", () => {
    writeProjects(state.projects);
    if (idbAvailable()) pushSnapshot("trước khi đóng trang");
  });
  window.addEventListener("resize", debounce(() => {
    // Dưới ngưỡng thì preview thành panel nổi (CSS lo) — đừng tự đóng kẻo mất nội dung.
    if (syncResizer) syncResizer();
  }, 200));

  logInfo("boot", "sẵn sàng · " + state.projects.length + " truyện · IndexedDB " + (idbAvailable() ? "có" : "không"));
}
init();
