export interface ProtectedTopic {
  id: string;
  name: string;
  aliases: string[];
  enabled: boolean;
  createdAt: string;
}

export const TOPIC_LIMITS = {
  maxTopics: 100,
  maxNameLength: 120,
  maxAliases: 20,
  maxAliasLength: 120,
} as const;

export function parseAliases(value: string): string[] {
  const seen = new Set<string>();

  return value
    .split(/[\n,]/u)
    .map((alias) => alias.trim())
    .filter((alias) => {
      const key = alias.toLocaleLowerCase();
      if (!alias || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, TOPIC_LIMITS.maxAliases);
}

export function createTopic(input: {
  name: string;
  aliases?: string[];
  enabled?: boolean;
}): ProtectedTopic {
  const name = input.name.trim().slice(0, TOPIC_LIMITS.maxNameLength);
  if (!name) throw new Error("Topic name is required.");

  const aliases = [...new Set((input.aliases ?? []).map((alias) => alias.trim()))]
    .filter(Boolean)
    .map((alias) => alias.slice(0, TOPIC_LIMITS.maxAliasLength))
    .slice(0, TOPIC_LIMITS.maxAliases);

  return {
    id: globalThis.crypto.randomUUID(),
    name,
    aliases,
    enabled: input.enabled ?? true,
    createdAt: new Date().toISOString(),
  };
}

export function isProtectedTopic(value: unknown): value is ProtectedTopic {
  if (!value || typeof value !== "object") return false;
  const topic = value as Partial<ProtectedTopic>;
  return (
    typeof topic.id === "string" &&
    typeof topic.name === "string" &&
    topic.name.trim().length > 0 &&
    Array.isArray(topic.aliases) &&
    topic.aliases.every((alias) => typeof alias === "string") &&
    typeof topic.enabled === "boolean" &&
    typeof topic.createdAt === "string"
  );
}
