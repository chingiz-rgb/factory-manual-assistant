import { describe, expect, it } from "vitest";
import { buildUserPrompt, languageOf, needsTranslation, type Source } from "../src/lib/prompt";
import { reciprocalRankFusion } from "../src/lib/rank";

describe("reciprocalRankFusion", () => {
  it("ranks items found by both searches first", () => {
    const keyword = [1, 2, 3];
    const vector = [4, 3, 5];
    expect(reciprocalRankFusion([keyword, vector])[0]).toBe(3);
  });

  it("works when one list is empty (vector search unavailable)", () => {
    expect(reciprocalRankFusion([[7, 8, 9], []])).toEqual([7, 8, 9]);
  });

  it("returns each id once", () => {
    const fused = reciprocalRankFusion([[1, 2], [2, 1], [1]]);
    expect(fused).toEqual([1, 2]);
  });
});

describe("buildUserPrompt", () => {
  const sources: Source[] = [
    { id: 10, n: 1, document: "CL-200 Manual", section: "Tool Change", content: "Torque 25 N·m." },
    { id: 11, n: 2, document: "Safety", section: "LOTO", content: "Use your own lock." },
  ];

  it("numbers each excerpt and names its document and section", () => {
    const prompt = buildUserPrompt("How tight?", sources);
    expect(prompt).toContain("[1] CL-200 Manual — Tool Change\nTorque 25 N·m.");
    expect(prompt).toContain("[2] Safety — LOTO");
    expect(prompt.trim().endsWith("Question: How tight?")).toBe(true);
  });

  it("says so when there are no excerpts", () => {
    expect(buildUserPrompt("?", [])).toContain("(no excerpts found)");
  });
});

describe("needsTranslation", () => {
  it("detects Japanese and Russian questions", () => {
    expect(needsTranslation("旋盤を始動する前に何を確認すればいいですか？")).toBe(true);
    expect(needsTranslation("Как заменить пластину?")).toBe(true);
  });

  it("keeps English questions, even with codes and units", () => {
    expect(needsTranslation("Alarm E-21 on the CL-200, what now?")).toBe(false);
    expect(needsTranslation("25 N·m?")).toBe(false);
  });

  it("treats mixed Japanese text with an English code as Japanese", () => {
    expect(needsTranslation("E-21のアラームが出ました。どうすればいいですか")).toBe(true);
  });
});

describe("languageOf", () => {
  it("detects the question language by script", () => {
    expect(languageOf("旋盤を始動する前に")).toBe("Japanese");
    expect(languageOf("工具交換")).toBe("Chinese");
    expect(languageOf("Как заменить?")).toBe("Russian");
    expect(languageOf("Alarm E-21?")).toBe("English");
  });

  it("tells the model to answer in Japanese for Japanese questions", () => {
    expect(buildUserPrompt("E-21のアラームは？", [])).toContain("Write the whole answer in Japanese.");
    expect(buildUserPrompt("What is E-21?", [])).not.toContain("Write the whole answer");
  });
});
