import { describe, expect, it } from "vitest";
import { chunkMarkdown, chunkPages, splitLong } from "../src/lib/chunk";

describe("chunkMarkdown", () => {
  it("keeps the heading path as the section name", () => {
    const md = "# Manual\n\nIntro text.\n\n## Tool Change\n\n### Holders\n\nTighten to 25 N·m.";
    const chunks = chunkMarkdown(md);
    expect(chunks).toEqual([
      { section: "Manual", content: "Intro text." },
      { section: "Manual > Tool Change > Holders", content: "Tighten to 25 N·m." },
    ]);
  });

  it("resets deeper headings when a higher-level heading starts", () => {
    const md = "# A\n## B\n### C\ntext c\n## D\ntext d";
    expect(chunkMarkdown(md).map((c) => c.section)).toEqual(["A > B > C", "A > D"]);
  });

  it("skips headings with no body text", () => {
    const md = "# Title\n## Empty\n## Full\nbody";
    expect(chunkMarkdown(md)).toEqual([{ section: "Title > Full", content: "body" }]);
  });

  it("handles Windows line endings", () => {
    expect(chunkMarkdown("## Alarm\r\nE-21 overload")[0]).toEqual({
      section: "Alarm",
      content: "E-21 overload",
    });
  });
});

describe("splitLong", () => {
  it("does not split short text", () => {
    expect(splitLong("short", 100)).toEqual(["short"]);
  });

  it("splits on paragraph boundaries and respects the limit", () => {
    const p = "x".repeat(60);
    const parts = splitLong([p, p, p].join("\n\n"), 130);
    expect(parts).toHaveLength(2);
    parts.forEach((part) => expect(part.length).toBeLessThanOrEqual(130));
    expect(parts.join("\n\n")).toBe([p, p, p].join("\n\n"));
  });

  it("breaks a single oversized paragraph into pieces", () => {
    const words = Array.from({ length: 100 }, (_, i) => `word${i}`).join(" ");
    const parts = splitLong(words, 120);
    expect(parts.length).toBeGreaterThan(1);
    parts.forEach((part) => expect(part.length).toBeLessThanOrEqual(120));
  });
});

describe("chunkPages", () => {
  it("labels chunks with 1-based page numbers and drops empty pages", () => {
    expect(chunkPages(["first", "  ", "third"])).toEqual([
      { section: "Page 1", content: "first" },
      { section: "Page 3", content: "third" },
    ]);
  });
});
