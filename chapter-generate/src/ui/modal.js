import { $, icon } from "../lib/util.js";

/* ============================================================
   MODAL — có bẫy focus (focus trap), trả focus về nơi mở, đóng bằng Esc
   ============================================================ */
const FOCUSABLE =
  'a[href],button:not([disabled]),textarea:not([disabled]),input:not([disabled]):not([type="hidden"]),select:not([disabled]),[tabindex]:not([tabindex="-1"])';

let lastFocused = null;

export function openModal(titleHtml, bodyHtml, footHtml, buttons, opts) {
  document.querySelectorAll(".modal-scrim").forEach((m) => closeModal(m));
  const o = opts || {};
  lastFocused = document.activeElement;

  const scrim = document.createElement("div");
  scrim.className = "modal-scrim";
  const btns = (buttons || [])
    .map(
      (b, i) =>
        '<button class="' +
        (b.cls || "btn") +
        '" data-mi="' +
        i +
        '">' +
        b.label +
        "</button>",
    )
    .join("");
  scrim.innerHTML =
    '<div class="modal" role="dialog" aria-modal="true"' +
    (o.labelledBy ? ' aria-labelledby="' + o.labelledBy + '"' : "") +
    (o.width ? ' style="width:min(' + o.width + ',100%)"' : "") +
    '><div class="modal-head">' +
    titleHtml +
    '<button class="iconbtn" data-close aria-label="Đóng">' +
    icon("x") +
    "</button></div>" +
    '<div class="modal-body">' +
    bodyHtml +
    "</div>" +
    (footHtml || btns
      ? '<div class="modal-foot"><span style="flex:1;min-width:0">' + (footHtml || "") + "</span>" + btns + "</div>"
      : "") +
    "</div>";

  const modal = scrim.firstElementChild;
  if (!o.labelledBy) {
    const h = modal.querySelector(".modal-head h2, .modal-head h3");
    if (h) {
      h.id = "modalTitle_" + Math.random().toString(36).slice(2, 8);
      modal.setAttribute("aria-labelledby", h.id);
    }
  }

  document.body.appendChild(scrim);

  scrim.addEventListener("click", (ev) => {
    if (ev.target === scrim || ev.target.closest("[data-close]")) {
      if (o.onClose) o.onClose(scrim);
      closeModal(scrim);
      return;
    }
    const mi = ev.target.closest("[data-mi]");
    if (mi && buttons && buttons[+mi.dataset.mi]) {
      const mb = buttons[+mi.dataset.mi];
      if (mb.onClick) mb.onClick(scrim);
      else closeModal(scrim);
    }
  });

  /* bẫy focus: Tab không thoát ra ngoài modal */
  const trap = (ev) => {
    if (ev.key !== "Tab") return;
    const items = [...modal.querySelectorAll(FOCUSABLE)].filter((el) => el.offsetParent !== null || el === document.activeElement);
    if (!items.length) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (ev.shiftKey && document.activeElement === first) {
      ev.preventDefault();
      last.focus();
    } else if (!ev.shiftKey && document.activeElement === last) {
      ev.preventDefault();
      first.focus();
    }
  };

  const escFn = (ev) => {
    if (ev.key !== "Escape") return;
    ev.stopPropagation();
    if (o.onClose) o.onClose(scrim);
    closeModal(scrim);
  };
  scrim.__escFn = escFn;
  scrim.__trapFn = trap;
  document.addEventListener("keydown", escFn, true);
  modal.addEventListener("keydown", trap);

  /* đưa focus vào ô nhập đầu tiên, nếu không thì nút đầu tiên */
  const auto = modal.querySelector("[data-autofocus]") || modal.querySelector(".modal-body input, .modal-body textarea, .modal-body button") || modal.querySelector("[data-close]");
  if (auto) auto.focus();
  else modal.setAttribute("tabindex", "-1"), modal.focus();

  return scrim;
}

export function closeModal(scrim) {
  if (!scrim) return;
  if (scrim.__escFn) document.removeEventListener("keydown", scrim.__escFn, true);
  scrim.remove();
  if (lastFocused && document.contains(lastFocused)) {
    try { lastFocused.focus(); } catch (e) {}
  }
  lastFocused = null;
}

export function closeAllModals() {
  document.querySelectorAll(".modal-scrim").forEach((m) => closeModal(m));
}

