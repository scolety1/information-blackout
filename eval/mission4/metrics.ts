import type { Mission4Case, Mission4Metrics } from "./types";
import type { DetectionResult } from "../../src/detection/scorer";

export interface Mission4EvaluatedCase {
  value: Mission4Case;
  result: DetectionResult;
}

const round = (value: number): number => Number(value.toFixed(4));
const ratio = (n: number, d: number): number => d === 0 ? 0 : round(n / d);

export function mission4Metrics(results: Mission4EvaluatedCase[]): Mission4Metrics {
  const truePositives = results.filter((x) => x.value.expected === "spoiler" && x.result.shouldProtect).length;
  const falsePositives = results.filter((x) => x.value.expected === "benign" && x.result.shouldProtect).length;
  const trueNegatives = results.filter((x) => x.value.expected === "benign" && !x.result.shouldProtect).length;
  const falseNegatives = results.filter((x) => x.value.expected === "spoiler" && !x.result.shouldProtect).length;
  const precision = ratio(truePositives, truePositives + falsePositives);
  const recall = ratio(truePositives, truePositives + falseNegatives);
  return {
    total: results.length, truePositives, falsePositives, trueNegatives, falseNegatives,
    precision, recall,
    f1: precision + recall === 0 ? 0 : round(2 * precision * recall / (precision + recall)),
    falsePositiveRate: ratio(falsePositives, falsePositives + trueNegatives),
    falseNegativeRate: ratio(falseNegatives, falseNegatives + truePositives),
  };
}

export function mission4Grouped(results: Mission4EvaluatedCase[], field: "family" | "category" | "tags"): Record<string, Mission4Metrics> {
  const groups = new Map<string, Mission4EvaluatedCase[]>();
  for (const item of results) {
    const keys = field === "tags" ? item.value.tags : [item.value[field]];
    for (const key of keys) groups.set(key, [...(groups.get(key) ?? []), item]);
  }
  return Object.fromEntries([...groups.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([key, values]) => [key, mission4Metrics(values)]));
}
