import type { ProtectedTopic } from "../shared/topic";

export const MAX_SEMANTIC_INPUT_CHARACTERS = 1_500;

export function formatSemanticInput(text: string, topic: ProtectedTopic): string {
  const localText = text.trim().replace(/\s+/gu, " ").slice(0, MAX_SEMANTIC_INPUT_CHARACTERS);
  return `Protected topic: ${topic.name}. Candidate region: ${localText}`;
}
