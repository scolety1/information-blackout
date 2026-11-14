// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ContentProtector } from "../../src/content/protector";
import { severanceTopic } from "../helpers/topics";

describe("ContentProtector", () => {
  let protector: ContentProtector;

  beforeEach(() => {
    document.body.replaceChildren();
    protector = new ContentProtector(document);
  });

  afterEach(() => protector.stop());

  it("protects matched content with safe extension-owned controls", () => {
    document.body.innerHTML = '<p id="target">Major Severance ending explained</p>';
    const summary = protector.updateTopics([severanceTopic()]);
    const target = document.querySelector<HTMLElement>("#target")!;

    expect(summary.regionsProtected).toBe(1);
    expect(target.dataset.ibProtected).toBe("true");
    expect(target.querySelector(".ib-concealed-content")?.textContent).toContain("ending explained");
    expect(target.querySelector<HTMLButtonElement>("button")?.textContent).toBe("Reveal");
  });

  it("leaves benign content untouched", () => {
    document.body.innerHTML = '<p id="target">I started watching Severance this week.</p>';
    protector.updateTopics([severanceTopic()]);
    expect(document.querySelector("[data-ib-protected='true']")).toBeNull();
  });

  it("protects the smallest matching nested region without overlay explosions", () => {
    document.body.innerHTML = `
      <article id="card" class="card">
        <h2 id="headline">Severance finale twist revealed</h2>
        <p>Production design interview available today.</p>
      </article>`;
    protector.updateTopics([severanceTopic()]);

    expect(document.querySelectorAll("[data-ib-protected='true']")).toHaveLength(1);
    expect(document.querySelector<HTMLElement>("#headline")?.dataset.ibProtected).toBe("true");
    expect(document.querySelector<HTMLElement>("#card")?.dataset.ibProtected).toBeUndefined();
  });

  it("reveals and cleanly restores one protected region", () => {
    document.body.innerHTML = '<p id="target"><strong>Severance</strong> finale revealed</p>';
    protector.updateTopics([severanceTopic()]);
    const target = document.querySelector<HTMLElement>("#target")!;
    target.querySelector<HTMLButtonElement>(".ib-reveal-button")!.click();

    expect(target.textContent).toContain("Severance finale revealed");
    expect(target.querySelector(".ib-blackout-overlay")).toBeNull();
    expect(target.dataset.ibProtected).toBeUndefined();
    expect(target.dataset.ibRevealed).toBe("true");

    protector.scan(document);
    expect(target.dataset.ibProtected).toBeUndefined();
  });

  it("never protects extension-owned UI", () => {
    document.body.innerHTML = `
      <article data-ib-owned="true">
        <p>Severance finale ending explained and revealed</p>
      </article>`;
    protector.updateTopics([severanceTopic()]);
    expect(document.querySelector("[data-ib-protected='true']")).toBeNull();
  });

  it("processes dynamically inserted spoiler content", async () => {
    document.body.innerHTML = '<main><div id="feed"></div></main>';
    protector.start([severanceTopic()]);
    const post = document.createElement("article");
    post.innerHTML = '<h3 id="dynamic">Lumon secret revealed in the Severance finale</h3>';
    document.querySelector("#feed")!.append(post);

    await new Promise((resolve) => window.setTimeout(resolve, 140));
    expect(document.querySelector<HTMLElement>("#dynamic")?.dataset.ibProtected).toBe("true");
  });

  it("is idempotent across repeated scans", () => {
    document.body.innerHTML = '<p id="target">Major Severance ending explained</p>';
    protector.updateTopics([severanceTopic()]);
    protector.scan(document);
    protector.scan(document);
    expect(document.querySelectorAll(".ib-blackout-overlay")).toHaveLength(1);
  });

  it("restores content when the configured topic is disabled", () => {
    document.body.innerHTML = '<p id="target">Major Severance ending explained</p>';
    protector.updateTopics([severanceTopic()]);
    const target = document.querySelector<HTMLElement>("#target")!;
    expect(target.dataset.ibProtected).toBe("true");

    protector.updateTopics([severanceTopic({ enabled: false })]);
    expect(target.dataset.ibProtected).toBeUndefined();
    expect(target.textContent).toBe("Major Severance ending explained");
  });
});
