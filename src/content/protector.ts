import { findBestDetection, type DetectionResult } from "../detection/scorer";
import type { ProtectedTopic } from "../shared/topic";

export const CANDIDATE_SELECTOR = [
  "article",
  "[role='article']",
  "[role='listitem']",
  ".post",
  ".card",
  ".comment",
  ".result",
  "h1",
  "h2",
  "h3",
  "h4",
  "p",
  "li",
  "figcaption",
  "blockquote",
].join(",");

const EXCLUDED_SELECTOR = [
  "script",
  "style",
  "noscript",
  "template",
  "input",
  "textarea",
  "select",
  "option",
  "code",
  "pre",
  "kbd",
  "samp",
  "[contenteditable='true']",
  "[data-ib-owned='true']",
].join(",");

const MIN_TEXT_LENGTH = 18;
const MAX_TEXT_LENGTH = 1_500;
const MUTATION_DEBOUNCE_MS = 80;
const MUTATION_ROOT_COMPACTION_THRESHOLD = 40;

export interface ScanSummary {
  candidatesExamined: number;
  regionsProtected: number;
}

interface OriginalPresentation {
  inlinePosition: string;
  positionWasAdjusted: boolean;
}

function nodeElement(node: Node): Element | null {
  return node.nodeType === Node.ELEMENT_NODE
    ? (node as Element)
    : node.parentElement;
}

function elementDepth(element: Element): number {
  let depth = 0;
  let current = element.parentElement;
  while (current) {
    depth += 1;
    current = current.parentElement;
  }
  return depth;
}

function collectCandidates(root: Document | Element): Element[] {
  const candidates = new Set<Element>();
  if (root instanceof Element && root.matches(CANDIDATE_SELECTOR)) candidates.add(root);
  root.querySelectorAll(CANDIDATE_SELECTOR).forEach((candidate) => candidates.add(candidate));

  if (root instanceof Element) {
    let ancestor = root.parentElement;
    let levels = 0;
    while (ancestor && levels < 5) {
      if (ancestor.matches(CANDIDATE_SELECTOR)) candidates.add(ancestor);
      ancestor = ancestor.parentElement;
      levels += 1;
    }
  }

  return [...candidates].sort((left, right) => elementDepth(right) - elementDepth(left));
}

function isEligible(element: Element): element is HTMLElement {
  if (!(element instanceof HTMLElement)) return false;
  if (element.closest(EXCLUDED_SELECTOR)) return false;
  if (element.closest("[data-ib-protected='true'], [data-ib-revealed='true']")) return false;
  if (element.querySelector("[data-ib-protected='true'], [data-ib-revealed='true']")) return false;
  if (element.hidden || element.getAttribute("aria-hidden") === "true") return false;

  const style = element.style;
  if (style.display === "none" || style.visibility === "hidden") return false;

  const text = element.textContent?.trim() ?? "";
  return text.length >= MIN_TEXT_LENGTH && text.length <= MAX_TEXT_LENGTH;
}

export interface ContentProtectorOptions {
  onFalsePositive?: (topicId: string) => void | Promise<void>;
}

export class ContentProtector {
  private topics: ProtectedTopic[] = [];
  private scanCache = new WeakMap<Element, string>();
  private readonly originalPresentation = new WeakMap<HTMLElement, OriginalPresentation>();
  private observer: MutationObserver | null = null;
  private mutationTimer: number | null = null;
  private readonly pendingRoots = new Set<Document | Element>();

  constructor(
    private readonly document: Document,
    private readonly options: ContentProtectorOptions = {},
  ) {}

  start(topics: ProtectedTopic[]): ScanSummary {
    this.topics = topics;
    const summary = this.scan(this.document);
    this.observer = new MutationObserver((records) => this.handleMutations(records));
    if (this.document.body) {
      this.observer.observe(this.document.body, {
        childList: true,
        characterData: true,
        subtree: true,
      });
    }
    return summary;
  }

  stop(): void {
    this.observer?.disconnect();
    this.observer = null;
    if (this.mutationTimer !== null) this.document.defaultView?.clearTimeout(this.mutationTimer);
    this.mutationTimer = null;
    this.pendingRoots.clear();
  }

  updateTopics(topics: ProtectedTopic[]): ScanSummary {
    this.topics = topics;
    this.scanCache = new WeakMap<Element, string>();
    this.document.querySelectorAll<HTMLElement>("[data-ib-protected='true']").forEach((element) => {
      this.restore(element, false);
    });
    return this.scan(this.document);
  }

  scan(root: Document | Element = this.document): ScanSummary {
    const topicSignature = this.topics
      .map((topic) => `${topic.id}:${topic.enabled}:${topic.name}:${topic.aliases.join("|")}`)
      .join(";");
    let candidatesExamined = 0;
    let regionsProtected = 0;

    for (const candidate of collectCandidates(root)) {
      if (!isEligible(candidate)) continue;
      const text = candidate.textContent?.trim() ?? "";
      const fingerprint = `${topicSignature}\n${text}`;
      if (this.scanCache.get(candidate) === fingerprint) continue;
      this.scanCache.set(candidate, fingerprint);
      candidatesExamined += 1;

      const detection = findBestDetection(text, this.topics);
      if (!detection) continue;
      this.protect(candidate, detection);
      regionsProtected += 1;
    }

    return { candidatesExamined, regionsProtected };
  }

