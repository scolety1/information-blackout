import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { scoreTextForTopic } from "../../src/detection/scorer";
import { loadFrozenChallenge } from "./challenge";
import { failureSummary, groupedMetrics, splitMetrics } from "./metrics";
import type { Prediction } from "./types";

export async function runBaseline(outputArgument = "reports/mission3-deterministic-baseline.json"): Promise<void> {
  const { document, checksum } = await loadFrozenChallenge();
  const results: Prediction[] = document.cases.map((value) => {
    const result = scoreTextForTopic(value.text, value.topic);
    return { value, predictedSpoiler: result.shouldProtect, score: result.score, reasons: result.reasons };
  });
  const output = resolve(outputArgument);
  const report = {
    schemaVersion: 1,
    label: "mission2-deterministic-on-frozen-mission3-ood",
    challengeChecksum: checksum,
    corpus: {
      total: document.cases.length,
      spoiler: document.cases.filter((item) => item.expected === "spoiler").length,
      benign: document.cases.filter((item) => item.expected === "benign").length,
      bySplit: Object.fromEntries([...new Set(document.cases.map((item) => item.split))].map((split) => [split, document.cases.filter((item) => item.split === split).length])),
      byCategory: Object.fromEntries([...new Set(document.cases.map((item) => item.category))].map((category) => [category, document.cases.filter((item) => item.category === category).length])),
      indirectReveal: document.cases.filter((item) => item.tags.includes("indirect-reveal")).length,
      benignAdversarial: document.cases.filter((item) => item.tags.includes("benign-adversarial")).length,
    },
    metrics: splitMetrics(results),
    byCategory: groupedMetrics(results, "category"),
    byTag: groupedMetrics(results, "tags"),
    failures: failureSummary(results),
    scoreDistribution: Object.fromEntries([...new Set(results.map((item) => item.score))].sort((a, b) => a - b).map((score) => [score, results.filter((item) => item.score === score).length])),
  };
  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log(`Mission 2 deterministic baseline on frozen Mission 3 OOD corpus (${checksum})`);
  console.table(report.metrics);
  console.log(`FP IDs: ${report.failures.falsePositives.map((item) => item.id).join(", ") || "none"}`);
  console.log(`FN IDs: ${report.failures.falseNegatives.map((item) => item.id).join(", ") || "none"}`);
  console.log(`Machine-readable report: ${output}`);
}
