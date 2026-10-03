import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const html = readFileSync(path.join(__dirname, "..", "index.html"), "utf8");

/** Lấy phần <body>…</body> thật của index.html để dựng DOM y hệt trình duyệt. */
function bodyMarkup() {
  const m = html.match(/<body>([\s\S]*)<\/body>/);
  if (!m) throw new Error("không tìm thấy <body> trong index.html");
  return m[1].replace(/<script type="module"[\s\S]*?<\/script>/g, "");
}

describe("Khởi động toàn bộ ứng dụng (smoke test)", () => {
  beforeAll(() => {
    localStorage.clear();
    document.body.innerHTML = bodyMarkup();
    // beforeunload/scroll… không có nghĩa trong happy-dom
    window.HTMLElement.prototype.scrollIntoView = () => {};
  });

  it("app.js nạp và chạy init() không ném lỗi", async () => {
    const errors = [];
    const origError = console.error;
    console.error = (...a) => errors.push(a.join(" "));
    await import("../src/app.js");
    console.error = origError;
    expect(errors).toEqual([]);
  });

  it("dựng sẵn 1 truyện và 1 chương khi chưa có dữ liệu", async () => {
    await import("../src/app.js");
    expect(document.querySelectorAll("#storyList .story-item").length).toBeGreaterThanOrEqual(1);
    expect(document.querySelectorAll("#chapters .chapter").length).toBe(1);
  });

  it("gắn nhãn cho các nút trên topbar", async () => {
    await import("../src/app.js");
    expect(document.querySelector("#btnCode").textContent).toContain("Tạo mã HTML");
    expect(document.querySelector("#btnWord").textContent).toContain("Xuất Word");
    expect(document.querySelector("#addChapter").textContent).toContain("Thêm chương");
  });

  it("mọi id mà app.js truy vấn đều tồn tại trong index.html", async () => {
    const app = readFileSync(path.join(__dirname, "..", "src", "app.js"), "utf8");
    const ids = new Set();
    for (const m of app.matchAll(/\$\("#([\w-]+)"\)/g)) ids.add(m[1]);
    for (const m of app.matchAll(/getElementById\("([\w-]+)"\)/g)) ids.add(m[1]);
    const missing = [...ids].filter((id) => !document.getElementById(id));
    expect(missing).toEqual([]);
  });
});
