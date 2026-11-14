import { expect, it } from "vitest";
import { CORPUS_TOPICS } from "../../eval/corpus";
import { scoreTextForTopic } from "../../src/detection/scorer";

it("keeps a future-outcome question benign even when a forum prefix precedes it", () => {
  const result = scoreTextForTopic(
    "Forum post: will Carmy win the award next season.",
    CORPUS_TOPICS.adversarial,
  );
  expect(result.shouldProtect).toBe(false);
  expect(result.explanation.adjustments).toContainEqual({ id: "future-prediction", weight: -4.5 });
});