/* ============================================================
   HỘP THOẠI XÁC NHẬN — thay cho confirm() gốc của trình duyệt
   (theme được theo sáng/tối, mô tả rõ ràng, nút đặt tên theo hành động)
   ============================================================ */
export function confirmDialog(cfg) {
  return new Promise((resolve) => {
    let done = false;
    const finish = (v) => {
      if (done) return;
      done = true;
      resolve(v);
    };
    const body =
      '<div class="confirm-body">' +
      (cfg.body || "") +
      (cfg.warning ? '<div class="cb-warn">' + cfg.warning + "</div>" : "") +
      "</div>";
    openModal(
      "<h2>" + (cfg.title || "Xác nhận") + "</h2>",
      body,
      "",
      [
        {
          label: cfg.cancelLabel || "Hủy",
          cls: "btn",
          onClick: (s) => { finish(false); closeModal(s); },
        },
        {
          label: cfg.confirmLabel || "Đồng ý",
          cls: cfg.danger ? "btn btn-primary" : "btn btn-primary",
          onClick: (s) => { finish(true); closeModal(s); },
        },
      ],
      { onClose: () => finish(false), width: cfg.width || "480px" },
    );
  });
}

/* ============================================================
   HỘP THOẠI CHỌN 1 TRONG NHIỀU PHƯƠNG ÁN
   Dùng cho những quyết định không phải "có/không" (VD: GỘP hay THAY THẾ)
   ============================================================ */
export function choiceDialog(cfg) {
  return new Promise((resolve) => {
    let done = false;
    const finish = (v) => {
      if (done) return;
      done = true;
      resolve(v);
    };
    const body = '<div class="confirm-body">' + (cfg.body || "") + "</div>";
    const buttons = cfg.options.map((o) => ({
      label: o.label,
      cls: o.cls || "btn",
      onClick: (s) => { finish(o.value); closeModal(s); },
    }));
    buttons.unshift({
      label: cfg.cancelLabel || "Hủy",
      cls: "btn btn-ghost",
      onClick: (s) => { finish(null); closeModal(s); },
    });
    openModal("<h2>" + (cfg.title || "Chọn") + "</h2>", body, "", buttons, {
      onClose: () => finish(null),
      width: cfg.width || "520px",
    });
  });
}

/** Modal chỉ để hiển thị thông tin, có 1 nút đóng. */
export function infoDialog(cfg) {
  return new Promise((resolve) => {
    openModal(
      "<h2>" + (cfg.title || "") + "</h2>",
      '<div class="confirm-body">' + (cfg.body || "") + "</div>",
      "",
      [{ label: cfg.label || "Đóng", cls: "btn btn-primary", onClick: (s) => { closeModal(s); resolve(true); } }],
      { onClose: () => resolve(false), width: cfg.width || "560px" },
    );
  });
}

/** Modal nhập 1 giá trị. */
export function promptDialog(cfg) {
  return new Promise((resolve) => {
    let done = false;
    const finish = (v) => { if (!done) { done = true; resolve(v); } };
    const id = "prompt_" + Math.random().toString(36).slice(2, 8);
    const body =
      '<div class="field-lg"><label for="' + id + '">' + (cfg.label || "") + "</label>" +
      '<input id="' + id + '" data-autofocus type="text" value="' + String(cfg.value || "").replace(/"/g, "&quot;") + '" placeholder="' + (cfg.placeholder || "") + '"/></div>' +
      (cfg.hint ? '<p style="font-size:12.5px;color:var(--ink2);margin:0">' + cfg.hint + "</p>" : "");
    const read = (s) => {
      const el = s.querySelector("input");
      const v = el ? el.value.trim() : "";
      if (cfg.required && !v) { el.focus(); return undefined; }
      return v;
    };
    openModal(
      "<h2>" + (cfg.title || "Nhập") + "</h2>",
      body,
      "",
      [
        { label: "Hủy", cls: "btn", onClick: (s) => { finish(null); closeModal(s); } },
        {
          label: cfg.okLabel || "OK",
          cls: "btn btn-primary",
          onClick: (s) => { const v = read(s); if (v === undefined) return; finish(v); closeModal(s); },
        },
      ],
      { onClose: () => finish(null), width: "460px" },
    );
  });
}

/** Có modal nào đang mở không. */
export function isModalOpen() {
  return !!$(".modal-scrim");
}
