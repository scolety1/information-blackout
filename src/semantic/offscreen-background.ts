import type { OffscreenMessage, OffscreenResponse } from "./offscreen-protocol";

let creatingDocument: Promise<void> | null = null;

async function ensureOffscreenDocument(): Promise<void> {
  if (await chrome.offscreen.hasDocument()) return;
  if (!creatingDocument) {
    creatingDocument = chrome.offscreen.createDocument({
      url: "semantic-host.html",
      reasons: [chrome.offscreen.Reason.WORKERS],
      justification: "Run the isolated local semantic feasibility model off the webpage main thread.",
    }).finally(() => {
      creatingDocument = null;
    });
  }
  await creatingDocument;
}

chrome.runtime.onMessage.addListener((message: OffscreenMessage, _sender, sendResponse) => {
  if (message.target !== "semantic-host-request") return false;
  void ensureOffscreenDocument()
    .then(async () => chrome.runtime.sendMessage({ target: "semantic-host-inner", payload: message.payload } satisfies OffscreenMessage))
    .then((response: OffscreenResponse) => sendResponse(response))
    .catch(() => sendResponse({ requestId: message.payload.requestId, status: "failed", errorCode: "initialization-failed" } satisfies OffscreenResponse));
  return true;
});
