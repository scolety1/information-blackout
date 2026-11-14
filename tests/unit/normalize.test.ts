import { describe, expect, it } from "vitest";
import { findPhraseOccurrences, normalizeText } from "../../src/detection/normalize";

describe("normalizeText", () => {
  it("normalizes case, punctuation, whitespace, and diacritics", () => {
    expect(normalizeText("  SÉVERANCE—Finale!!  ")).toBe("severance finale");
  });

  it("turns possessive punctuation into a term boundary", () => {
    expect(normalizeText("Lumon's secret")).toBe("lumon s secret");
  });

  it("retains numbers for sports score detection", () => {
    expect(normalizeText("Celtics 118–110 Nuggets")).toBe("celtics 118 110 nuggets");
  });
});

describe("findPhraseOccurrences", () => {
  it("matches whole normalized phrases case-insensitively", () => {
    expect(findPhraseOccurrences("A SEVERANCE finale", "Severance")).toEqual([2]);
  });

  it("does not match a term inside a larger word", () => {
    expect(findPhraseOccurrences("The severances were filed", "Severance")).toEqual([]);
  });
});
