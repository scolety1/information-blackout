// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from "vitest";
import { ContentProtector } from "../../src/content/protector";
import { severanceTopic } from "../helpers/topics";

describe("false-positive feedback control", () => {
  beforeEach(() => document.body.replaceChildren());

  it("reveals, records local correction, and remains revealed after rescanning", () => {
    document.body.innerHTML = '<p id="target">Severance finale ending explained</p>';
    const onFalsePositive = vi.fn();
    const protector = new ContentProtector(document, { onFalsePositive });
    protector.updateTopics([severanceTopic()]);
    const target = document.querySelector<HTMLElement>("#target")!;

    target.querySelector<HTMLButtonElement>(".ib-not-spoiler-button")!.click();
    expect(onFalsePositive).toHaveBeenCalledWith("topic-severance");
    expect(target.dataset.ibFeedback).toBe("false-positive");
    expect(target.dataset.ibRevealed).toBe("true");
    expect(target.textContent).toBe("Severance finale ending explained");

    protector.scan(document);
    expect(target.dataset.ibProtected).toBeUndefined();
    expect(document.querySelectorAll(".ib-blackout-overlay")).toHaveLength(0);
    protector.stop();
  });
});
