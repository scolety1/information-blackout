import type { ProtectedTopic } from "../shared/topic";
import { CANDIDATE_SELECTOR } from "./protector";

export interface MissedSpoilerSubmission {
  topicId: string;
  explicitAlias: string;
}

export interface MissedSpoilerReporterOptions {
  onSubmit: (submission: MissedSpoilerSubmission) => Promise<void>;
}

export class MissedSpoilerReporter {
  private active = false;
  private panel: HTMLElement | null = null;
  private highlighted: HTMLElement | null = null;
  private selected: HTMLElement | null = null;
  private topics: ProtectedTopic[] = [];

  constructor(
    private readonly document: Document,
    private readonly options: MissedSpoilerReporterOptions,
  ) {}

  start(topics: ProtectedTopic[]): boolean {
    this.cancel();
    this.topics = topics.filter((topic) => topic.enabled);
    if (this.topics.length === 0 || !this.document.body) return false;
    this.active = true;
    this.document.documentElement.classList.add("ib-report-mode");
    this.panel = this.createSelectionPanel();
    this.document.body.append(this.panel);
    this.document.addEventListener("mouseover", this.handleMouseOver, true);
    this.document.addEventListener("click", this.handleClick, true);
    this.document.addEventListener("keydown", this.handleKeyDown, true);
    return true;
  }

  cancel(): void {
    this.active = false;
    this.document.documentElement.classList.remove("ib-report-mode");
    this.document.removeEventListener("mouseover", this.handleMouseOver, true);
    this.document.removeEventListener("click", this.handleClick, true);
    this.document.removeEventListener("keydown", this.handleKeyDown, true);
    this.highlighted?.classList.remove("ib-report-target");
    this.selected?.classList.remove("ib-report-target", "ib-report-selected");
    this.highlighted = null;
    this.selected = null;
    this.panel?.remove();
    this.panel = null;
  }

  isActive(): boolean {
    return this.active;
  }

  private readonly handleMouseOver = (event: Event): void => {
    if (!this.active || this.selected) return;
    const candidate = this.candidateFromEvent(event);
    if (candidate === this.highlighted) return;
    this.highlighted?.classList.remove("ib-report-target");
    this.highlighted = candidate;
    this.highlighted?.classList.add("ib-report-target");
  };

  private readonly handleClick = (event: Event): void => {
    if (!this.active || this.selected) return;
    const candidate = this.candidateFromEvent(event);
    if (!candidate) return;
    event.preventDefault();
    event.stopPropagation();
    this.highlighted?.classList.remove("ib-report-target");
    this.highlighted = null;
    this.selected = candidate;
    candidate.classList.add("ib-report-target", "ib-report-selected");
    this.document.removeEventListener("mouseover", this.handleMouseOver, true);
    this.document.removeEventListener("click", this.handleClick, true);
    this.renderConfirmation();
  };

  private readonly handleKeyDown = (event: KeyboardEvent): void => {
    if (event.key === "Escape") this.cancel();
  };

  private candidateFromEvent(event: Event): HTMLElement | null {
    const target = event.target;
    if (!(target instanceof Element)) return null;
    if (target.closest("[data-ib-owned='true'], [data-ib-protected='true']")) return null;
    const candidate = target.closest<HTMLElement>(CANDIDATE_SELECTOR);
    if (!candidate || candidate.hidden || candidate.getAttribute("aria-hidden") === "true") return null;
    return candidate;
  }

  private createSelectionPanel(): HTMLElement {
    const panel = this.document.createElement("aside");
    panel.className = "ib-report-panel";
    panel.dataset.ibOwned = "true";
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-label", "Report missed spoiler");

    const message = this.document.createElement("strong");
    message.textContent = "Select the missed spoiler region";
    const detail = this.document.createElement("span");
    detail.textContent = "Click a headline, paragraph, card, or post. Press Esc to exit.";
    const cancel = this.document.createElement("button");
    cancel.type = "button";
    cancel.textContent = "Cancel";
    cancel.addEventListener("click", () => this.cancel());
    panel.append(message, detail, cancel);
    return panel;
  }

  private renderConfirmation(): void {
    if (!this.panel) return;
    this.panel.replaceChildren();
    const title = this.document.createElement("strong");
    title.textContent = "Improve protection locally";
    const privacy = this.document.createElement("span");
    privacy.textContent = "The selected text and page URL will not be saved.";

    const form = this.document.createElement("form");
    const selectLabel = this.document.createElement("label");
    selectLabel.textContent = "Protected topic";
    const select = this.document.createElement("select");
    select.setAttribute("aria-label", "Protected topic");
    this.topics.forEach((topic) => {
      const option = this.document.createElement("option");
      option.value = topic.id;
      option.textContent = topic.name;
      select.append(option);
    });
    selectLabel.append(select);

    const aliasLabel = this.document.createElement("label");
    aliasLabel.textContent = "Optional alias or phrase to add";
    const alias = this.document.createElement("input");
    alias.type = "text";
    alias.maxLength = 120;
    alias.placeholder = "Type it explicitly—nothing is copied from the page";
    alias.setAttribute("aria-label", "Optional alias or phrase to add");
    aliasLabel.append(alias);

    const actions = this.document.createElement("span");
    actions.className = "ib-report-actions";
    const save = this.document.createElement("button");
    save.type = "submit";
    save.textContent = "Save local feedback";
    const cancel = this.document.createElement("button");
    cancel.type = "button";
    cancel.textContent = "Cancel";
    cancel.addEventListener("click", () => this.cancel());
    actions.append(save, cancel);
    form.append(selectLabel, aliasLabel, actions);
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      save.disabled = true;
      void this.options.onSubmit({ topicId: select.value, explicitAlias: alias.value.trim() })
        .then(() => this.finish())
        .catch(() => {
          save.disabled = false;
          privacy.textContent = "Could not save feedback. Nothing from the page was retained.";
        });
    });
    this.panel.append(title, privacy, form);
    select.focus();
  }

  private finish(): void {
    const body = this.document.body;
    this.cancel();
    if (!body) return;
    const toast = this.document.createElement("div");
    toast.className = "ib-feedback-toast";
    toast.dataset.ibOwned = "true";
    toast.setAttribute("role", "status");
    toast.textContent = "Missed spoiler recorded locally.";
    body.append(toast);
    this.document.defaultView?.setTimeout(() => toast.remove(), 2_500);
  }
}
