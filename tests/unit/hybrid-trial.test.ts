import { describe, expect, it } from "vitest";
import type { ProtectedTopic } from "../../src/shared/topic";
import type { LocalSemanticClassifier } from "../../src/semantic/classifier";
import { HybridTrialEngine } from "../../src/semantic/hybrid-trial";
import type { SemanticResult } from "../../src/semantic/head";

const topic: ProtectedTopic = {
  id: "hybrid-topic",
  name: "The Elm Signal",
  aliases: ["Finn Umber", "Elm Circle"],
  enabled: true,
  createdAt: "2026-01-01T00:00:00.000Z",
};

class FakeClassifier implements LocalSemanticClassifier {
  calls = 0;
  constructor(private readonly result: SemanticResult) {}
  async initialize(): Promise<SemanticResult["status"]> { return this.result.status; }
  async classify(): Promise<SemanticResult> { this.calls += 1; return this.result; }
  dispose(): void {}
}

const semanticResult = (overrides: Partial<SemanticResult> = {}): SemanticResult => ({
  status: "ready",
  spoilerProbability: 0.8,
  shouldProtect: true,
  threshold: 0.57,
  modelId: "Xenova/all-MiniLM-L6-v2",
  ...overrides,
});

describe("reversible hybrid trial boundary", () => {
  it("does not route obvious deterministic decisions", async () => {
    const classifier = new FakeClassifier(semanticResult());
    const engine = new HybridTrialEngine(classifier);
    const benign = await engine.detect("The Elm Signal is available to stream Friday.", topic);
    const spoiler = await engine.detect("The Elm Signal ending reveals Finn Umber as the villain who betrayed Elm Circle.", topic);
    expect(benign).toMatchObject({ source: "deterministic-benign", shouldProtect: false, semanticEscalated: false });
    expect(spoiler).toMatchObject({ source: "deterministic-spoiler", shouldProtect: true, semanticEscalated: false });
    expect(classifier.calls).toBe(0);
  });

  it("routes only the gray zone and exposes a structured semantic result", async () => {
    const classifier = new FakeClassifier(semanticResult());
    const decision = await new HybridTrialEngine(classifier).detect(
      "Finn Umber: The orders blamed on a council use Finn Umber's childhood cipher on every page.",
      topic,
    );
    expect(decision).toMatchObject({
      source: "semantic",
      shouldProtect: true,
      semanticEscalated: true,
      semanticStatus: "ready",
      semanticProbability: 0.8,
    });
    expect(classifier.calls).toBe(1);
  });

  it("falls back to the deterministic decision on semantic failure", async () => {
    const classifier = new FakeClassifier(semanticResult({ status: "failed", shouldProtect: false, spoilerProbability: 0 }));
    const decision = await new HybridTrialEngine(classifier).detect(
      "Finn Umber: The orders blamed on a council use Finn Umber's childhood cipher on every page.",
      topic,
    );
    expect(decision).toMatchObject({ source: "fallback", shouldProtect: false, semanticEscalated: true, semanticStatus: "failed" });
  });
});
