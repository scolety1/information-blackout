import type { ProtectedTopic } from "../../src/shared/topic";

export type Mission4Split = "development" | "validation";
export type Mission4Label = "spoiler" | "benign";
export type Mission4Category = "tv" | "movie" | "sports" | "game" | "book" | "competition";

export interface Mission4Case {
  id: string;
  split: Mission4Split;
  category: Mission4Category;
  family: string;
  expected: Mission4Label;
  topic: ProtectedTopic;
  text: string;
  tags: string[];
}

export interface Mission4Metrics {
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
