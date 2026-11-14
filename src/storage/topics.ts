import {
  TOPIC_LIMITS,
  isProtectedTopic,
  type ProtectedTopic,
} from "../shared/topic";

export const TOPICS_STORAGE_KEY = "protectedTopics";

export async function loadTopics(): Promise<ProtectedTopic[]> {
  const values = await chrome.storage.local.get(TOPICS_STORAGE_KEY);
  const stored = values[TOPICS_STORAGE_KEY];
  if (!Array.isArray(stored)) return [];
  return stored.filter(isProtectedTopic).slice(0, TOPIC_LIMITS.maxTopics);
}

export async function saveTopics(topics: ProtectedTopic[]): Promise<void> {
  const safeTopics = topics.filter(isProtectedTopic).slice(0, TOPIC_LIMITS.maxTopics);
  await chrome.storage.local.set({ [TOPICS_STORAGE_KEY]: safeTopics });
}
