import { env, pipeline, type FeatureExtractionPipeline } from "@huggingface/transformers";
import artifactJson from "./artifacts/spoiler-head.json";
import { predictWithHead, type SemanticHeadArtifact } from "./head";
import type { SemanticWorkerRequest, SemanticWorkerResponse } from "./protocol";

const artifact = artifactJson as SemanticHeadArtifact;
const MAX_PENDING_CLASSIFICATIONS = 32;
const pending: Array<Extract<SemanticWorkerRequest, { type: "classify" }>> = [];
let extractor: FeatureExtractionPipeline | null = null;
let initialization: Promise<void> | null = null;
let forcedFailure = false;
let draining = false;

function respond(response: SemanticWorkerResponse): void {
  postMessage(response);
}

async function initialize(forceFailure = false): Promise<void> {
  if (forceFailure) {
    forcedFailure = true;
    setTimeout(() => { forcedFailure = false; initialization = null; }, 250);
    throw new Error("Forced semantic lab initialization failure.");
  }
  if (forcedFailure) throw new Error("Semantic lab initialization is disabled after failure.");
  if (extractor) return;
  if (!initialization) {
    initialization = (async () => {
      const extensionRoot = new URL("./", import.meta.url).href;
      env.localModelPath = `${extensionRoot}models/`;
      env.allowLocalModels = true;
      env.allowRemoteModels = false;
      env.useWasmCache = false;
      if (!env.backends.onnx.wasm) throw new Error("ONNX WASM backend is unavailable.");
      env.backends.onnx.wasm.wasmPaths = {
        mjs: `${extensionRoot}wasm/ort-wasm-simd-threaded.mjs`,
        wasm: `${extensionRoot}wasm/ort-wasm-simd-threaded.wasm`,
      };
      extractor = await pipeline("feature-extraction", artifact.modelId, { dtype: "q8" });
    })();
  }
  await initialization;
}

async function drain(): Promise<void> {
  if (draining) return;
  draining = true;
  while (pending.length > 0) {
    const request = pending.shift();
    if (!request) continue;
    try {
      await initialize();
      if (!extractor) throw new Error("Semantic extractor unavailable.");
      const output = await extractor(request.input, { pooling: "mean", normalize: true });
      const probability = predictWithHead(output.data as Float32Array, artifact);
      respond({
        requestId: request.requestId,
        status: "result",
        spoilerProbability: probability,
        shouldProtect: probability >= artifact.threshold,
        threshold: artifact.threshold,
        modelId: artifact.modelId,
      });
    } catch {
      respond({ requestId: request.requestId, status: "failed", errorCode: "inference-failed" });
    }
  }
  draining = false;
}

self.addEventListener("message", (event: MessageEvent<SemanticWorkerRequest>) => {
  const request = event.data;
  if (request.type === "initialize") {
    void initialize(request.forceFailure)
      .then(() => respond({ requestId: request.requestId, status: "ready", modelId: artifact.modelId }))
      .catch(() => respond({ requestId: request.requestId, status: "failed", errorCode: "initialization-failed" }));
    return;
  }
  if (pending.length >= MAX_PENDING_CLASSIFICATIONS) {
    respond({ requestId: request.requestId, status: "overloaded", errorCode: "queue-overloaded" });
    return;
  }
  pending.push(request);
  void drain();
});
