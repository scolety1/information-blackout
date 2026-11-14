import corpus from "./development.json" with { type: "json" };
import type { Mission4Case } from "./types";

export const MISSION4_CASES = corpus as Mission4Case[];
