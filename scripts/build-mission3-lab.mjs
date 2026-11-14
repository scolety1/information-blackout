import { cp, copyFile, mkdir, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { build } from "esbuild";

const root = resolve(import.meta.dirname, "..");
const outdir = resolve(root, ".mission3-lab-dist");
await rm(outdir, { recursive: true, force: true });
await mkdir(resolve(outdir, "wasm"), { recursive: true });

await build({
  entryPoints: [resolve(root, "src/semantic/lab-content.ts")],
  bundle: true,
  format: "iife",
  outfile: resolve(outdir, "lab-content.js"),
  platform: "browser",
  target: ["chrome120", "edge120"],
  conditions: ["browser", "default"],
  sourcemap: false,
  minify: true,
  legalComments: "none",
});

for (const [entry, output] of [
  ["src/semantic/offscreen-background.ts", "offscreen-background.js"],
  ["src/semantic/offscreen-host.ts", "semantic-host.js"],
  ["src/semantic/worker.ts", "semantic-worker.js"],
]) {
  await build({
    entryPoints: [resolve(root, entry)],
    bundle: true,
    format: "esm",
    outfile: resolve(outdir, output),
    platform: "browser",
    target: ["chrome120", "edge120"],
    conditions: ["browser", "default"],
    sourcemap: false,
    minify: true,
    legalComments: "none",
  });
}

await Promise.all([
  cp(resolve(root, "third_party/models"), resolve(outdir, "models"), { recursive: true }),
  copyFile(resolve(root, "node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.mjs"), resolve(outdir, "wasm/ort-wasm-simd-threaded.mjs")),
  copyFile(resolve(root, "node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.wasm"), resolve(outdir, "wasm/ort-wasm-simd-threaded.wasm")),
  copyFile(resolve(root, "src/semantic/lab.css"), resolve(outdir, "lab.css")),
  copyFile(resolve(root, "src/semantic/semantic-host.html"), resolve(outdir, "semantic-host.html")),
]);

const manifest = {
  manifest_version: 3,
  name: "Information Blackout Mission 3 Semantic Lab",
  version: "0.3.0",
  description: "Isolated, non-adopted local semantic feasibility harness.",
  background: { service_worker: "offscreen-background.js", type: "module" },
  permissions: ["offscreen"],
  content_security_policy: {
    extension_pages: "script-src 'self' 'wasm-unsafe-eval'; object-src 'self'",
  },
  content_scripts: [{
    matches: ["http://*/*", "https://*/*"],
    js: ["lab-content.js"],
    css: ["lab.css"],
    run_at: "document_idle",
  }],
};
await writeFile(resolve(outdir, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
console.log(`Built isolated Mission 3 semantic lab in ${outdir}`);
