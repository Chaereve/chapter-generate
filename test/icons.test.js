import { describe, expect, it } from "vitest";
import { icon } from "../src/lib/icons.js";

describe("Tabler icon renderer", () => {
  it("inlines the official 24px Tabler outline SVG", () => {
    const markup = icon("search");
    expect(markup).toContain('class="ic icon-tabler icon-tabler-search"');
    expect(markup).toContain('viewBox="0 0 24 24"');
    expect(markup).toContain('stroke-width="2"');
    expect(markup).toContain("<path");
  });

  it("renders all common UI icon aliases and safely falls back for unknown names", () => {
    ["plus", "trash", "doc", "md", "sticker", "sparkle", "collapse", "expand"].forEach(name => {
      expect(icon(name)).toContain("icon-tabler-");
      expect(icon(name)).not.toContain("undefined");
    });
    expect(icon("not-an-icon")).toContain("icon-tabler-file");
  });
});
