import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { performance } from "node:perf_hooks";
import type { ChallengeDocument } from "../../eval/mission3/types";
import type { LocalSemanticClassifier } from "../../src/semantic/classifier";
import { HybridTrialEngine } from "../../src/semantic/hybrid-trial";
import type { SemanticResult } from "../../src/semantic/head";

class CountingClassifier implements LocalSemanticClassifier {
  calls = 0;
  async initialize(): Promise<"ready"> { return "ready"; }
  async classify(): Promise<SemanticResult> {
    this.calls += 1;
    return { status: "ready", spoilerProbability: 0.4, shouldProtect: false, threshold: 0.57, modelId: "test-double" };
  }
  dispose(): void {}
}

describe("semantic-aware large-candidate regression", () => {
  it("routes a bounded minority of the 600 frozen candidates", async () => {
    const document = JSON.parse(await readFile("eval/mission3/challenge.json", "utf8")) as ChallengeDocument;
    const classifier = new CountingClassifier();
    const engine = new HybridTrialEngine(classifier);
    const started = performance.now();
    const decisions = await Promise.all(document.cases.map((item) => engine.detect(item.text, item.topic)));
    const elapsed = performance.now() - started;
    const protectedCount = decisions.filter((item) => item.shouldProtect).length;
    expect(decisions).toHaveLength(600);
    expect(classifier.calls).toBeGreaterThan(0);
    expect(classifier.calls / decisions.length).toBeLessThan(0.3);
    expect(protectedCount).toBeGreaterThan(0);
    expect(elapsed).toBeLessThan(2_000);
  });
});
