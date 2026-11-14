import { describe, expect, it } from "vitest";
import { scoreTextForTopic } from "../../src/detection/scorer";
import { CORPUS_TOPICS } from "../../eval/corpus";

describe("Mission 2 evidence-driven scoring rules", () => {
  it.each([
    ["betrayal", "Mark Scout betrays the Macrodata Refinement team", CORPUS_TOPICS.tv],
    ["survival", "Captain Vale survives and becomes the new commander", CORPUS_TOPICS.movie],
    ["boss identity", "Hollow Regent is the masked final boss", CORPUS_TOPICS.game],
    ["relationship outcome", "Carmy and Claire reunite in the ending", CORPUS_TOPICS.adversarial],
    ["finalist reveal", "Lila Chen and Mateo are the final two contestants", CORPUS_TOPICS.competition],
  ])("protects the measured %s miss class", (_label, text, topic) => {
    expect(scoreTextForTopic(text, topic).shouldProtect).toBe(true);
  });

  it.each([
    ["negation", "No one dies in The Bear; the review only discusses costumes"],
    ["hypothetical", "If The Bear finale revealed an alien, fans would be surprised"],
    ["prediction question", "Will Carmy win the award next season?"],
    ["common-word collision", "A brown bear died near the national park"],
    ["debunked rumor", "The article debunks the false rumor that Carmy died"],
  ])("keeps the measured %s false-positive class visible", (_label, text) => {
    expect(scoreTextForTopic(text, CORPUS_TOPICS.adversarial).shouldProtect).toBe(false);
  });

  it("exposes structured scoring reasons without candidate text", () => {
    const result = scoreTextForTopic("Carmy betrays Sydney in The Bear finale", CORPUS_TOPICS.adversarial);
    expect(result.explanation.termMatches).toEqual(expect.arrayContaining([
      expect.objectContaining({ label: "Carmy", kind: "alias" }),
    ]));
    expect(result.explanation.indicatorMatches).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "betrayal" }),
      expect.objectContaining({ id: "finale" }),
    ]));
    expect(JSON.stringify(result.explanation)).not.toContain("Sydney");
    expect(result.explanation.finalScore).toBe(result.score);
  });
});
