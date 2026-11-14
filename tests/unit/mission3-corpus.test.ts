import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { ChallengeDocument, ChallengeSplit } from "../../eval/mission3/types";
import { buildTrainingCases } from "../../eval/mission3/training";

const challengePath = resolve("eval/mission3/challenge.json");
const checksumPath = resolve("eval/mission3/challenge.sha256");

describe("Mission 3 frozen OOD corpus", () => {
  it("matches its checksum and has 600 unique balanced cases", async () => {
    const serialized = await readFile(challengePath, "utf8");
    const expected = (await readFile(checksumPath, "utf8")).split(/\s+/u)[0];
    expect(createHash("sha256").update(serialized).digest("hex")).toBe(expected);
    const document = JSON.parse(serialized) as ChallengeDocument;
    expect(document.cases).toHaveLength(600);
    expect(new Set(document.cases.map((item) => item.id)).size).toBe(600);
    expect(new Set(document.cases.map((item) => item.text)).size).toBe(600);
    expect(document.cases.filter((item) => item.expected === "spoiler")).toHaveLength(300);
    expect(document.cases.filter((item) => item.expected === "benign")).toHaveLength(300);
  });

  it("keeps whole entity and linguistic groups separated", async () => {
    const document = JSON.parse(await readFile(challengePath, "utf8")) as ChallengeDocument;
    const splits: ChallengeSplit[] = ["development", "entity-heldout", "linguistic-heldout", "indirect-reveal", "benign-adversarial"];
    for (const split of splits) {
      const values = document.cases.filter((item) => item.split === split);
      expect(values).toHaveLength(120);
      expect(values.filter((item) => item.expected === "spoiler")).toHaveLength(60);
      expect(new Set(values.map((item) => item.topic.name)).size).toBe(60);
    }
    const developmentEntities = new Set(document.cases.filter((item) => item.split === "development").flatMap((item) => [item.topic.name, ...item.topic.aliases]));
    const entityHeldout = new Set(document.cases.filter((item) => item.split === "entity-heldout").flatMap((item) => [item.topic.name, ...item.topic.aliases]));
    expect([...entityHeldout].filter((value) => developmentEntities.has(value))).toEqual([]);
    const developmentFamilies = new Set(document.cases.filter((item) => item.split === "development").flatMap((item) => item.tags.filter((tag) => tag.includes("family-"))));
    const linguisticFamilies = new Set(document.cases.filter((item) => item.split === "linguistic-heldout").flatMap((item) => item.tags.filter((tag) => tag.includes("family-"))));
    expect([...linguisticFamilies].filter((value) => developmentFamilies.has(value))).toEqual([]);
  });

  it("has required category and challenge-slice coverage without training contamination", async () => {
    const document = JSON.parse(await readFile(challengePath, "utf8")) as ChallengeDocument;
    for (const category of ["tv", "movie", "sports", "game", "book", "competition"]) {
      expect(document.cases.filter((item) => item.category === category)).toHaveLength(100);
    }
    expect(document.cases.filter((item) => item.tags.includes("indirect-reveal"))).toHaveLength(120);
    expect(document.cases.filter((item) => item.tags.includes("benign-adversarial"))).toHaveLength(180);
    const training = buildTrainingCases();
    expect(training.cases).toHaveLength(1_200);
    const challengeTexts = new Set(document.cases.map((item) => item.text));
    expect(training.cases.some((item) => challengeTexts.has(item.input))).toBe(false);
  });
});
