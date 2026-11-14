import { describe, expect, it } from "vitest";
import { DETECTOR_VERSION, scoreTextForTopic } from "../../src/detection/scorer";
import { severanceTopic, nuggetsTopic } from "../helpers/topics";

describe("Mission 4 structured deterministic policy", () => {
  it.each([
    "I think Mark Scout might betray Lumon when Severance returns.",
    "Did Mark Scout betray Lumon in Severance?",
    "If Mark Scout dies, Severance would lose its emotional center.",
    "No spoilers: the Severance ending is beautifully acted.",
    "Severance begins streaming Friday with restored captions.",
  ])("keeps epistemically benign text visible: %s", (text) => {
    const result = scoreTextForTopic(text, severanceTopic());
    expect(result.shouldProtect).toBe(false);
    expect(result.explanation.benignEvidence.length).toBeGreaterThan(0);
  });

  it("distinguishes a completed sports result from a future fixture", () => {
    expect(scoreTextForTopic("Final: Denver Nuggets defeated Celtics 118-110.", nuggetsTopic()).shouldProtect).toBe(true);
    expect(scoreTextForTopic("Denver Nuggets host Celtics next Tuesday.", nuggetsTopic()).shouldProtect).toBe(false);
  });

  it("publishes structured evidence without candidate text", () => {
    const result = scoreTextForTopic("Severance finale reveals Mark Scout betrayed Lumon.", severanceTopic());
    expect(result.explanation).toMatchObject({ detectorVersion: DETECTOR_VERSION, rulePath: "asserted-reveal", epistemicStatus: "asserted" });
    expect(JSON.stringify(result.explanation)).not.toContain("Mark Scout betrayed");
  });
});
