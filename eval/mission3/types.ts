import type { ProtectedTopic } from "../../src/shared/topic";

export type ChallengeLabel = "spoiler" | "benign";
export type ChallengeSplit =
  | "development"
  | "entity-heldout"
  | "linguistic-heldout"
  | "indirect-reveal"
  | "benign-adversarial";
export type ChallengeCategory = "tv" | "movie" | "sports" | "game" | "book" | "competition";

export interface ChallengeCase {
  id: string;
  topic: ProtectedTopic;
  category: ChallengeCategory;
  text: string;
  expected: ChallengeLabel;
  difficulty: "standard" | "hard";
  tags: string[];
  rationale: string;
  split: ChallengeSplit;
}

export interface ChallengeDocument {
  schemaVersion: 1;
  frozenAt: string;
  design: string;
  cases: ChallengeCase[];
}

export interface MetricCounts {
  total: number;
  truePositives: number;
  falsePositives: number;
  trueNegatives: number;
  falseNegatives: number;
  precision: number;
  recall: number;
  f1: number;
  falsePositiveRate: number;
  falseNegativeRate: number;
}

export interface Prediction {
  value: ChallengeCase;
  predictedSpoiler: boolean;
  score: number;
  reasons: string[];
}
