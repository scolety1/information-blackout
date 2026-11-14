import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { performance } from "node:perf_hooks";
import { env, pipeline } from "@huggingface/transformers";
import { scoreTextForTopic } from "../../src/detection/scorer";
import { predictWithHead, type SemanticHeadArtifact } from "../../src/semantic/head";
import { formatSemanticInput } from "../../src/semantic/input";
import { loadFrozenChallenge } from "./challenge";
import { failureSummary, groupedMetrics, metrics, splitMetrics } from "./metrics";
import type { ChallengeCase, Prediction } from "./types";

interface GateCandidate {
  lowScore: number;
  highScore: number;
  routingRate: number;
  development: ReturnType<typeof metrics>;
  qualified: boolean;
}

function percentile(values: number[], fraction: number): number {
  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * fraction) - 1));
  return Number((sorted[index] ?? 0).toFixed(2));
}

function toPrediction(value: ChallengeCase, predictedSpoiler: boolean, score: number, reasons: string[]): Prediction {
  return { value, predictedSpoiler, score, reasons };
}

function hybridPrediction(
  deterministic: Prediction,
  semantic: Prediction,
  lowScore: number,
  highScore: number,
): Prediction {
  if (deterministic.score < lowScore) {
    return toPrediction(deterministic.value, false, deterministic.score, ["deterministic-high-confidence-benign"]);
  }
  if (deterministic.score >= highScore) {
    return toPrediction(deterministic.value, true, deterministic.score, ["deterministic-high-confidence-spoiler"]);
  }
  return toPrediction(
    deterministic.value,
    semantic.predictedSpoiler,
    semantic.score,
    ["semantic-escalation", `semantic-probability:${semantic.score.toFixed(4)}`],
  );
}

function selectGate(deterministic: Prediction[], semantic: Prediction[]): { selected: GateCandidate; candidates: GateCandidate[] } {
  const developmentIndices = deterministic
    .map((item, index) => item.value.split === "development" ? index : -1)
    .filter((index) => index >= 0);
  const candidates: GateCandidate[] = [];
  for (const lowScore of [0, 2.5, 3.5, 4.5, 6.5]) {
    for (const highScore of [7, 9, 11, 13, 15]) {
      if (lowScore >= highScore) continue;
      const routed = developmentIndices.filter((index) => {
        const score = deterministic[index]?.score ?? 0;
        return score >= lowScore && score < highScore;
      }).length;
      const predictions = developmentIndices.map((index) => hybridPrediction(
        deterministic[index] as Prediction,
        semantic[index] as Prediction,
        lowScore,
        highScore,
      ));
      const development = metrics(predictions);
      const routingRate = routed / developmentIndices.length;
      candidates.push({
        lowScore,
        highScore,
        routingRate: Number(routingRate.toFixed(4)),
        development,
        qualified: development.precision >= 0.97 && routingRate <= 0.5,
      });
    }
  }
  const withinRoutingLimit = candidates.filter((item) => item.routingRate <= 0.5);
  const qualified = withinRoutingLimit.filter((item) => item.qualified);
  const pool = qualified.length > 0 ? qualified : withinRoutingLimit;
  const selected = [...pool].sort((left, right) =>
    right.development.f1 - left.development.f1
    || right.development.precision - left.development.precision
    || left.routingRate - right.routingRate
    || left.highScore - right.highScore,
  )[0];
  if (!selected) throw new Error("No valid semantic gate candidate.");
  return { selected, candidates };
}

