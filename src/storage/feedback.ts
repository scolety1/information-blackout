import { normalizeText } from "../detection/normalize";
import { TOPIC_LIMITS } from "../shared/topic";
import { loadTopics, saveTopics } from "./topics";

export const FEEDBACK_STORAGE_KEY = "feedbackStats";

export interface TopicFeedbackAggregate {
  falsePositiveCount: number;
  missedSpoilerCount: number;
  aliasesAddedFromReports: number;
}

export interface FeedbackStore {
  schemaVersion: 1;
  byTopic: Record<string, TopicFeedbackAggregate>;
}

const emptyAggregate = (): TopicFeedbackAggregate => ({
  falsePositiveCount: 0,
  missedSpoilerCount: 0,
  aliasesAddedFromReports: 0,
});

const emptyStore = (): FeedbackStore => ({ schemaVersion: 1, byTopic: {} });

function sanitizeCount(value: unknown): number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : 0;
}

export async function loadFeedback(): Promise<FeedbackStore> {
  const values = await chrome.storage.local.get(FEEDBACK_STORAGE_KEY);
  const raw = values[FEEDBACK_STORAGE_KEY];
  if (!raw || typeof raw !== "object") return emptyStore();
  const candidate = raw as { byTopic?: unknown };
  if (!candidate.byTopic || typeof candidate.byTopic !== "object") return emptyStore();

  const byTopic: Record<string, TopicFeedbackAggregate> = {};
  for (const [topicId, value] of Object.entries(candidate.byTopic)) {
    if (!value || typeof value !== "object") continue;
    const aggregate = value as Partial<TopicFeedbackAggregate>;
    byTopic[topicId] = {
      falsePositiveCount: sanitizeCount(aggregate.falsePositiveCount),
      missedSpoilerCount: sanitizeCount(aggregate.missedSpoilerCount),
      aliasesAddedFromReports: sanitizeCount(aggregate.aliasesAddedFromReports),
    };
  }
  return { schemaVersion: 1, byTopic };
}

let updateQueue: Promise<void> = Promise.resolve();

function updateFeedback(
  topicId: string,
  mutate: (aggregate: TopicFeedbackAggregate) => void,
): Promise<void> {
  const task = updateQueue.then(async () => {
    const store = await loadFeedback();
    const aggregate = store.byTopic[topicId] ?? emptyAggregate();
    mutate(aggregate);
    store.byTopic[topicId] = aggregate;
    await chrome.storage.local.set({ [FEEDBACK_STORAGE_KEY]: store });
  });
  updateQueue = task.catch(() => undefined);
  return task;
}

export function recordFalsePositive(topicId: string): Promise<void> {
  return updateFeedback(topicId, (aggregate) => {
    aggregate.falsePositiveCount += 1;
  });
}

export function recordMissedSpoiler(topicId: string, aliasAdded: boolean): Promise<void> {
  return updateFeedback(topicId, (aggregate) => {
    aggregate.missedSpoilerCount += 1;
    if (aliasAdded) aggregate.aliasesAddedFromReports += 1;
  });
}

export async function addExplicitAlias(topicId: string, phrase: string): Promise<boolean> {
  const normalizedPhrase = normalizeText(phrase);
  if (normalizedPhrase.length < 2) return false;
  const topics = await loadTopics();
  const target = topics.find((topic) => topic.id === topicId);
  if (!target || target.aliases.length >= TOPIC_LIMITS.maxAliases) return false;
  const existingTerms = [target.name, ...target.aliases].map(normalizeText);
  if (existingTerms.includes(normalizedPhrase)) return false;
  target.aliases.push(phrase.trim().slice(0, TOPIC_LIMITS.maxAliasLength));
  await saveTopics(topics);
  return true;
}
