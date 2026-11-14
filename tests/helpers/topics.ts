import type { ProtectedTopic } from "../../src/shared/topic";

export function severanceTopic(overrides: Partial<ProtectedTopic> = {}): ProtectedTopic {
  return {
    id: "topic-severance",
    name: "Severance",
    aliases: ["Lumon", "Mark Scout", "Macrodata Refinement"],
    enabled: true,
    createdAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

export function nuggetsTopic(overrides: Partial<ProtectedTopic> = {}): ProtectedTopic {
  return {
    id: "topic-nuggets",
    name: "Denver Nuggets",
    aliases: ["Nuggets", "Jokic", "Nikola Jokic"],
    enabled: true,
    createdAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}
