// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from "vitest";
import { ContentProtector } from "../../src/content/protector";
import { nuggetsTopic, severanceTopic } from "../helpers/topics";

describe("Mission 2 DOM and mutation regressions", () => {
  beforeEach(() => document.body.replaceChildren());

  it("does not duplicate overlays when a protected node is removed and reinserted", async () => {
    document.body.innerHTML = '<main id="feed"><p id="target">Severance finale ending explained</p></main>';
    const protector = new ContentProtector(document);
    protector.start([severanceTopic()]);
    const target = document.querySelector<HTMLElement>("#target")!;
    target.remove();
    document.querySelector("#feed")!.append(target);
    await new Promise((resolve) => window.setTimeout(resolve, 140));
    expect(target.querySelectorAll(".ib-blackout-overlay")).toHaveLength(1);
    protector.stop();
  });

  it("keeps revealed content revealed through future mutations", async () => {
    document.body.innerHTML = '<p id="target">Severance finale ending explained</p>';
    const protector = new ContentProtector(document);
    protector.start([severanceTopic()]);
    const target = document.querySelector<HTMLElement>("#target")!;
    target.querySelector<HTMLButtonElement>(".ib-reveal-button")!.click();
    target.append(document.createTextNode(" Additional Severance ending details."));
    await new Promise((resolve) => window.setTimeout(resolve, 140));
    expect(target.dataset.ibRevealed).toBe("true");
    expect(target.dataset.ibProtected).toBeUndefined();
    protector.stop();
  });

  it("creates one region when multiple topics match the same candidate", () => {
    document.body.innerHTML = '<p id="target">Severance finale revealed while Nuggets win 118-110.</p>';
    const protector = new ContentProtector(document);
    protector.updateTopics([severanceTopic(), nuggetsTopic()]);
    expect(document.querySelectorAll(".ib-blackout-overlay")).toHaveLength(1);
    protector.stop();
  });

  it("compacts a rapid mutation burst into a bounded number of scans", async () => {
    document.body.innerHTML = '<main id="feed"></main>';
    const protector = new ContentProtector(document);
    const scanSpy = vi.spyOn(protector, "scan");
    protector.start([severanceTopic()]);
    const fragment = document.createDocumentFragment();
    for (let index = 0; index < 120; index += 1) {
      const post = document.createElement("article");
      post.textContent = index % 30 === 0
        ? `Severance finale reveal number ${index}`
        : `Ordinary synthetic feed item ${index} with enough text to scan.`;
      fragment.append(post);
    }
    document.querySelector("#feed")!.append(fragment);
    await new Promise((resolve) => window.setTimeout(resolve, 180));
    expect(scanSpy.mock.calls.length).toBeLessThanOrEqual(3);
    expect(document.querySelectorAll("[data-ib-protected='true']")).toHaveLength(4);
    protector.stop();
  });
});
