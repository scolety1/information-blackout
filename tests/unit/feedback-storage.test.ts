import { beforeEach, describe, expect, it, vi } from "vitest";
import { FEEDBACK_STORAGE_KEY, addExplicitAlias, loadFeedback, recordFalsePositive, recordMissedSpoiler } from "../../src/storage/feedback";
import { TOPICS_STORAGE_KEY } from "../../src/storage/topics";
import { severanceTopic } from "../helpers/topics";

describe("privacy-preserving feedback storage", () => {
  let stored: Record<string, unknown>;

  beforeEach(() => {
    stored = { [TOPICS_STORAGE_KEY]: [severanceTopic()] };
    vi.stubGlobal("chrome", {
      storage: {
        local: {
          get: vi.fn(async (key: string) => ({ [key]: stored[key] })),
          set: vi.fn(async (values: Record<string, unknown>) => Object.assign(stored, values)),
        },
      },
    });
  });

  it("persists only aggregate counts for false-positive and missed-spoiler feedback", async () => {
    await recordFalsePositive("topic-severance");
    await recordMissedSpoiler("topic-severance", false);
    const feedback = await loadFeedback();
    expect(feedback.byTopic["topic-severance"]).toEqual({
      falsePositiveCount: 1,
      missedSpoilerCount: 1,
      aliasesAddedFromReports: 0,
    });
    const serialized = JSON.stringify(stored[FEEDBACK_STORAGE_KEY]);
    expect(serialized).not.toContain("http");
    expect(serialized).not.toContain("pageText");
    expect(serialized).not.toContain("url");
  });

  it("adds only an alias explicitly typed by the user", async () => {
    expect(await addExplicitAlias("topic-severance", "Helly Riggs")).toBe(true);
    expect(await addExplicitAlias("topic-severance", "helly riggs")).toBe(false);
    const topics = stored[TOPICS_STORAGE_KEY] as Array<{ aliases: string[] }>;
    expect(topics[0]?.aliases).toContain("Helly Riggs");
  });
});
