import { BEGIN_MISSED_REPORT, type BeginMissedReportMessage, type BeginMissedReportResponse } from "../shared/messages";
import type { ProtectedTopic } from "../shared/topic";
import { addExplicitAlias, recordFalsePositive, recordMissedSpoiler } from "../storage/feedback";
import { TOPICS_STORAGE_KEY, loadTopics } from "../storage/topics";
import { ContentProtector } from "./protector";
import { MissedSpoilerReporter } from "./reporter";

let protector: ContentProtector | null = null;
let reporter: MissedSpoilerReporter | null = null;
let currentTopics: ProtectedTopic[] = [];

async function boot(): Promise<void> {
  currentTopics = await loadTopics();
  protector = new ContentProtector(document, {
    onFalsePositive: (topicId) => recordFalsePositive(topicId),
  });
  reporter = new MissedSpoilerReporter(document, {
    onSubmit: async ({ topicId, explicitAlias }) => {
      const aliasAdded = explicitAlias.length > 0
        ? await addExplicitAlias(topicId, explicitAlias)
        : false;
      await recordMissedSpoiler(topicId, aliasAdded);
    },
  });
  protector.start(currentTopics);

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== "local" || !changes[TOPICS_STORAGE_KEY]) return;
    void loadTopics().then((topics) => {
      currentTopics = topics;
      protector?.updateTopics(topics);
    });
  });

  chrome.runtime.onMessage.addListener((message: BeginMissedReportMessage, _sender, sendResponse) => {
    if (message?.type !== BEGIN_MISSED_REPORT) return false;
    const started = reporter?.start(currentTopics) ?? false;
    const response: BeginMissedReportResponse = started
      ? { started: true }
      : { started: false, reason: "Add and enable a protected topic first." };
    sendResponse(response);
    return false;
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => void boot(), { once: true });
} else {
  void boot();
}
