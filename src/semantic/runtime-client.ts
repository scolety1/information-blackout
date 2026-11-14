import type { LocalSemanticClassifier } from "./classifier";
import type { SemanticResult } from "./head";
import type { SemanticWorkerRequest, SemanticWorkerResponse } from "./protocol";

export class ExtensionWorkerSemanticClassifier implements LocalSemanticClassifier {
  private activeClassifications = 0;
  async initialize(forceFailure = false): Promise<SemanticResult["status"]> {
    const response = await this.request({ type: "initialize", requestId: crypto.randomUUID(), forceFailure });
    return response.status === "ready" ? "ready" : "failed";
  }

  async classify(input: string): Promise<SemanticResult> {
    if (this.activeClassifications >= 32) {
      return { status: "overloaded", spoilerProbability: 0, shouldProtect: false, threshold: 1, modelId: "Xenova/all-MiniLM-L6-v2" };
    }
    this.activeClassifications += 1;
    let response: SemanticWorkerResponse;
    try {
      response = await this.request({ type: "classify", requestId: crypto.randomUUID(), input });
    } finally {
      this.activeClassifications -= 1;
    }
    if (response.status !== "result") {
      return {
        status: response.status === "overloaded" ? "overloaded" : "failed",
        spoilerProbability: 0,
        shouldProtect: false,
        threshold: response.threshold ?? 1,
        modelId: response.modelId ?? "Xenova/all-MiniLM-L6-v2",
      };
    }
    return {
      status: "ready",
      spoilerProbability: response.spoilerProbability ?? 0,
      shouldProtect: response.shouldProtect ?? false,
      threshold: response.threshold ?? 1,
      modelId: response.modelId ?? "Xenova/all-MiniLM-L6-v2",
    };
  }

  dispose(): void {
    // Manifest V3 owns the extension service-worker lifecycle.
  }

  private async request(request: SemanticWorkerRequest): Promise<SemanticWorkerResponse> {
    try {
      const response = await chrome.runtime.sendMessage({ target: "semantic-host-request", payload: request }) as SemanticWorkerResponse | undefined;
      return response ?? { requestId: request.requestId, status: "failed", errorCode: "inference-failed" };
    } catch {
      return { requestId: request.requestId, status: "failed", errorCode: "inference-failed" };
    }
  }
}
