import { describe, it, expect, beforeEach } from "vitest";
import {
  parseLine,
  parseSmartLine,
  sideOf,
  stripInlineTags,
  escInline,
  textToEditorHtml,
  editorToText,
  pasteHtmlToClean,
} from "../src/lib/parser.js";

describe("parseLine — nhận diện lời thoại", () => {
  it("bắt được 'Tên: lời thoại'", () => {
    expect(parseLine("Wine: chào cậu")).toEqual({ name: "Wine", message: "chào cậu" });
  });

  it("giữ nguyên dấu ':' ở trong lời thoại", () => {
    expect(parseLine("Lal: tỉ lệ là 1:2 nhé")).toEqual({ name: "Lal", message: "tỉ lệ là 1:2 nhé" });
  });

  it("bắt được nhãn dán", () => {
    const r = parseLine("(Nhãn dán: Lal)");
    expect(r.name).toBe("Lal");
    expect(r.message).toBe("(Nhãn dán: Lal)");
  });

  it("trả về null cho dòng thường không có tên", () => {
    expect(parseLine("Gió thổi qua rèm cửa")).toBeNull();
  });

  it("trả về null khi tên chứa dấu câu kết câu", () => {
    expect(parseLine("Ồ. chuyện đó")).toBeNull();
  });

  it("trả về null cho dòng rỗng", () => {
    expect(parseLine("   ")).toBeNull();
    expect(parseLine("")).toBeNull();
    expect(parseLine(null)).toBeNull();
  });

  it("không nhận tên dài hơn 40 ký tự", () => {
    const long = "a".repeat(41) + ": nội dung";
    expect(parseLine(long)).toBeNull();
  });
});

describe("parseSmartLine — nhận diện có <b>/<i>", () => {
  it("giữ thẻ inline trong lời thoại", () => {
    const r = parseSmartLine("Wine: <b>không</b> sao đâu");
    expect(r).toBeTruthy();
    expect(r.name).toBe("Wine");
    expect(r.message).toContain("<b>không</b>");
  });
});

describe("sideOf — chia trái/phải", () => {
  it("tên có trong rightChars thì bên phải", () => {
    expect(sideOf("Lal", "Lullaby, Lal, Thitinan")).toBe("right");
  });
  it("tên không có thì bên trái", () => {
    expect(sideOf("Wine", "Lullaby, Lal, Thitinan")).toBe("left");
  });
  it("không phân biệt hoa thường và khoảng trắng thừa", () => {
    expect(sideOf("lAL", "  Lullaby ,  LAL ")).toBe("right");
  });
  it("rightChars rỗng thì tất cả bên trái", () => {
    expect(sideOf("Ai", "")).toBe("left");
  });
});

describe("stripInlineTags / escInline", () => {
  it("stripInlineTags bỏ <b>/<i>", () => {
    expect(stripInlineTags("<b>a</b><i>b</i>")).toBe("ab");
  });
  it("escInline escape HTML nhưng giữ <b>/<i>", () => {
    expect(escInline('<b>x</b><script>alert(1)</script>')).toBe(
      "<b>x</b>&lt;script&gt;alert(1)&lt;/script&gt;",
    );
  });
});

describe("textToEditorHtml / editorToText — vòng lặp 2 chiều", () => {
  it("escape HTML khi nạp vào contenteditable", () => {
    expect(textToEditorHtml('<img src=x onerror="alert(1)">')).toBe(
      "&lt;img src=x onerror=\"alert(1)\"&gt;",
    );
  });
  it("giữ <b>/<i> thành thẻ thật", () => {
    expect(textToEditorHtml("a <b>b</b> <i>c</i>")).toBe("a <b>b</b> <i>c</i>");
  });
});

describe("editorToText — đọc DOM ra văn bản", () => {
  let host;
  beforeEach(() => {
    host = document.createElement("div");
    document.body.appendChild(host);
  });

  const round = (html) => {
    host.innerHTML = html;
    return editorToText(host);
  };

  it("xuống dòng theo <br> và <div>", () => {
    expect(round("a<br>b")).toBe("a\nb");
    expect(round("<div>a</div><div>b</div>")).toBe("a\nb\n"); // block element luôn kết bằng \n
  });
  it("giữ <b>/<i>", () => {
    expect(round("a <b>đậm</b> c")).toBe("a <b>đậm</b> c");
    expect(round("<i>nghiêng</i>")).toBe("<i>nghiêng</i>");
  });
  it("biến <img> thành token [[IMG:...]]", () => {
    expect(round('<img src="https://x/a.png"/>')).toBe("\n[[IMG:https://x/a.png]]\n");
  });
  it("loại ảnh javascript: (chống XSS)", () => {
    expect(round('<img src="javascript:alert(1)"/>')).toBe("");
  });
  it("gỡ script khi dán HTML", () => {
    // eslint-disable-next-line no-useless-escape
    const out = pasteHtmlToClean("<p>an toàn</p><script>alert(1)<\/script>");
    expect(out).toBe("an toàn");
    expect(out).not.toContain("alert");
  });
  it("thay &nbsp; bằng khoảng trắng thường", () => {
    expect(round("a\u00a0b")).toBe("a b");
  });
  it("không để quá 2 xuống dòng liên tiếp", () => {
    expect(round("<div>a</div><div></div><div></div><div></div><div>b</div>")).not.toMatch(/\n{3,}/);
  });
});
