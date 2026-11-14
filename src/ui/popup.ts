import { BEGIN_MISSED_REPORT, type BeginMissedReportResponse } from "../shared/messages";
import { createTopic, parseAliases, type ProtectedTopic } from "../shared/topic";
import { loadTopics, saveTopics } from "../storage/topics";

function requiredElement<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) throw new Error(`Missing required popup element: ${selector}`);
  return element;
}

const form = requiredElement<HTMLFormElement>("#topic-form");
const nameInput = requiredElement<HTMLInputElement>("#topic-name");
const aliasesInput = requiredElement<HTMLTextAreaElement>("#topic-aliases");
const enabledInput = requiredElement<HTMLInputElement>("#topic-enabled");
const list = requiredElement<HTMLElement>("#topics-list");
const count = requiredElement<HTMLElement>("#topic-count");
const status = requiredElement<HTMLElement>("#status");
const reportButton = requiredElement<HTMLButtonElement>("#report-missed");

let topics: ProtectedTopic[] = [];

function setStatus(message: string, isError = false): void {
  status.textContent = message;
  status.classList.toggle("status-error", isError);
}

function updateReportAvailability(): void {
  reportButton.disabled = !topics.some((topic) => topic.enabled);
}

function makeTopicCard(topic: ProtectedTopic): HTMLElement {
  const card = document.createElement("article");
  card.className = "topic-card";

  const copy = document.createElement("div");
  copy.className = "topic-copy";

  const title = document.createElement("h3");
  title.textContent = topic.name;

  const aliases = document.createElement("p");
  aliases.className = "aliases";
  aliases.textContent = topic.aliases.length > 0 ? topic.aliases.join(" · ") : "No aliases";
  copy.append(title, aliases);

  const actions = document.createElement("div");
  actions.className = "topic-actions";

  const toggleLabel = document.createElement("label");
  toggleLabel.className = "toggle-label";
  const toggle = document.createElement("input");
  toggle.type = "checkbox";
  toggle.checked = topic.enabled;
  toggle.setAttribute("aria-label", `${topic.enabled ? "Disable" : "Enable"} ${topic.name}`);
  const toggleText = document.createElement("span");
  toggleText.textContent = topic.enabled ? "On" : "Off";
  toggle.addEventListener("change", async () => {
    topic.enabled = toggle.checked;
    await saveTopics(topics);
    toggle.setAttribute("aria-label", `${topic.enabled ? "Disable" : "Enable"} ${topic.name}`);
    toggleText.textContent = topic.enabled ? "On" : "Off";
    updateReportAvailability();
    setStatus(`${topic.name} protection ${topic.enabled ? "enabled" : "disabled"}.`);
  });
  toggleLabel.append(toggle, toggleText);

  const remove = document.createElement("button");
  remove.className = "delete-button";
  remove.type = "button";
  remove.textContent = "Delete";
  remove.setAttribute("aria-label", `Delete ${topic.name}`);
  remove.addEventListener("click", async () => {
    topics = topics.filter((candidate) => candidate.id !== topic.id);
    await saveTopics(topics);
    renderTopics();
    setStatus(`${topic.name} deleted.`);
  });

  actions.append(toggleLabel, remove);
  card.append(copy, actions);
  return card;
}

function renderTopics(): void {
  list.replaceChildren();
  count.textContent = String(topics.length);
  updateReportAvailability();

  if (topics.length === 0) {
    const empty = document.createElement("p");
    empty.className = "empty-state";
    empty.textContent = "No topics yet. Add one above to start protecting pages.";
    list.append(empty);
    return;
  }

  topics.forEach((topic) => list.append(makeTopicCard(topic)));
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  setStatus("");

  try {
    const topic = createTopic({
      name: nameInput.value,
      aliases: parseAliases(aliasesInput.value),
      enabled: enabledInput.checked,
    });
    topics = [topic, ...topics];
    await saveTopics(topics);
    renderTopics();
    form.reset();
    enabledInput.checked = true;
    nameInput.focus();
    setStatus(`${topic.name} is now protected.`);
  } catch (error) {
    setStatus(error instanceof Error ? error.message : "Could not save this topic.", true);
  }
});

reportButton.addEventListener("click", async () => {
  setStatus("");
  try {
    const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (typeof activeTab?.id !== "number") {
      setStatus("Open a normal webpage before reporting a missed spoiler.", true);
      return;
    }
    const response = await chrome.tabs.sendMessage(activeTab.id, {
      type: BEGIN_MISSED_REPORT,
    }) as BeginMissedReportResponse;
    if (!response.started) {
      setStatus(response.reason ?? "Could not start report mode.", true);
      return;
    }
    setStatus("Selection mode started on this page.");
    window.setTimeout(() => window.close(), 300);
  } catch {
    setStatus("This page cannot enter report mode. Try a normal HTTP/HTTPS page.", true);
  }
});

void loadTopics()
  .then((storedTopics) => {
    topics = storedTopics;
    renderTopics();
  })
  .catch(() => setStatus("Could not load protected topics.", true));
