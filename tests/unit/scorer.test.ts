import { describe, expect, it } from "vitest";
import {
  DETECTION_CONSTANTS,
  findBestDetection,
  scoreTextForTopic,
} from "../../src/detection/scorer";
import { nuggetsTopic, severanceTopic } from "../helpers/topics";

describe("deterministic spoiler scorer", () => {
  it("records an exact topic-name match without treating it alone as a spoiler", () => {
    const result = scoreTextForTopic("I started watching Severance this week.", severanceTopic());
    expect(result.matchedTerms).toContain("Severance");
    expect(result.shouldProtect).toBe(false);
  });

  it("is insensitive to case and punctuation", () => {
    const result = scoreTextForTopic("SEVERANCE — FINALE twist revealed!", severanceTopic());
    expect(result.shouldProtect).toBe(true);
  });

  it("protects an obvious ending-explained headline", () => {
    const result = scoreTextForTopic("Major Severance ending explained", severanceTopic());
    expect(result.shouldProtect).toBe(true);
    expect(result.matchedIndicators).toContain("ending-explained");
  });

  it("uses an alias plus nearby spoiler language", () => {
    const result = scoreTextForTopic("Lumon's biggest secret has finally been revealed.", severanceTopic());
    expect(result.shouldProtect).toBe(true);
    expect(result.matchedTerms).toContain("Lumon");
  });

  it("does not treat multiple protected terms as reveal evidence by themselves", () => {
    const result = scoreTextForTopic("Severance returns to Lumon with Mark Scout.", severanceTopic());
    expect(result.shouldProtect).toBe(false);
    expect(result.reasons).toContain("multiple protected terms");
  });

  it("does not double count an alias nested inside the full topic name", () => {
    const result = scoreTextForTopic("Denver Nuggets schedule", nuggetsTopic());
    expect(result.matchedTerms).toEqual(["Denver Nuggets"]);
    expect(result.shouldProtect).toBe(false);
  });

  it("keeps a benign streaming availability reference visible", () => {
    expect(
      scoreTextForTopic("Severance season 1 is available to stream.", severanceTopic()).shouldProtect,
    ).toBe(false);
  });

  it("keeps an alias-only scheduling reference visible", () => {
    expect(
      scoreTextForTopic("The board meeting at Lumon moved to Monday.", severanceTopic()).shouldProtect,
    ).toBe(false);
  });

  it("keeps an ordinary sports schedule reference visible", () => {
    expect(scoreTextForTopic("Denver Nuggets game tonight", nuggetsTopic()).shouldProtect).toBe(false);
  });

  it("protects a sports result with scoreline and championship language", () => {
    const result = scoreTextForTopic(
      "Nuggets defeat Celtics 118-110 in championship game",
      nuggetsTopic(),
    );
    expect(result.shouldProtect).toBe(true);
    expect(result.matchedIndicators).toEqual(
      expect.arrayContaining(["defeated", "scoreline", "champion"]),
    );
  });

  it("does not protect unrelated spoiler-indicator noise", () => {
    const result = scoreTextForTopic(
      "The winner discussed death, finale, score, ending, and a twist.",
      severanceTopic(),
    );
    expect(result.matchedTerms).toEqual([]);
    expect(result.shouldProtect).toBe(false);
  });

  it("does not protect content for a disabled topic", () => {
    const result = scoreTextForTopic(
      "Severance finale ending explained",
      severanceTopic({ enabled: false }),
    );
    expect(result.score).toBeGreaterThanOrEqual(DETECTION_CONSTANTS.threshold);
    expect(result.shouldProtect).toBe(false);
  });

  it("supports an explicitly stricter threshold", () => {
    const result = scoreTextForTopic("Severance finale revealed", severanceTopic(), 20);
    expect(result.shouldProtect).toBe(false);
    expect(result.threshold).toBe(20);
  });

  it("selects the strongest matching enabled topic", () => {
    const result = findBestDetection(
      "Nuggets defeat Celtics 118-110 in championship game",
      [severanceTopic(), nuggetsTopic()],
    );
    expect(result?.topicName).toBe("Denver Nuggets");
  });
});
