import { describe, it, expect, beforeAll } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

/**
 * Boot dist/index.html trong DOM — chạy đúng artifact người dùng mở, nên bắt
 * được lỗi chỉ lộ sau khi bundle. Tự skip khi chưa build (dist/ bị gitignore).
 */
const distPath = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "dist", "index.html");
const d = existsSync(distPath) ? describe : describe.skip;

d("dist/index.html (bản build) tự chạy được", () => {
  let html = "";

  beforeAll(() => {
    html = readFileSync(distPath, "utf8");
    const body = html.match(/<body[^>]*>([\s\S]*)<\/body>/);
    if (!body) throw new Error("dist/index.html không có <body>");
    const head = html.match(/<head[^>]*>([\s\S]*)<\/head>/);
    document.documentElement.innerHTML = (head ? head[1] : "") + body[0];
  });

  it("không còn request ra ngoài — tệp tự chứa", () => {
    expect(html).not.toMatch(/<script[^>]+src="\/[^"]*"/);
    expect(html).not.toMatch(/<link[^>]+href="\/[^"]*\.css"/);
    expect(html).toMatch(/<style>[\s\S]{1000,}<\/style>/);
  });

  it("JS không bị đóng thẻ sớm (lỗi </script> trong template literal)", () => {
    // Không đếm thô <script> vs </script>: chuỗi "<script>" nằm trong template
    // literal của HTML Blogger, closer đã escape — đếm thô ra 3 vs 2 là đúng.
    const main = html.match(/<script type="module"[^>]*>([\s\S]*?)<\/script>/);
    expect(main, "không tìm thấy script chính").toBeTruthy();
    const body = main[1];
    expect(body.length).toBeGreaterThan(50000);
    // không dùng "init()" — minifier đổi tên hàm. Chuỗi log thì giữ nguyên.
    expect(body).toContain("sẵn sàng · ");
    expect(body).not.toContain("</script>");
    // mọi lần đóng thẻ bên trong chuỗi phải ở dạng escape
    const escaped = (body.match(/<\\\/script>/g) || []).length;
    expect(escaped).toBeGreaterThan(0);
  });

  it("khung giao diện có đủ các khối chính", () => {
    for (const id of ["topbar", "rail", "shell", "chapters", "addChapter", "preview", "findbar", "palette"]) {
      expect(document.getElementById(id), `thiếu #${id}`).toBeTruthy();
    }
  });

  it("đánh dấu phiên bản trong menu", () => {
    expect(html).toMatch(/3\.0\.\d+/);
  });

  it("chạy JS đã bundle và dựng được giao diện", async () => {
    // innerHTML không tự chạy <script> nên phải eval thủ công.
    localStorage.clear();
    document.body.innerHTML = html.match(/<body[^>]*>([\s\S]*)<\/body>/)[1];
    window.HTMLElement.prototype.scrollIntoView = () => {};

    const body = html.match(/<script type="module"[^>]*>([\s\S]*?)<\/script>/)[1];
    const errors = [];
    const origError = console.error;
    console.error = (...a) => errors.push(a.join(" "));
    try {
      await new Function(`return (async () => { ${body} })()`)();
    } finally {
      console.error = origError;
    }

    expect(errors).toEqual([]);
    // bằng chứng giao diện đã dựng, không phải trang trắng
    expect(document.querySelectorAll("#storyList .story-item").length).toBeGreaterThanOrEqual(1);
    expect(document.querySelectorAll("#chapters .chapter").length).toBeGreaterThanOrEqual(1);
    expect(document.querySelector("#btnWord").textContent).toContain("Xuất Word");
  });
});
