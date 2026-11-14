// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from "vitest";
import { ContentProtector } from "../../src/content/protector";
import { severanceTopic } from "../helpers/topics";

describe("representative large-page scan observation", () => {
  beforeEach(() => document.body.replaceChildren());

  it("reports candidate count and initial scan time without asserting an invented budget", () => {
    const main = document.createElement("main");
    const fragment = document.createDocumentFragment();
    for (let index = 0; index < 600; index += 1) {
      const paragraph = document.createElement("p");
      paragraph.textContent = index % 50 === 0
        ? `Severance finale ending explained in synthetic result ${index}.`
        : `Benign synthetic candidate ${index} discusses layout, schedules, and production craft.`;
      fragment.append(paragraph);
    }
    main.append(fragment);
    document.body.append(main);

    const protector = new ContentProtector(document);
    const startedAt = performance.now();
    const summary = protector.updateTopics([severanceTopic()]);
    const elapsed = performance.now() - startedAt;
    console.info(`[performance] candidates=${summary.candidatesExamined} protected=${summary.regionsProtected} initialScanMs=${elapsed.toFixed(2)}`);

    expect(summary.candidatesExamined).toBe(600);
    expect(summary.regionsProtected).toBe(12);
    protector.stop();
  });

  it("deduplicates unchanged rescans and handles a 120-item mutation burst", async () => {
    const main = document.createElement("main");
    document.body.append(main);
    const protector = new ContentProtector(document);
    protector.start([severanceTopic()]);
    const fragment = document.createDocumentFragment();
    for (let index = 0; index < 120; index += 1) {
      const article = document.createElement("article");
      article.textContent = index % 20 === 0
        ? `Severance finale reveals Mark Scout betrayed Lumon in update ${index}.`
        : `Benign production note ${index} contains no plot details.`;
      fragment.append(article);
    }
    const startedAt = performance.now();
    main.append(fragment);
    await new Promise((resolve) => setTimeout(resolve, 120));
    const elapsed = performance.now() - startedAt;
    const unchanged = protector.scan(document);
    console.info(`[performance] mutationCandidates=120 protected=6 mutationMs=${elapsed.toFixed(2)} unchangedReprocessed=${unchanged.candidatesExamined}`);
    expect(document.querySelectorAll("[data-ib-protected='true']")).toHaveLength(6);
    expect(unchanged.candidatesExamined).toBe(0);
    protector.stop();
  });
});
