import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { ChallengeDocument } from "./types";

export const CHALLENGE_PATH = resolve("eval/mission3/challenge.json");
export const CHECKSUM_PATH = resolve("eval/mission3/challenge.sha256");

export async function loadFrozenChallenge(): Promise<{ document: ChallengeDocument; checksum: string }> {
  const [serialized, checksumDocument] = await Promise.all([readFile(CHALLENGE_PATH, "utf8"), readFile(CHECKSUM_PATH, "utf8")]);
  const expectedChecksum = checksumDocument.trim().split(/\s+/u)[0] ?? "";
  const checksum = createHash("sha256").update(serialized).digest("hex");
  if (!expectedChecksum || checksum !== expectedChecksum) {
    throw new Error(`Frozen challenge checksum mismatch: expected ${expectedChecksum}, received ${checksum}.`);
  }
  return { document: JSON.parse(serialized) as ChallengeDocument, checksum };
}
