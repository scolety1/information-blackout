export interface SemanticWorkerInitializeRequest {
  type: "initialize";
  requestId: string;
  forceFailure?: boolean;
}

export interface SemanticWorkerClassifyRequest {
  type: "classify";
  requestId: string;
  input: string;
}

export type SemanticWorkerRequest = SemanticWorkerInitializeRequest | SemanticWorkerClassifyRequest;

export interface SemanticWorkerResponse {
  requestId: string;
  status: "ready" | "result" | "failed" | "overloaded";
  spoilerProbability?: number;
  shouldProtect?: boolean;
  threshold?: number;
  modelId?: string;
  errorCode?: "initialization-failed" | "inference-failed" | "queue-overloaded";
}
