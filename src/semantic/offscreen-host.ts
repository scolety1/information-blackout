import type { OffscreenMessage, OffscreenResponse } from "./offscreen-protocol";
import type { SemanticWorkerResponse } from "./protocol";

const worker = new Worker(chrome.runtime.getURL("semantic-worker.js"), { type: "module" });
const pending = new Map<string, (response: SemanticWorkerResponse) => void>();

worker.addEventListener("message", (event: MessageEvent<SemanticWorkerResponse>) => {
  const respond = pending.get(event.data.requestId);
  if (!respond) return;
  pending.delete(event.data.requestId);
  respond(event.data);
});

worker.addEventListener("error", () => {
  for (const [requestId, respond] of pending) {
    respond({ requestId, status: "failed", errorCode: "initialization-failed" });
  }
  pending.clear();
});

chrome.runtime.onMessage.addListener((message: OffscreenMessage, _sender, sendResponse) => {
  if (message.target !== "semantic-host-inner") return false;
  pending.set(message.payload.requestId, sendResponse as (response: OffscreenResponse) => void);
  worker.postMessage(message.payload);
  return true;
});
