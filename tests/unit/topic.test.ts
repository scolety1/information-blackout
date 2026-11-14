import { describe, expect, it, vi } from "vitest";
import { createTopic, isProtectedTopic, parseAliases } from "../../src/shared/topic";

describe("topic model", () => {
  it("parses newline and comma-separated aliases and removes case-insensitive duplicates", () => {
    expect(parseAliases("Lumon\nMark Scout, lumon, Macrodata Refinement")).toEqual([
      "Lumon",
      "Mark Scout",
      "Macrodata Refinement",
    ]);
  });

  it("rejects an empty topic name", () => {
    expect(() => createTopic({ name: "   " })).toThrow("Topic name is required");
  });

  it("creates a locally storable configuration record", () => {
    vi.spyOn(globalThis.crypto, "randomUUID").mockReturnValue("00000000-0000-4000-8000-000000000000");
    const topic = createTopic({ name: " Severance ", aliases: [" Lumon "] });
    expect(topic).toMatchObject({
      id: "00000000-0000-4000-8000-000000000000",
      name: "Severance",
      aliases: ["Lumon"],
      enabled: true,
    });
    expect(isProtectedTopic(topic)).toBe(true);
  });
});
