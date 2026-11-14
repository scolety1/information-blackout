import { build } from "esbuild";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const directory = await mkdtemp(join(tmpdir(), "information-blackout-m4-eval-"));
const output = resolve(directory, "eval.mjs");
try {
  await build({ entryPoints: [resolve("eval/mission4/run.ts")], outfile: output, bundle: true, platform: "node", format: "esm", target: "node22" });
  const module = await import(pathToFileURL(output).href);
  await module.runMission4(process.argv.slice(2));
} finally {
  await rm(directory, { recursive: true, force: true });
}
