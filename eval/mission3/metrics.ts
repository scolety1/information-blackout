import type { ChallengeSplit, MetricCounts, Prediction } from "./types";

const round = (value: number): number => Number(value.toFixed(4));
const ratio = (numerator: number, denominator: number): number => denominator === 0 ? 0 : round(numerator / denominator);

export function metrics(results: Prediction[]): MetricCounts {
  const truePositives = results.filter((item) => item.value.expected === "spoiler" && item.predictedSpoiler).length;
  const falsePositives = results.filter((item) => item.value.expected === "benign" && item.predictedSpoiler).length;
  const trueNegatives = results.filter((item) => item.value.expected === "benign" && !item.predictedSpoiler).length;
  const falseNegatives = results.filter((item) => item.value.expected === "spoiler" && !item.predictedSpoiler).length;
  const precision = ratio(truePositives, truePositives + falsePositives);
  const recall = ratio(truePositives, truePositives + falseNegatives);
  return {
    total: results.length,
    truePositives,
    falsePositives,
    trueNegatives,
    falseNegatives,
    precision,
    recall,
    f1: precision + recall === 0 ? 0 : round((2 * precision * recall) / (precision + recall)),
    falsePositiveRate: ratio(falsePositives, falsePositives + trueNegatives),
    falseNegativeRate: ratio(falseNegatives, falseNegatives + truePositives),
  };
}

export function groupedMetrics(results: Prediction[], field: "category" | "tags"): Record<string, MetricCounts> {
  const groups = new Map<string, Prediction[]>();
  for (const result of results) {
    const keys = field === "category" ? [result.value.category] : result.value.tags;
    for (const key of keys) groups.set(key, [...(groups.get(key) ?? []), result]);
  }
  return Object.fromEntries(
    [...groups.entries()]
      .filter(([, values]) => values.length >= 5)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, values]) => [key, metrics(values)]),
  );
}

export function splitMetrics(results: Prediction[]): Record<ChallengeSplit | "overall", MetricCounts> {
  const splits: ChallengeSplit[] = ["development", "entity-heldout", "linguistic-heldout", "indirect-reveal", "benign-adversarial"];
  return {
    ...Object.fromEntries(splits.map((split) => [split, metrics(results.filter((item) => item.value.split === split))])),
    overall: metrics(results),
  } as Record<ChallengeSplit | "overall", MetricCounts>;
}

export function failureSummary(results: Prediction[]) {
  const summarize = (item: Prediction) => ({
    id: item.value.id,
    split: item.value.split,
    category: item.value.category,
    tags: item.value.tags,
    score: Number(item.score.toFixed(4)),
    reasons: item.reasons,
  });
  return {
    falsePositives: results.filter((item) => item.value.expected === "benign" && item.predictedSpoiler).map(summarize),
    falseNegatives: results.filter((item) => item.value.expected === "spoiler" && !item.predictedSpoiler).map(summarize),
  };
}
