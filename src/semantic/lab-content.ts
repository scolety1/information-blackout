import type { ProtectedTopic } from "../shared/topic";
import { scoreTextForTopic } from "../detection/scorer";
import { HybridTrialEngine, TRIAL_GATE } from "./hybrid-trial";
import { ExtensionWorkerSemanticClassifier } from "./runtime-client";

const classifier = new ExtensionWorkerSemanticClassifier();
const engine = new HybridTrialEngine(classifier);
const processed = new WeakSet<Element>();
let inferenceCount = 0;
let pendingCount = 0;
let maxPending = 0;

function topicFor(element: HTMLElement): ProtectedTopic {
  return {
    id: `lab-${element.dataset.topicName ?? "topic"}`,
    name: element.dataset.topicName ?? "Unknown topic",
    aliases: (element.dataset.topicAliases ?? "").split("|").filter(Boolean),
    enabled: true,
    createdAt: "2026-01-01T00:00:00.000Z",
  };
}

function protect(element: HTMLElement, source: string): void {
  element.dataset.ibProtected = "true";
  element.dataset.semanticSource = source;
  const content = document.createElement("span");
  content.className = "m3-lab-concealed";
  while (element.firstChild) content.append(element.firstChild);
  const overlay = document.createElement("span");
  overlay.className = "m3-lab-overlay";
  overlay.dataset.ibOwned = "true";
  overlay.textContent = "Potential spoiler hidden by local trial";
  const reveal = document.createElement("button");
  reveal.type = "button";
  reveal.textContent = "Reveal";
  reveal.addEventListener("click", () => {
    element.replaceChildren(...content.childNodes);
    delete element.dataset.ibProtected;
    element.dataset.ibRevealed = "true";
  }, { once: true });
  overlay.append(reveal);
  element.append(content, overlay);
}

async function processCandidate(element: HTMLElement): Promise<void> {
  if (processed.has(element)) return;
  processed.add(element);
  const text = element.textContent?.trim() ?? "";
  const enabled = !new URL(document.baseURI).searchParams.has("semanticOff");
  if (!enabled) {
    element.dataset.semanticStatus = "disabled";
    const deterministic = scoreTextForTopic(text, topicFor(element));
    element.dataset.deterministicScore = String(deterministic.score);
    element.dataset.semanticSource = deterministic.shouldProtect ? "deterministic-spoiler" : "deterministic-benign";
    if (deterministic.shouldProtect) protect(element, "deterministic-spoiler");
    return;
  }
  const deterministic = scoreTextForTopic(text, topicFor(element));
  const isGrayZone = deterministic.score >= TRIAL_GATE.lowScore && deterministic.score < TRIAL_GATE.highScore;
  if (isGrayZone) element.dataset.semanticPending = "true";
  pendingCount += isGrayZone ? 1 : 0;
  maxPending = Math.max(maxPending, pendingCount);
  document.documentElement.dataset.semanticMaxPending = String(maxPending);
  const decision = await engine.detect(text, topicFor(element));
  pendingCount -= isGrayZone ? 1 : 0;
  delete element.dataset.semanticPending;
  element.dataset.semanticStatus = decision.semanticStatus;
  element.dataset.semanticSource = decision.source;
  element.dataset.deterministicScore = String(decision.deterministicScore);
  if (decision.semanticEscalated) {
    inferenceCount += 1;
    document.documentElement.dataset.semanticInferenceCount = String(inferenceCount);
  }
  if (decision.semanticProbability !== undefined) element.dataset.semanticProbability = decision.semanticProbability.toFixed(4);
  if (decision.shouldProtect) protect(element, decision.source);
}

function primeInitialCandidates(): void {
  document.querySelectorAll<HTMLElement>("[data-semantic-candidate]").forEach((element) => {
    const text = element.textContent?.trim() ?? "";
    const deterministic = scoreTextForTopic(text, topicFor(element));
    if (deterministic.score >= TRIAL_GATE.highScore) {
      processed.add(element);
      element.dataset.semanticStatus = "not-run";
      element.dataset.deterministicScore = String(deterministic.score);
      protect(element, "deterministic-spoiler");
    } else if (deterministic.score >= TRIAL_GATE.lowScore) {
      element.dataset.semanticPending = "true";
    }
  });
}

function scan(root: ParentNode): void {
  const elements = root instanceof HTMLElement && root.matches("[data-semantic-candidate]")
    ? [root, ...root.querySelectorAll<HTMLElement>("[data-semantic-candidate]")]
    : [...root.querySelectorAll<HTMLElement>("[data-semantic-candidate]")];
  for (const element of elements) void processCandidate(element);
}

const forceFailure = new URL(document.baseURI).searchParams.has("forceFailure");
const semanticDisabled = new URL(document.baseURI).searchParams.has("semanticOff");
if (semanticDisabled) {
  document.documentElement.dataset.semanticModelStatus = "disabled";
  scan(document);
} else {
  primeInitialCandidates();
  void classifier.initialize(forceFailure).then((status) => {
    document.documentElement.dataset.semanticModelStatus = status;
    scan(document);
  });
}

const observer = new MutationObserver((records) => {
  for (const record of records) {
    for (const node of record.addedNodes) if (node instanceof HTMLElement) scan(node);
  }
});
if (document.body) observer.observe(document.body, { childList: true, subtree: true });
window.addEventListener("pagehide", () => {
  observer.disconnect();
  classifier.dispose();
}, { once: true });
