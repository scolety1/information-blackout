import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { build } from "esbuild";

const root = resolve(import.meta.dirname, "..");
const cacheDirectory = resolve(root, ".eval-cache");
const outputFile = resolve(cacheDirectory, "mission3-semantic.mjs");
await mkdir(cacheDirectory, { recursive: true });
await build({
  entryPoints: [resolve(root, "eval/mission3/semantic.ts")],
  outfile: outputFile,
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node20",
  sourcemap: false,
  legalComments: "none",
  external: ["@huggingface/transformers"],
});
const evaluator = await import(`${pathToFileURL(outputFile).href}?run=${Date.now()}`);
await evaluator.runSemanticTrial(process.argv[2]);
