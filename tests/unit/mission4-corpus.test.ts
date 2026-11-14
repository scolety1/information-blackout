import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { MISSION4_CASES } from "../../eval/mission4/corpus";

describe("Mission 4 independent development corpus", () => {
  it("is balanced, unique, and split 600/240", () => {
    expect(MISSION4_CASES).toHaveLength(840);
    expect(MISSION4_CASES.filter((x) => x.split === "development")).toHaveLength(600);
    expect(MISSION4_CASES.filter((x) => x.split === "validation")).toHaveLength(240);
    expect(MISSION4_CASES.filter((x) => x.expected === "spoiler")).toHaveLength(420);
    expect(MISSION4_CASES.filter((x) => x.expected === "benign")).toHaveLength(420);
    expect(new Set(MISSION4_CASES.map((x) => x.text)).size).toBe(840);
  });

  it("holds validation entities and scenario families out of rule development", () => {
    const development = MISSION4_CASES.filter((x) => x.split === "development");
    const validation = MISSION4_CASES.filter((x) => x.split === "validation");
    const developmentTopics = new Set(development.map((x) => x.topic.name));
    const developmentFamilies = new Set(development.map((x) => x.family));
    expect(validation.every((x) => !developmentTopics.has(x.topic.name))).toBe(true);
    expect(validation.every((x) => !developmentFamilies.has(x.family))).toBe(true);
  });

  it("matches the recorded corpus checksum", () => {
    const bytes = readFileSync("eval/mission4/development.json");
    expect(createHash("sha256").update(bytes).digest("hex")).toBe("9efe52087ad198a6670a181ee4f5150b9077dce41fcf8a0c5aed2d896eb60be0");
  });
});
