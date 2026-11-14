import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { build } from "esbuild";

const root = resolve(import.meta.dirname, "..");
const cacheDirectory = resolve(root, ".eval-cache");
const outputFile = resolve(cacheDirectory, "train-mission3-head.mjs");
await mkdir(cacheDirectory, { recursive: true });

await build({
  stdin: {
    contents: `
      import { env, pipeline } from "@huggingface/transformers";
      import { writeFile } from "node:fs/promises";
      import { resolve } from "node:path";
      import { buildTrainingCases } from "./eval/mission3/training.ts";

      const root = process.cwd();
      env.localModelPath = resolve(root, ".model-cache") + "/";
      env.allowLocalModels = true;
      env.allowRemoteModels = false;
      const extractor = await pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2", { dtype: "q8" });
      const { cases, checksum } = buildTrainingCases();
      const embeddings = [];
      const batchSize = 32;
      for (let start = 0; start < cases.length; start += batchSize) {
        const batch = cases.slice(start, start + batchSize);
        const output = await extractor(batch.map((item) => item.input), { pooling: "mean", normalize: true });
        embeddings.push(...output.tolist());
      }
      const trainIndices = cases.map((item, index) => item.split === "training" ? index : -1).filter((index) => index >= 0);
      const validationIndices = cases.map((item, index) => item.split === "validation" ? index : -1).filter((index) => index >= 0);
      const dimensions = embeddings[0].length;
      const weights = new Float64Array(dimensions);
      let bias = 0;
      const learningRate = 0.8;
      const l2 = 0.002;
      const sigmoid = (value) => value >= 0 ? 1 / (1 + Math.exp(-value)) : Math.exp(value) / (1 + Math.exp(value));
      for (let epoch = 0; epoch < 320; epoch += 1) {
        const gradient = new Float64Array(dimensions);
        let biasGradient = 0;
        for (const index of trainIndices) {
          const vector = embeddings[index];
          let logit = bias;
          for (let feature = 0; feature < dimensions; feature += 1) logit += weights[feature] * vector[feature];
          const error = sigmoid(logit) - cases[index].label;
          biasGradient += error;
          for (let feature = 0; feature < dimensions; feature += 1) gradient[feature] += error * vector[feature];
        }
        const scale = 1 / trainIndices.length;
        for (let feature = 0; feature < dimensions; feature += 1) {
          weights[feature] -= learningRate * (gradient[feature] * scale + l2 * weights[feature]);
        }
        bias -= learningRate * biasGradient * scale;
      }
      const probability = (index) => {
        let logit = bias;
        for (let feature = 0; feature < dimensions; feature += 1) logit += weights[feature] * embeddings[index][feature];
        return sigmoid(logit);
      };
      const candidates = Array.from({ length: 81 }, (_, index) => 0.1 + index * 0.01);
      const scored = candidates.map((threshold) => {
        let tp = 0, fp = 0, fn = 0;
        for (const index of validationIndices) {
          const predicted = probability(index) >= threshold;
          if (predicted && cases[index].label === 1) tp += 1;
          if (predicted && cases[index].label === 0) fp += 1;
          if (!predicted && cases[index].label === 1) fn += 1;
        }
        const precision = tp + fp === 0 ? 0 : tp / (tp + fp);
        const recall = tp + fn === 0 ? 0 : tp / (tp + fn);
        const f1 = precision + recall === 0 ? 0 : 2 * precision * recall / (precision + recall);
        return { threshold, precision, recall, f1, tp, fp, fn };
      });
      const eligible = scored.filter((item) => item.precision >= 0.97 && item.recall > 0);
      const selected = (eligible.length > 0 ? eligible : scored).sort((left, right) => right.f1 - left.f1 || right.precision - left.precision || left.threshold - right.threshold)[0];
      const artifact = {
        schemaVersion: 1,
        modelId: "Xenova/all-MiniLM-L6-v2",
        modelRevision: "751bff37182d3f1213fa05d7196b954e230abad9",
        embeddingDimensions: dimensions,
        seed: 3102026,
        threshold: Number(selected.threshold.toFixed(2)),
        weights: Array.from(weights, (value) => Number(value.toFixed(8))),
        bias: Number(bias.toFixed(8)),
        trainingCases: trainIndices.length,
        validationCases: validationIndices.length,
        trainingDataChecksum: checksum,
        validationMetrics: { ...selected, threshold: Number(selected.threshold.toFixed(2)) },
      };
      const outputPath = resolve(root, "src/semantic/artifacts/spoiler-head.json");
      await writeFile(outputPath, JSON.stringify(artifact, null, 2) + "\\n", "utf8");
      console.log(JSON.stringify({ outputPath, ...artifact, weights: undefined }, null, 2));
    `,
    resolveDir: root,
    sourcefile: "mission3-train-entry.ts",
    loader: "ts",
  },
  outfile: outputFile,
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node20",
  sourcemap: false,
  legalComments: "none",
  external: ["@huggingface/transformers"],
});

await mkdir(resolve(root, "src/semantic/artifacts"), { recursive: true });
await import(`${pathToFileURL(outputFile).href}?run=${Date.now()}`);
