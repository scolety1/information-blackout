import { scoreTextForTopic } from "../detection/scorer";
import type { ProtectedTopic } from "../shared/topic";
import type { LocalSemanticClassifier } from "./classifier";
import { formatSemanticInput } from "./input";

export const TRIAL_GATE = { lowScore: 2.5, highScore: 7 } as const;

export interface HybridTrialDecision {
  source: "deterministic-benign" | "deterministic-spoiler" | "semantic" | "fallback";
  shouldProtect: boolean;
  deterministicScore: number;
  semanticEscalated: boolean;
  semanticStatus: "not-run" | "ready" | "disabled" | "failed" | "overloaded";
  semanticProbability?: number;
}

export class HybridTrialEngine {
  constructor(private readonly classifier: LocalSemanticClassifier) {}

  async detect(text: string, topic: ProtectedTopic): Promise<HybridTrialDecision> {
    const deterministic = scoreTextForTopic(text, topic);
    if (!deterministic.shouldProtect && deterministic.explanation.benignEvidence.length > 0) {
      return { source: "deterministic-benign", shouldProtect: false, deterministicScore: deterministic.score, semanticEscalated: false, semanticStatus: "not-run" };
    }
    if (deterministic.shouldProtect) {
      return { source: "deterministic-spoiler", shouldProtect: true, deterministicScore: deterministic.score, semanticEscalated: false, semanticStatus: "not-run" };
    }
    if (deterministic.score < TRIAL_GATE.lowScore) {
      return { source: "deterministic-benign", shouldProtect: false, deterministicScore: deterministic.score, semanticEscalated: false, semanticStatus: "not-run" };
    }
    if (deterministic.score >= TRIAL_GATE.highScore) {
      return { source: "deterministic-spoiler", shouldProtect: true, deterministicScore: deterministic.score, semanticEscalated: false, semanticStatus: "not-run" };
    }
    const semantic = await this.classifier.classify(formatSemanticInput(text, topic));
    if (semantic.status !== "ready") {
      return {
        source: "fallback",
        shouldProtect: deterministic.shouldProtect,
        deterministicScore: deterministic.score,
        semanticEscalated: true,
        semanticStatus: semantic.status,
      };
    }
    return {
      source: "semantic",
      shouldProtect: semantic.shouldProtect,
      deterministicScore: deterministic.score,
      semanticEscalated: true,
      semanticStatus: "ready",
      semanticProbability: semantic.spoilerProbability,
    };
  }
}
