import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { CORPUS_CASES, type CorpusCase, type CorpusSplit } from "./corpus";
import { DETECTION_CONSTANTS, scoreTextForTopic } from "../src/detection/scorer";

interface Counts {
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

interface EvaluatedCase {
  value: CorpusCase;
  predictedSpoiler: boolean;
  score: number;
  reasons: string[];
}

const round = (value: number): number => Number(value.toFixed(4));
const ratio = (numerator: number, denominator: number): number => denominator === 0 ? 0 : round(numerator / denominator);

function evaluate(cases: CorpusCase[], threshold: number): EvaluatedCase[] {
  return cases.map((value) => {
    const result = scoreTextForTopic(value.text, value.topic, threshold);
    return { value, predictedSpoiler: result.shouldProtect, score: result.score, reasons: result.reasons };
  });
}

function metrics(results: EvaluatedCase[]): Counts {
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

function groupedMetrics(results: EvaluatedCase[], field: "category" | "tags"): Record<string, Counts> {
  const groups = new Map<string, EvaluatedCase[]>();
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

const splitResults = (results: EvaluatedCase[], split: CorpusSplit): EvaluatedCase[] =>
  results.filter((item) => item.value.split === split);

function failures(results: EvaluatedCase[]) {
  const summarize = (item: EvaluatedCase) => ({
    id: item.value.id,
    category: item.value.category,
    tags: item.value.tags,
    score: item.score,
    reasons: item.reasons,
  });
  return {
    falsePositives: results.filter((item) => item.value.expected === "benign" && item.predictedSpoiler).map(summarize),
    falseNegatives: results.filter((item) => item.value.expected === "spoiler" && !item.predictedSpoiler).map(summarize),
  };
}

function option(args: string[], name: string, fallback: string): string {
  const index = args.indexOf(name);
  return index >= 0 ? (args[index + 1] ?? fallback) : fallback;
}

export async function run(args: string[]): Promise<void> {
  const label = option(args, "--label", "current-detector");
  const output = resolve(option(args, "--output", "reports/detection-eval.json"));
  const selectedThreshold = Number(option(args, "--threshold", String(DETECTION_CONSTANTS.threshold)));
  const thresholds = [5, 6, 7, 8, 9];
  const selectedResults = evaluate(CORPUS_CASES, selectedThreshold);
  const calibration = splitResults(selectedResults, "calibration");
  const heldout = splitResults(selectedResults, "heldout");

  const thresholdAnalysis = Object.fromEntries(thresholds.map((threshold) => {
    const results = evaluate(CORPUS_CASES, threshold);
    return [threshold, {
      calibration: metrics(splitResults(results, "calibration")),
      heldout: metrics(splitResults(results, "heldout")),
    }];
  }));

  const report = {
    schemaVersion: 1,
    label,
    corpus: {
      total: CORPUS_CASES.length,
      calibration: calibration.length,
      heldout: heldout.length,
      spoiler: CORPUS_CASES.filter((item) => item.expected === "spoiler").length,
      benign: CORPUS_CASES.filter((item) => item.expected === "benign").length,
      categories: [...new Set(CORPUS_CASES.map((item) => item.category))],
    },
    selectedThreshold,
    metrics: { calibration: metrics(calibration), heldout: metrics(heldout), all: metrics(selectedResults) },
    byCategory: {
      calibration: groupedMetrics(calibration, "category"),
      heldout: groupedMetrics(heldout, "category"),
    },
    byTag: {
      calibration: groupedMetrics(calibration, "tags"),
      heldout: groupedMetrics(heldout, "tags"),
    },
    thresholdAnalysis,
    failures: { calibration: failures(calibration), heldout: failures(heldout) },
  };

  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, `${JSON.stringify(report, null, 2)}\n`, "utf8");

  console.log(`Detection evaluation: ${label}`);
  console.log(`Corpus: ${report.corpus.total} cases (${report.corpus.calibration} calibration / ${report.corpus.heldout} held-out)`);
  console.table({ calibration: report.metrics.calibration, heldout: report.metrics.heldout, all: report.metrics.all });
  console.log("Threshold tradeoff (calibration):");
  console.table(Object.fromEntries(Object.entries(thresholdAnalysis).map(([threshold, value]) => [threshold, value.calibration])));
  console.log(`Calibration FP IDs: ${report.failures.calibration.falsePositives.map((item) => item.id).join(", ") || "none"}`);
  console.log(`Calibration FN IDs: ${report.failures.calibration.falseNegatives.map((item) => item.id).join(", ") || "none"}`);
  console.log(`Held-out FP IDs: ${report.failures.heldout.falsePositives.map((item) => item.id).join(", ") || "none"}`);
  console.log(`Held-out FN IDs: ${report.failures.heldout.falseNegatives.map((item) => item.id).join(", ") || "none"}`);
  console.log(`Machine-readable report: ${output}`);
}
