import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { env, pipeline } from "@huggingface/transformers";

const root = resolve(import.meta.dirname, "..");
const cacheDirectory = resolve(root, ".model-cache");
await mkdir(cacheDirectory, { recursive: true });

env.cacheDir = cacheDirectory;
env.allowRemoteModels = true;
env.allowLocalModels = false;

const extractor = await pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2", { dtype: "q8" });
const output = await extractor("Local semantic model acquisition check.", { pooling: "mean", normalize: true });
if (output.dims[output.dims.length - 1] !== 384) throw new Error(`Unexpected embedding shape: ${output.dims.join("x")}`);
console.log(`Cached Xenova/all-MiniLM-L6-v2 q8 with ${output.dims.at(-1)}-dimension output in ${cacheDirectory}.`);
