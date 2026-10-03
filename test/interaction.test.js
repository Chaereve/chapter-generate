import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const html = readFileSync(path.join(__dirname, "..", "index.html"), "utf8");

function bodyMarkup() {
  const m = html.match(/<body>([\s\S]*)<\/body>/);
  return m[1].replace(/<script type="module"[\s\S]*?<\/script>/g, "");
}

const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
const click = (el) => el.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
const key = (k, opts = {}) =>
  document.dispatchEvent(new KeyboardEvent("keydown", { key: k, bubbles: true, cancelable: true, ...opts }));
const chapters = () => $$("#chapters .chapter");

beforeAll(async () => {
  localStorage.clear();
  document.body.innerHTML = bodyMarkup();
  window.HTMLElement.prototype.scrollIntoView = () => {};
  // happy-dom không có các API tải file — stub để không nổ
  window.URL.createObjectURL = () => "blob:stub";
  window.URL.revokeObjectURL = () => {};
  HTMLAnchorElement.prototype.click = () => {};
  await import("../src/app.js");
});

describe("Tương tác thật qua DOM", () => {
  it("khởi động có đúng 1 chương", () => {
    expect(chapters()).toHaveLength(1);
  });

  it("bấm “Thêm chương” tạo chương 2 và đánh số lại", () => {
    click($("#addChapter"));
    expect(chapters()).toHaveLength(2);
    expect(chapters()[1].querySelector(".ch-index").textContent).toBe("2");
  });

  it("gõ nội dung thì tự lưu xuống localStorage (debounce 400ms)", async () => {
    const ed = chapters()[0].querySelector(".ch-content");
    ed.innerHTML = "Wine: xin chào";
    ed.dispatchEvent(new Event("input", { bubbles: true }));
    // nội dung phải có ngay trong model, không chờ debounce
    expect($("#statsBar").textContent).toContain("ký tự");
    await new Promise((r) => setTimeout(r, 500));
    const raw = localStorage.getItem("chuseoz_saved_story_projects_v1");
    expect(raw).toBeTruthy();
    const data = JSON.parse(raw);
    expect(data.projects[0].blocks[0].content).toContain("Wine: xin chào");
    expect($("#saveStatus").classList.contains("saved")).toBe(true);
  });

  it("thanh thống kê hiện số chương và ký tự", () => {
    const txt = $("#statsBar").textContent;
    expect(txt).toContain("chương");
    expect(txt).toContain("ký tự");
  });

  it("dàn bài chương liệt kê đủ chương và nhảy được", () => {
    click($("#tabChapters"));
    expect($("#chapterOutline").classList.contains("open")).toBe(true);
    expect($$("#chapterOutline .ol-item")).toHaveLength(2);
    click($("#tabStories"));
    expect($("#storyList").classList.contains("hidden")).toBe(false);
  });

  it("Ctrl+K mở bảng lệnh, gõ lọc được, Esc đóng", () => {
    key("k", { ctrlKey: true });
    expect($("#palette").classList.contains("open")).toBe(true);
    $("#palInput").value = "Markdown";
    $("#palInput").dispatchEvent(new Event("input", { bubbles: true }));
    const items = $$("#palList .pal-item");
    expect(items.length).toBeGreaterThan(0);
    expect(items[0].textContent).toContain("Markdown");
    key("Escape");
    expect($("#palette").classList.contains("open")).toBe(false);
  });

  it("chế độ tập trung ẩn thanh bên và khung xem trước", () => {
    click($("#btnFocus"));
    expect(document.body.classList.contains("focusmode")).toBe(true);
    click($("#exitFocus"));
    expect(document.body.classList.contains("focusmode")).toBe(false);
  });

  it("Ctrl+F mở thanh tìm và đếm kết quả", () => {
    key("f", { ctrlKey: true });
    expect($("#findbar").classList.contains("open")).toBe(true);
    $("#findInput").value = "xin chào";
    $("#findInput").dispatchEvent(new Event("input", { bubbles: true }));
    return new Promise((r) => setTimeout(r, 320)).then(() => {
      expect($("#findCount").textContent).toContain("1");
      click($("#fbClose"));
      expect($("#findbar").classList.contains("open")).toBe(false);
    });
  });

  it("thu gọn chương ẩn phần thân", () => {
    const card = chapters()[0];
    click(card.querySelector('[data-t="caret"]'));
    expect($("#chapters .chapter").classList.contains("collapsed")).toBe(true);
    click($("#chapters .chapter").querySelector('[data-t="caret"]'));
    expect($("#chapters .chapter").classList.contains("collapsed")).toBe(false);
  });

  it("xóa chương hiện hộp thoại xác nhận riêng (không dùng confirm gốc)", () => {
    const before = chapters().length;
    click(chapters()[1].querySelector('[data-t="del"]'));
    return new Promise((r) => setTimeout(r, 20)).then(() => {
      const modal = $(".modal-scrim");
      expect(modal).toBeTruthy();
      expect(modal.textContent).toContain("Xóa chương");
      // nút phải ghi rõ hành động, không phải "OK"
      const labels = $$(".modal-foot button").map((b) => b.textContent.trim());
      expect(labels).toContain("Xóa chương");
      expect(labels).toContain("Giữ lại");
      click($$(".modal-foot button").find((b) => b.textContent.trim() === "Xóa chương"));
      return new Promise((r2) => setTimeout(r2, 20)).then(() => {
        expect(chapters()).toHaveLength(before - 1);
      });
    });
  });

  it("Ctrl+Z hoàn tác việc xóa chương", () => {
    key("z", { ctrlKey: true });
    return new Promise((r) => setTimeout(r, 20)).then(() => {
      expect(chapters()).toHaveLength(2);
    });
  });

  it("đổi giao diện đi qua 3 chế độ và ghi lại lựa chọn", () => {
    const seen = [];
    for (let i = 0; i < 3; i++) {
      click($("#themeBtn"));
      seen.push(localStorage.getItem("chuseoz_theme_v1"));
    }
    expect(new Set(seen).size).toBe(3);
    expect(seen.every((v) => ["auto", "light", "dark"].includes(v))).toBe(true);
  });

  it("nút icon nào cũng có nhãn cho trình đọc màn hình", () => {
    const missing = $$(".iconbtn").filter((b) => !b.getAttribute("aria-label"));
    expect(missing.map((b) => b.id || b.dataset.t || b.className)).toEqual([]);
  });

  it("mọi nhãn <label> trong thẻ chương đều trỏ tới một input", () => {
    const broken = $$("label[for]").filter((l) => !document.getElementById(l.getAttribute("for")));
    expect(broken.map((l) => l.getAttribute("for"))).toEqual([]);
  });

  it("menu ⋯ mở/đóng và cập nhật aria-expanded", () => {
    click($("#moreBtn"));
    expect($("#moreMenu").classList.contains("open")).toBe(true);
    expect($("#moreBtn").getAttribute("aria-expanded")).toBe("true");
    key("Escape");
    expect($("#moreMenu").classList.contains("open")).toBe(false);
    expect($("#moreBtn").getAttribute("aria-expanded")).toBe("false");
  });

  it("nạp truyện mẫu tạo truyện mới có nội dung", () => {
    const before = $$("#storyList .story-item").length;
    click($("#btnLoadSample"));
    return new Promise((r) => setTimeout(r, 20)).then(() => {
      expect($$("#storyList .story-item")).toHaveLength(before + 1);
      expect($("#storyTitle").value).toContain("Truyện mẫu");
      expect(chapters().length).toBeGreaterThanOrEqual(2);
    });
  });
});