export async function runSemanticTrial(outputArgument = "reports/mission3-semantic-trial.json"): Promise<void> {
  const root = process.cwd();
  const { document, checksum } = await loadFrozenChallenge();
  const artifact = JSON.parse(await readFile(resolve(root, "src/semantic/artifacts/spoiler-head.json"), "utf8")) as SemanticHeadArtifact;
  const vendoredModelRoot = resolve(root, "third_party/models");
  const modelRoot = existsSync(resolve(vendoredModelRoot, "Xenova/all-MiniLM-L6-v2"))
    ? vendoredModelRoot
    : resolve(root, ".model-cache");

  env.localModelPath = `${modelRoot}/`;
  env.allowLocalModels = true;
  env.allowRemoteModels = false;
  const memoryBefore = process.memoryUsage().rss;
  const initializationStart = performance.now();
  const extractor = await pipeline("feature-extraction", artifact.modelId, { dtype: "q8" });
  const initializationMs = performance.now() - initializationStart;
  const memoryAfter = process.memoryUsage().rss;

  const inputs = document.cases.map((item) => formatSemanticInput(item.text, item.topic));
  const warmLatencies: number[] = [];
  for (const input of inputs.slice(0, 30)) {
    const started = performance.now();
    await extractor(input, { pooling: "mean", normalize: true });
    warmLatencies.push(performance.now() - started);
  }

  const embeddings: number[][] = [];
  const batchStart = performance.now();
  for (let start = 0; start < inputs.length; start += 32) {
    const output = await extractor(inputs.slice(start, start + 32), { pooling: "mean", normalize: true });
    embeddings.push(...output.tolist() as number[][]);
  }
  const batchEvaluationMs = performance.now() - batchStart;

  const semanticResults: Prediction[] = document.cases.map((value, index) => {
    const probability = predictWithHead(embeddings[index] ?? [], artifact);
    return toPrediction(value, probability >= artifact.threshold, probability, ["semantic-only"]);
  });
  const deterministicResults: Prediction[] = document.cases.map((value) => {
    const result = scoreTextForTopic(value.text, value.topic);
    return toPrediction(value, result.shouldProtect, result.score, result.reasons);
  });
  const gate = selectGate(deterministicResults, semanticResults);
  const hybridResults = deterministicResults.map((item, index) => hybridPrediction(
    item,
    semanticResults[index] as Prediction,
    gate.selected.lowScore,
    gate.selected.highScore,
  ));

  const grayZoneIndices = deterministicResults
    .map((item, index) => item.score >= gate.selected.lowScore && item.score < gate.selected.highScore ? index : -1)
    .filter((index) => index >= 0);
  const deterministicMisses = deterministicResults
    .map((item, index) => item.value.expected === "spoiler" && !item.predictedSpoiler ? index : -1)
    .filter((index) => index >= 0);
  const indirectMisses = deterministicMisses.filter((index) => deterministicResults[index]?.value.tags.includes("indirect-reveal"));
  const recoveredIndirect = indirectMisses.filter((index) => hybridResults[index]?.predictedSpoiler);
  const newFalsePositives = hybridResults.filter((item, index) =>
    item.value.expected === "benign" && item.predictedSpoiler && !deterministicResults[index]?.predictedSpoiler,
  );
  const removedFalsePositives = deterministicResults.filter((item, index) =>
    item.value.expected === "benign" && item.predictedSpoiler && !hybridResults[index]?.predictedSpoiler,
  );

  const describe = (results: Prediction[]) => ({
    metrics: splitMetrics(results),
    byCategory: groupedMetrics(results, "category"),
    byTag: groupedMetrics(results, "tags"),
    failures: failureSummary(results),
  });
  const report = {
    schemaVersion: 1,
    label: "mission3-local-minilm-adoption-trial",
    challengeChecksum: checksum,
    model: {
      ...artifact,
      weights: undefined,
      artifactBytes: Buffer.byteLength(JSON.stringify(artifact)),
      localModelRoot: modelRoot === vendoredModelRoot ? "third_party/models" : ".model-cache",
    },
    deterministic: describe(deterministicResults),
    semanticOnly: describe(semanticResults),
    hybrid: describe(hybridResults),
    gate: {
      lowScore: gate.selected.lowScore,
      highScore: gate.selected.highScore,
      selectedOn: "frozen development split only",
      developmentQualified: gate.selected.qualified,
      developmentMetrics: gate.selected.development,
      candidates: gate.candidates,
      routing: {
        candidates: document.cases.length,
        deterministicHighConfidenceBenign: deterministicResults.filter((item) => item.score < gate.selected.lowScore).length,
        deterministicHighConfidenceSpoiler: deterministicResults.filter((item) => item.score >= gate.selected.highScore).length,
        grayZoneEscalations: grayZoneIndices.length,
        grayZonePercentage: Number((grayZoneIndices.length / document.cases.length).toFixed(4)),
      },
    },
    indirect: {
      deterministicMisses: indirectMisses.length,
      recoveredByHybrid: recoveredIndirect.length,
      relativeReduction: indirectMisses.length === 0 ? 0 : Number((recoveredIndirect.length / indirectMisses.length).toFixed(4)),
      remainingIds: indirectMisses.filter((index) => !hybridResults[index]?.predictedSpoiler).map((index) => document.cases[index]?.id),
    },
    benignImpact: {
      newFalsePositiveCount: newFalsePositives.length,
      newFalsePositiveIds: newFalsePositives.map((item) => item.value.id),
      removedFalsePositiveCount: removedFalsePositives.length,
      removedFalsePositiveIds: removedFalsePositives.map((item) => item.value.id),
    },
    performance: {
      initializationMs: Number(initializationMs.toFixed(2)),
      warmSingleFirstMs: Number((warmLatencies[0] ?? 0).toFixed(2)),
      warmSingleP50Ms: percentile(warmLatencies, 0.5),
      warmSingleP95Ms: percentile(warmLatencies, 0.95),
      batchEvaluationCandidates: document.cases.length,
      batchEvaluationMs: Number(batchEvaluationMs.toFixed(2)),
      observedRssDeltaBytes: Math.max(0, memoryAfter - memoryBefore),
    },
  };
  const output = resolve(outputArgument);
  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log(`Mission 3 semantic trial on frozen corpus ${checksum}`);
  console.table({
    deterministic: report.deterministic.metrics.overall,
    semanticOnly: report.semanticOnly.metrics.overall,
    hybrid: report.hybrid.metrics.overall,
  });
  console.log("Selected gate and routing:", report.gate);
  console.log("Indirect recovery:", report.indirect);
  console.log("Performance:", report.performance);
  console.log(`Machine-readable report: ${output}`);
}
