import { copyFile, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { build } from "esbuild";

const root = resolve(import.meta.dirname, "..");
const outdir = resolve(root, "dist");

await rm(outdir, { recursive: true, force: true });
await mkdir(outdir, { recursive: true });

await build({
  entryPoints: {
    content: resolve(root, "src/content/index.ts"),
    popup: resolve(root, "src/ui/popup.ts"),
  },
  bundle: true,
  format: "iife",
  outdir,
  target: ["chrome120", "edge120"],
  sourcemap: false,
  minify: false,
  legalComments: "none",
});

await Promise.all([
  copyFile(resolve(root, "manifest.json"), resolve(outdir, "manifest.json")),
  copyFile(resolve(root, "src/content/content.css"), resolve(outdir, "content.css")),
  copyFile(resolve(root, "src/content/feedback.css"), resolve(outdir, "feedback.css")),
  copyFile(resolve(root, "src/ui/popup.html"), resolve(outdir, "popup.html")),
  copyFile(resolve(root, "src/ui/popup.css"), resolve(outdir, "popup.css")),
  copyFile(resolve(root, "src/ui/popup-feedback.css"), resolve(outdir, "popup-feedback.css")),
]);

const manifest = JSON.parse(await readFile(resolve(outdir, "manifest.json"), "utf8"));
await writeFile(
  resolve(outdir, "BUILD_INFO.txt"),
  `Information Blackout ${manifest.version}\nLoad this directory unpacked in Chrome or Edge.\n`,
  "utf8",
);

console.log(`Built Information Blackout ${manifest.version} in ${outdir}`);
