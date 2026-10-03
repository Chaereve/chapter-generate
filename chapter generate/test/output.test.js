import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { buildPart1, buildPart2 } from "../src/lib/blogHtml.js";
import { crc32, zipStore, wRun, wPara, inlineRunParts } from "../src/lib/docx.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distHtml = (() => {
  try { return readFileSync(path.join(__dirname, "..", "dist", "index.html"), "utf8"); }
  catch (e) { return ""; }
})();

describe("buildPart1 — CSS/JS nhúng vào bài Blogger", () => {
  const css = buildPart1();

  it("có đủ class mà buildPart2 sinh ra", () => {
    ["chapter-container", "chapter-page", "chapter-title", "chapter-content", "chat-container", "msg", "pagination-container", "page-btn"]
      .forEach((c) => expect(css).toContain("." + c));
  });

  it("tên nhân vật đạt tương phản AA (>=4.5:1) trên cả 2 nền bong bóng", () => {
    const lum = (hex) => {
      const n = parseInt(hex.replace("#", ""), 16);
      const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
      return 0.2126 * f((n >> 16) & 255) + 0.7152 * f((n >> 8) & 255) + 0.0722 * f(n & 255);
    };
    const ratio = (a, b) => {
      const l1 = lum(a), l2 = lum(b);
      return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
    };
    const nameColor = (css.match(/\.msg b \{[^}]*color: (#[0-9a-f]{6})/i) || [])[1];
    const left = (css.match(/\.msg\.left \{[^}]*background: (#[0-9a-f]{6})/i) || [])[1];
    const right = (css.match(/\.msg\.right \{[^}]*background: (#[0-9a-f]{6})/i) || [])[1];
    expect(nameColor).toBeTruthy();
    expect(ratio(nameColor, left)).toBeGreaterThanOrEqual(4.5);
    expect(ratio(nameColor, right)).toBeGreaterThanOrEqual(4.5);
  });

  it("không đóng thẻ script sớm (làm hỏng file khi nhúng inline)", () => {
    expect(css).toContain("<" + "/script>");
    // chuỗi này phải nằm trong CDATA
    expect(css).toContain("//<![CDATA[");
  });
});

describe("buildPart2 — HTML bài viết", () => {
  const blocks = [
    {
      title: "Chương 1",
      rightChars: "Lal",
      content: "Mở đầu.\n\nWine: chào\nLal: <b>chào lại</b>\n\n(Nhãn dán: cười)\n\n[[IMG:https://x/a.png]]",
      images: {},
    },
    { title: "Chương 2", rightChars: "Lal", content: "Wine: tiếp nhé", images: {} },
  ];
  const html = buildPart2(blocks);

  it("chia đúng số trang + nút điều hướng", () => {
    expect(html.match(/class="chapter-page/g)).toHaveLength(2);
    expect(html.match(/class="page-btn/g)).toHaveLength(2);
    expect(html).toContain('id="page-1"');
    expect(html).toContain('id="btn-2"');
  });

  it("trang đầu active, các trang sau ẩn", () => {
    expect(html).toContain('class="chapter-page active" id="page-1"');
    expect(html).toContain('class="chapter-page" id="page-2"');
  });

  it("chia bong bóng trái/phải theo rightChars", () => {
    expect(html).toContain('<div class="msg left"><b>Wine</b>chào</div>');
    expect(html).toContain('<div class="msg right"><b>Lal</b><b>chào lại</b></div>');
  });

  it("ảnh thành thẻ img có loading=lazy", () => {
    expect(html).toContain('<img class="story-inline-image" src="https://x/a.png" alt="" loading="lazy" />');
  });

  it("CHỐNG XSS: script và thuộc tính sự kiện bị escape", () => {
    const evil = [{
      title: '<img src=x onerror="alert(1)">',
      rightChars: "",
      content: '<script>alert("x")' + "</scr" + "ipt>\nKẻ xấu: <img src=y onerror=\"alert(2)\">",
      images: {},
    }];
    const out = buildPart2(evil);
    // thẻ do người dùng gõ phải bị escape thành văn bản, không tạo được thẻ thật
    expect(out).not.toContain("<script>");
    expect(out).toContain("&lt;script&gt;");
    expect(out).toContain("&lt;img src=y onerror=");   // vẫn là text, không phải attribute
    expect(out.match(/<img\b/g) || []).toHaveLength(0);   // không có thẻ <img> nào được tạo
    const openB = (out.match(/<b>/g) || []).length;
    const closeB = (out.match(/<\/b>/g) || []).length;
    expect(openB).toBe(closeB);   // thẻ <b> luôn đóng đủ, không lệch
  });

  it("ảnh javascript: không được chèn", () => {
    const evil = [{
      title: "x", rightChars: "",
      content: "[[IMG:javascript:alert(1)]]",
      images: { "javascript:alert(1)": { src: "javascript:alert(1)" } },
    }];
    expect(buildPart2(evil)).not.toContain("javascript:");
  });
});

describe("docx — nén ZIP và XML Word", () => {
  it("crc32 đúng với giá trị chuẩn", () => {
    const enc = new TextEncoder();
    expect(crc32(enc.encode("123456789"))).toBe(0xCBF43926);
    expect(crc32(enc.encode(""))).toBe(0);
  });

  it("zipStore tạo chữ ký PK và local header đúng", () => {
    const enc = new TextEncoder();
    const zip = zipStore([{ name: "a.txt", data: enc.encode("hello") }]);
    expect(zip[0]).toBe(0x50); // 'P'
    expect(zip[1]).toBe(0x4b); // 'K'
    expect(zip[2]).toBe(0x03);
    expect(zip[3]).toBe(0x04);
    // có cả central directory
    const s = new TextDecoder("latin1").decode(zip);
    expect(s).toContain("a.txt");
    expect(s).toContain("hello");
  });

  it("wRun escape XML", () => {
    expect(wRun('a & b <c> "d"')).toContain("&amp;");
    expect(wRun("a & b <c>")).not.toContain("<c>");
  });

  it("wPara bọc w:p", () => {
    expect(wPara("<w:r/>", "")).toBe("<w:p><w:r/></w:p>");
    expect(wPara("x", "<w:jc/>")).toContain("<w:pPr><w:jc/></w:pPr>");
  });

  it("inlineRunParts tách đậm/nghiêng", () => {
    expect(inlineRunParts("a<b>b</b><i>c</i>")).toEqual([
      { text: "a", bold: false, italic: false },
      { text: "b", bold: true, italic: false },
      { text: "c", bold: false, italic: true },
    ]);
  });
});

describe("file dist/index.html sau build", () => {
  it("là MỘT file duy nhất, không tham chiếu script/css bên ngoài", () => {
    if (!distHtml) return; // chưa build — bỏ qua
    expect(distHtml).not.toMatch(/<script[^>]+src="(?!data:)/);
    expect(distHtml).not.toMatch(/<link[^>]+rel="stylesheet"/);
  });
  it("không còn dấu vết của app React cũ", () => {
    if (!distHtml) return;
    expect(distHtml).not.toContain("react-dom");
    expect(distHtml).not.toContain("createRoot");
  });
  it("có meta mô tả và lang=vi", () => {
    if (!distHtml) return;
    expect(distHtml).toContain('<html lang="vi">');
    expect(distHtml).toContain('name="description"');
  });
});
