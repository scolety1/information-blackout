// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from "vitest";
import { MissedSpoilerReporter } from "../../src/content/reporter";
import { severanceTopic } from "../helpers/topics";

describe("MissedSpoilerReporter", () => {
  beforeEach(() => document.body.replaceChildren());

  it("selects a region, requires explicit alias typing, submits, and exits cleanly", async () => {
    document.body.innerHTML = '<article><p id="missed">A subtle sentence the detector missed completely.</p></article>';
    const onSubmit = vi.fn(async () => undefined);
    const reporter = new MissedSpoilerReporter(document, { onSubmit });
    expect(reporter.start([severanceTopic()])).toBe(true);

    const missed = document.querySelector<HTMLElement>("#missed")!;
    missed.dispatchEvent(new MouseEvent("mouseover", { bubbles: true }));
    expect(missed.classList.contains("ib-report-target")).toBe(true);
    missed.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));

    const alias = document.querySelector<HTMLInputElement>("[aria-label='Optional alias or phrase to add']")!;
    expect(alias.value).toBe("");
    alias.value = "Helly Riggs";
    document.querySelector<HTMLFormElement>(".ib-report-panel form")!
      .dispatchEvent(new SubmitEvent("submit", { bubbles: true, cancelable: true }));
    await vi.waitFor(() => expect(onSubmit).toHaveBeenCalledWith({
      topicId: "topic-severance",
      explicitAlias: "Helly Riggs",
    }));
    await vi.waitFor(() => expect(reporter.isActive()).toBe(false));
    expect(document.documentElement.classList.contains("ib-report-mode")).toBe(false);
    expect(missed.classList.contains("ib-report-target")).toBe(false);
  });

  it("cancels with Escape without submitting or retaining inspection state", () => {
    document.body.innerHTML = '<p id="missed">A missed spoiler region long enough to select.</p>';
    const onSubmit = vi.fn(async () => undefined);
    const reporter = new MissedSpoilerReporter(document, { onSubmit });
    reporter.start([severanceTopic()]);
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(reporter.isActive()).toBe(false);
    expect(document.querySelector(".ib-report-panel")).toBeNull();
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
