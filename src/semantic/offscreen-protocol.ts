import type { SemanticWorkerRequest, SemanticWorkerResponse } from "./protocol";

export interface OffscreenRequest {
  target: "semantic-host-request";
  payload: SemanticWorkerRequest;
}

export interface OffscreenInnerRequest {
  target: "semantic-host-inner";
  payload: SemanticWorkerRequest;
}

export type OffscreenMessage = OffscreenRequest | OffscreenInnerRequest;
export type OffscreenResponse = SemanticWorkerResponse;
