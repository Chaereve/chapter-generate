import { describe, it, expect } from "vitest";
import { blocksToMarkdown, blocksToPlainText, safeFileName, inlineToMarkdown } from "../src/lib/markdown.js";
import { toggleInline, closestInline, unwrapTag } from "../src/lib/richText.js";

const blocks = [
  {
    id: "b1",
    title: "Chương 1: Quán cũ",
    leftChars: "Wine",
    rightChars: "Lal",
    content: "Quán vẫn vậy.\n\nWine: cậu đến muộn\nLal: <b>xin lỗi</b> nhé\n\n(Nhãn dán: năn nỉ)\n\n[[IMG:https://x/a.png]]",
  },
];

describe("blocksToMarkdown", () => {
  const md = blocksToMarkdown(blocks, { storyTitle: "Truyện của tôi" });

  it("có tiêu đề truyện và chương", () => {
    expect(md).toContain("# Truyện của tôi");
    expect(md).toContain("## Chương 1: Quán cũ");
  });
  it("lời thoại thành **Tên**: nội dung", () => {
    expect(md).toContain("**Wine**: cậu đến muộn");
  });
  it("<b> thành **", () => {
    expect(md).toContain("**Lal**: **xin lỗi** nhé");
  });
  it("nhãn dán giữ nguyên dạng", () => {
    expect(md).toContain("(Nhãn dán: năn nỉ)");
  });
  it("ảnh thành cú pháp markdown", () => {
    expect(md).toContain("![](https://x/a.png)");
  });
  it("không nhúng ảnh khi embedImages=false", () => {
    expect(blocksToMarkdown(blocks, { embedImages: false })).toContain("_(ảnh)_");
  });
});

describe("blocksToPlainText", () => {
  const txt = blocksToPlainText(blocks, { storyTitle: "T" });
  it("bỏ hết thẻ định dạng", () => {
    expect(txt).not.toContain("<b>");
    expect(txt).toContain("Lal: xin lỗi nhé");
  });
  it("ảnh thay bằng [Ảnh]", () => {
    expect(txt).toContain("[Ảnh]");
  });
});

describe("safeFileName", () => {
  it("bỏ ký tự cấm", () => {
    expect(safeFileName('a/b\\c:d*e?"f<g>h|i')).toBe("a-b-c-d-e-f-g-h-i");
  });
  it("rỗng thì dùng fallback", () => {
    expect(safeFileName("   ", "x")).toBe("x");
  });
});

describe("inlineToMarkdown", () => {
  it("đổi <b>/<i>", () => {
    expect(inlineToMarkdown("<b>a</b><i>b</i>")).toBe("**a***b*");
  });
});

describe("toggleInline — thay cho document.execCommand", () => {
  function setup(html) {
    const ed = document.createElement("div");
    ed.contentEditable = "true";
    ed.innerHTML = html;
    document.body.appendChild(ed);
    return ed;
  }
  function selectAll(ed) {
    const r = document.createRange();
    r.selectNodeContents(ed);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(r);
  }
  function selectWord(ed, text) {
    const walker = document.createTreeWalker(ed, NodeFilter.SHOW_TEXT, null);
    let n;
    while ((n = walker.nextNode())) {
      const i = n.nodeValue.indexOf(text);
      if (i >= 0) {
        const r = document.createRange();
        r.setStart(n, i);
        r.setEnd(n, i + text.length);
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(r);
        return true;
      }
    }
    return false;
  }

  it("bôi đen rồi in đậm sẽ bọc <b>", () => {
    const ed = setup("chào cậu");
    selectAll(ed);
    expect(toggleInline(ed, "b")).toBe(true);
    expect(ed.innerHTML).toContain("<b>");
    expect(ed.textContent).toBe("chào cậu");
  });

  it("bật lại lần nữa sẽ bỏ <b>", () => {
    const ed = setup("chào cậu");
    selectAll(ed);
    toggleInline(ed, "b");
    selectAll(ed);
    toggleInline(ed, "b");
    expect(ed.querySelector("b")).toBeNull();
    expect(ed.textContent).toBe("chào cậu");
  });

  it("không tạo thẻ rỗng khi chưa bôi đen và không có từ", () => {
    const ed = setup("");
    const r = document.createRange();
    r.selectNodeContents(ed);
    r.collapse(true);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(r);
    expect(toggleInline(ed, "i")).toBe(false);
    expect(ed.innerHTML).toBe("");
  });

  it("con trỏ đang collapsed trong từ thì tự mở rộng ra trọn từ", () => {
    const ed = setup("một hai ba");
    const node = ed.firstChild;
    const r = document.createRange();
    r.setStart(node, 5); // giữa chữ "hai"
    r.collapse(true);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(r);
    expect(toggleInline(ed, "b")).toBe(true);
    expect(ed.textContent).toBe("một hai ba");
    expect(ed.querySelector("b").textContent).toBe("hai");
  });

  it("bôi đen một phần từ thì chỉ bọc đúng phần đó", () => {
    const ed = setup("một hai ba");
    selectWord(ed, "ha");
    expect(toggleInline(ed, "b")).toBe(true);
    expect(ed.querySelector("b").textContent).toBe("ha");
  });

  it("in nghiêng tạo <i> riêng, không ảnh hưởng <b>", () => {
    const ed = setup("abc def");
    selectWord(ed, "def");
    toggleInline(ed, "i");
    expect(ed.querySelector("i").textContent).toBe("def");
    expect(ed.querySelector("b")).toBeNull();
  });

  it("closestInline nhận ra <strong> như <b>", () => {
    const ed = setup("<strong>x</strong>");
    const node = ed.firstChild.firstChild;
    expect(closestInline(node, "b", ed)).not.toBeNull();
    expect(closestInline(node, "i", ed)).toBeNull();
  });

  it("unwrapTag giữ nội dung", () => {
    const ed = setup("<b>giữ lại</b>");
    unwrapTag(ed.firstChild);
    expect(ed.textContent).toBe("giữ lại");
    expect(ed.querySelector("b")).toBeNull();
  });
});
