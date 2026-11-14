import { describe, expect, it } from "vitest";
import { CORPUS_CASES } from "../../eval/corpus";

describe("labeled evaluation corpus", () => {
  it("contains at least 300 unique, balanced synthetic cases", () => {
    expect(CORPUS_CASES.length).toBeGreaterThanOrEqual(300);
    expect(new Set(CORPUS_CASES.map((item) => item.id)).size).toBe(CORPUS_CASES.length);
    expect(new Set(CORPUS_CASES.map((item) => item.text)).size).toBe(CORPUS_CASES.length);
    expect(CORPUS_CASES.filter((item) => item.expected === "spoiler")).toHaveLength(180);
    expect(CORPUS_CASES.filter((item) => item.expected === "benign")).toHaveLength(180);
  });

  it("keeps a separate held-out split for every category", () => {
    const categories = new Set(CORPUS_CASES.map((item) => item.category));
    expect(categories).toEqual(new Set(["tv", "movie", "sports", "game", "book", "competition", "adversarial"]));
    for (const category of categories) {
      const categoryCases = CORPUS_CASES.filter((item) => item.category === category);
      expect(categoryCases.some((item) => item.split === "calibration")).toBe(true);
      expect(categoryCases.some((item) => item.split === "heldout")).toBe(true);
    }
    expect(CORPUS_CASES.filter((item) => item.split === "calibration")).toHaveLength(288);
    expect(CORPUS_CASES.filter((item) => item.split === "heldout")).toHaveLength(72);
  });

  it("provides reproducible labels, tags, and rationales without exposing rationale to the scorer", () => {
    for (const item of CORPUS_CASES) {
      expect(item.topic.name.length).toBeGreaterThan(0);
      expect(item.text.length).toBeGreaterThan(10);
      expect(item.tags.length).toBeGreaterThan(1);
      expect(item.rationale.length).toBeGreaterThan(10);
      expect(["spoiler", "benign"]).toContain(item.expected);
    }
  });
});