  reveal(element: HTMLElement): void {
    this.restore(element, true);
  }

  private markFalsePositive(element: HTMLElement, topicId: string): void {
    this.restore(element, true);
    element.dataset.ibFeedback = "false-positive";
    void this.options.onFalsePositive?.(topicId);

    const toast = this.document.createElement("span");
    toast.className = "ib-feedback-toast";
    toast.dataset.ibOwned = "true";
    toast.setAttribute("role", "status");
    toast.textContent = "Thanks - correction saved locally.";
    if (element.parentElement) {
      element.insertAdjacentElement("afterend", toast);
    } else {
      this.document.body?.append(toast);
    }
    this.document.defaultView?.setTimeout(() => toast.remove(), 2_500);
  }

  private protect(element: HTMLElement, detection: DetectionResult): void {
    if (element.dataset.ibProtected === "true") return;

    const computedPosition = this.document.defaultView?.getComputedStyle(element).position ?? "";
    const positionWasAdjusted = computedPosition === "static" || computedPosition === "";
    this.originalPresentation.set(element, {
      inlinePosition: element.style.position,
      positionWasAdjusted,
    });
    if (positionWasAdjusted) element.style.position = "relative";

    const concealed = this.document.createElement("span");
    concealed.className = "ib-concealed-content";
    concealed.setAttribute("aria-hidden", "true");
    concealed.setAttribute("inert", "");
    while (element.firstChild) concealed.append(element.firstChild);

    const overlay = this.document.createElement("span");
    overlay.className = "ib-blackout-overlay";
    overlay.dataset.ibOwned = "true";
    overlay.setAttribute("role", "status");

    const label = this.document.createElement("span");
    label.className = "ib-blackout-label";
    label.textContent = `Potential ${detection.topicName} spoiler hidden`;

    const button = this.document.createElement("button");
    button.className = "ib-reveal-button";
    button.type = "button";
    button.textContent = "Reveal";
    button.setAttribute("aria-label", `Reveal potential ${detection.topicName} spoiler`);
    button.addEventListener("click", () => this.reveal(element), { once: true });

    const correction = this.document.createElement("button");
    correction.className = "ib-not-spoiler-button";
    correction.type = "button";
    correction.textContent = "Not a spoiler";
    correction.setAttribute("aria-label", `Mark potential ${detection.topicName} spoiler as a false positive`);
    correction.addEventListener("click", () => this.markFalsePositive(element, detection.topicId), { once: true });


    overlay.append(label, button, correction);
    element.append(concealed, overlay);
    element.classList.add("ib-protected-region");
    element.dataset.ibProtected = "true";
    element.dataset.ibTopicId = detection.topicId;
  }

  private restore(element: HTMLElement, markRevealed: boolean): void {
    const concealed = Array.from(element.children).find((child) =>
      child.classList.contains("ib-concealed-content"),
    );
    const overlay = Array.from(element.children).find((child) =>
      child.classList.contains("ib-blackout-overlay"),
    );

    if (concealed) {
      while (concealed.firstChild) element.insertBefore(concealed.firstChild, concealed);
      concealed.remove();
    }
    overlay?.remove();

    element.classList.remove("ib-protected-region");
    delete element.dataset.ibProtected;
    delete element.dataset.ibTopicId;
    if (markRevealed) element.dataset.ibRevealed = "true";

    const presentation = this.originalPresentation.get(element);
    if (presentation?.positionWasAdjusted) element.style.position = presentation.inlinePosition;
    this.originalPresentation.delete(element);
  }

  private handleMutations(records: MutationRecord[]): void {
    for (const record of records) {
      if (record.type === "characterData") {
        const element = nodeElement(record.target);
        if (element && !element.closest("[data-ib-owned='true'], [data-ib-protected='true']")) {
          this.pendingRoots.add(element);
        }
        continue;
      }

      record.addedNodes.forEach((node) => {
        const element = nodeElement(node);
        if (element && !element.closest("[data-ib-owned='true'], [data-ib-protected='true']")) {
          this.pendingRoots.add(element);
        }
      });
    }

    if (this.pendingRoots.size === 0 || this.mutationTimer !== null) return;
    this.mutationTimer = this.document.defaultView?.setTimeout(() => {
      const roots: Array<Document | Element> = this.pendingRoots.size > MUTATION_ROOT_COMPACTION_THRESHOLD
        ? [this.document]
        : [...this.pendingRoots];
      this.pendingRoots.clear();
      this.mutationTimer = null;
      roots.forEach((root) => this.scan(root));
    }, MUTATION_DEBOUNCE_MS) ?? null;
  }
}
