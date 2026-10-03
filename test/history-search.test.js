import { describe, it, expect, beforeEach } from "vitest";
import { findIn, replaceIn, replaceAt, findAcross, textStats } from "../src/lib/search.js";
import { createHistory } from "../src/lib/history.js";

const OPTS_CI = { caseSensitive: false, wholeWord: false };

describe("findIn", () => {
  it("tìm không phân biệt hoa thường theo mặc định", () => {
    expect(findIn("Wine chào wine", "WINE", OPTS_CI)).toHaveLength(2);
  });
  it("phân biệt hoa thường khi bật tuỳ chọn", () => {
    expect(findIn("Wine chào wine", "WINE", { caseSensitive: true })).toHaveLength(0);
  });
  it("đúng vị trí và độ dài", () => {
    expect(findIn("abc XYZ def", "XYZ", OPTS_CI)).toEqual([{ index: 4, length: 3 }]);
  });
  it("cả từ — tiếng Việt có dấu vẫn đúng", () => {
    const text = "Lal đang lalala với Lal";
    expect(findIn(text, "Lal", { ...OPTS_CI, wholeWord: true })).toHaveLength(2);
    expect(findIn(text, "Lal", OPTS_CI)).toHaveLength(3);
  });
  it("trả về rỗng khi query rỗng", () => {
    expect(findIn("abc", "", OPTS_CI)).toEqual([]);
  });
  it("không treo với ký tự đặc biệt regex", () => {
    expect(findIn("giá (a+b) đây", "(a+b)", OPTS_CI)).toHaveLength(1);
  });
});

describe("replaceIn / replaceAt", () => {
  it("thay tất cả và đếm đúng", () => {
    const r = replaceIn("a b a b a", "a", "X", OPTS_CI);
    expect(r.text).toBe("X b X b X");
    expect(r.count).toBe(3);
  });
  it("thay đúng 1 chỗ theo vị trí", () => {
    const hits = findIn("abcabc", "b", OPTS_CI);
    expect(replaceAt("abcabc", hits[1], "Z").text).toBe("abcaZc");
  });
  it("không đổi gì khi không khớp", () => {
    expect(replaceIn("abc", "zzz", "X", OPTS_CI)).toEqual({ text: "abc", count: 0 });
  });
});

describe("findAcross", () => {
  it("gom kết quả nhiều chương kèm id", () => {
    const items = [{ id: "b1", text: "Wine: hi" }, { id: "b2", text: "Wine lại đây, Wine" }];
    const hits = findAcross(items, "Wine", OPTS_CI);
    expect(hits).toHaveLength(3);
    expect(hits[0].itemId).toBe("b1");
    expect(hits[1].itemId).toBe("b2");
  });
});

describe("textStats", () => {
  it("đếm ký tự, từ và phút đọc", () => {
    const s = textStats("Một hai ba bốn");
    expect(s.chars).toBe(14);
    expect(s.words).toBe(4);
    expect(s.minutes).toBe(1);
  });
  it("bỏ thẻ khi đếm từ", () => {
    expect(textStats("<b>đậm</b> thường").words).toBe(2);
  });
  it("rỗng thì 0", () => {
    expect(textStats("")).toEqual({ chars: 0, words: 0, minutes: 0 });
  });
});

describe("createHistory — hoàn tác / làm lại", () => {
  const mk = (id, content) => ({ id, title: id, leftChars: "", rightChars: "", content, images: {} });
  let h;
  beforeEach(() => { h = createHistory({ limit: 5 }); });

  it("không ghi khi nội dung không đổi", () => {
    const blocks = [mk("a", "x")];
    h.reset(blocks);
    expect(h.push(blocks)).toBe(false);
    expect(h.canUndo()).toBe(false);
  });

  it("undo trả về nội dung cũ", () => {
    const blocks = [mk("a", "v1")];
    h.reset(blocks);
    blocks[0].content = "v2";
    expect(h.push(blocks)).toBe(true);
    const back = h.undo(blocks);
    expect(back[0].content).toBe("v1");
  });

  it("redo trả về nội dung mới", () => {
    const blocks = [mk("a", "v1")];
    h.reset(blocks);
    blocks[0].content = "v2";
    h.push(blocks);
    h.undo(blocks);
    const fwd = h.redo(blocks);
    expect(fwd[0].content).toBe("v2");
  });

  it("push mới làm rỗng ngăn redo", () => {
    const blocks = [mk("a", "v1")];
    h.reset(blocks);
    blocks[0].content = "v2"; h.push(blocks);
    blocks[0].content = "v3"; h.push(blocks);
    h.undo(blocks);
    expect(h.canRedo()).toBe(true);
    blocks[0].content = "v4"; h.push(blocks);
    expect(h.canRedo()).toBe(false);
  });

  it("giữ block.images khi khôi phục (ảnh không nằm trong snapshot)", () => {
    const blocks = [mk("a", "v1")];
    blocks[0].images = { i1: { src: "data:image/png;base64,AAAA" } };
    h.reset(blocks);
    blocks[0].content = "v2";
    h.push(blocks);
    const back = h.undo(blocks);
    expect(back[0].images.i1.src).toContain("AAAA");
  });

  it("undo khôi phục chương đã xóa", () => {
    const blocks = [mk("a", "1"), mk("b", "2")];
    h.reset(blocks);
    blocks.splice(1, 1);
    h.push(blocks);
    const back = h.undo(blocks);
    expect(back).toHaveLength(2);
    expect(back[1].id).toBe("b");
  });

  it("tôn trọng giới hạn độ sâu", () => {
    const blocks = [mk("a", "0")];
    h.reset(blocks);
    for (let i = 1; i <= 20; i++) { blocks[0].content = String(i); h.push(blocks); }
    expect(h.size).toBe(5);
  });

  it("undo khi rỗng trả về null", () => {
    h.reset([mk("a", "1")]);
    expect(h.undo([mk("a", "1")])).toBeNull();
  });
});
