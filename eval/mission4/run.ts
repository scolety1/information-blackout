import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import * as scorer from "../../src/detection/scorer";
import { MISSION4_CASES } from "./corpus";
import { mission4Grouped, mission4Metrics, type Mission4EvaluatedCase } from "./metrics";

function argument(args: string[], name: string, fallback: string): string {
  const index = args.indexOf(name);
  return index >= 0 ? (args[index + 1] ?? fallback) : fallback;
}

export async function runMission4(args: string[]): Promise<void> {
  const detectorVersion = (scorer as typeof scorer & { DETECTOR_VERSION?: string }).DETECTOR_VERSION ?? "detector-v0.3-mission3-baseline";
  const output = resolve(argument(args, "--output", "reports/mission4-development-final.json"));
  const label = argument(args, "--label", detectorVersion);
  const evaluated: Mission4EvaluatedCase[] = MISSION4_CASES.map((value) => ({ value, result: scorer.scoreTextForTopic(value.text, value.topic) }));
  const development = evaluated.filter((x) => x.value.split === "development");
  const validation = evaluated.filter((x) => x.value.split === "validation");
  const source = await readFile(resolve("src/detection/scorer.ts"));
  const report = {
    schemaVersion: 1,
    label,
    detectorVersion,
    detectorSourceSha256: createHash("sha256").update(source).digest("hex"),
    corpusSha256: createHash("sha256").update(await readFile(resolve("eval/mission4/development.json"))).digest("hex"),
    corpus: {
      total: MISSION4_CASES.length,
      development: development.length,
      validation: validation.length,
      spoiler: MISSION4_CASES.filter((x) => x.expected === "spoiler").length,
      benign: MISSION4_CASES.filter((x) => x.expected === "benign").length,
    },
    metrics: { development: mission4Metrics(development), validation: mission4Metrics(validation), overall: mission4Metrics(evaluated) },
    byCategory: { development: mission4Grouped(development, "category"), validation: mission4Grouped(validation, "category") },
    byFamily: { development: mission4Grouped(development, "family"), validation: mission4Grouped(validation, "family") },
    falsePositiveTaxonomy: Object.fromEntries(Object.entries(mission4Grouped(evaluated.filter((x) => x.value.expected === "benign" && x.result.shouldProtect), "family")).map(([key, value]) => [key, value.total])),
    failures: {
      development: development.filter((x) => x.result.shouldProtect !== (x.value.expected === "spoiler")).map((x) => ({ id: x.value.id, family: x.value.family, expected: x.value.expected, score: x.result.score, rulePath: x.result.explanation.rulePath ?? "legacy-flat-score", reasons: x.result.reasons })),
      validation: validation.filter((x) => x.result.shouldProtect !== (x.value.expected === "spoiler")).map((x) => ({ id: x.value.id, family: x.value.family, expected: x.value.expected, score: x.result.score, rulePath: x.result.explanation.rulePath ?? "legacy-flat-score", reasons: x.result.reasons })),
    },
  };
  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log(`Mission 4 development evaluation: ${label}`);
  console.table(report.metrics);
  console.log("False-positive taxonomy:", report.falsePositiveTaxonomy);
  console.log(`Report: ${output}`);
}
