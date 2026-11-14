import type { ProtectedTopic } from "../shared/topic";
import { findPhraseOccurrences, normalizeText } from "./normalize";

export const DETECTOR_VERSION = "detector-v0.4-structured";

export const DETECTION_CONSTANTS = {
  threshold: 7,
  primaryTermWeight: 3,
  aliasTermWeight: 3,
  additionalDistinctTermWeight: 2,
  multiTermContextBonus: 2,
  repeatedTermBonus: 1,
  closeProximityBonus: 2,
  mediumProximityBonus: 1,
  localContextBonus: 0.5,
  closeProximityCharacters: 90,
  mediumProximityCharacters: 180,
  localContextCharacters: 320,
  maxIndicatorScore: 6,
} as const;

interface TextMatch {
  id: string;
  label: string;
  start: number;
  end: number;
  weight: number;
  kind: "topic" | "alias" | "indicator";
}

interface Evidence { id: string; weight: number }

export interface DetectionExplanation {
  detectorVersion: string;
  rulePath: string;
  termMatches: Array<{ label: string; kind: "topic" | "alias" }>;
  indicatorMatches: Evidence[];
  bonuses: Evidence[];
  adjustments: Evidence[];
  topicRelevance: "none" | "ambiguous-alias" | "relevant" | "strong";
  epistemicStatus: "asserted" | "speculative" | "questioned" | "conditional" | "negated";
  temporalStatus: "unknown" | "future" | "live" | "completed" | "historical";
  revealEvidence: string[];
  benignEvidence: string[];
  collisionSafeguards: string[];
  indicatorScore: number;
  finalScore: number;
}

export interface DetectionResult {
  shouldProtect: boolean;
  score: number;
  threshold: number;
  topicId: string;
  topicName: string;
  matchedTerms: string[];
  matchedIndicators: string[];
  reasons: string[];
  explanation: DetectionExplanation;
}

const INDICATORS: Array<{ id: string; pattern: RegExp; weight: number }> = [
  { id: "ending-explained", pattern: /\bending explained\b/gu, weight: 5 },
  { id: "death", pattern: /\b(?:dies|died|death|killed|dead)\b/gu, weight: 4 },
  { id: "survival", pattern: /\b(?:survives?|survived|is alive|are alive)\b/gu, weight: 4 },
  { id: "betrayal", pattern: /\b(?:betrays?|betrayed|betrayal)\b/gu, weight: 4 },
  { id: "winner", pattern: /\b(?:wins?|won|winners?|crowns?|crowned|takes? the title|lifted the trophy|trophy sits)\b/gu, weight: 4 },
  { id: "champion", pattern: /\b(?:champion|championship)\b/gu, weight: 4 },
  { id: "eliminated", pattern: /\b(?:eliminated|sent home|sends? .{1,35} home)\b/gu, weight: 4 },
  { id: "defeated", pattern: /\b(?:defeat(?:s|ed)?|beat|sweep|victory)\b/gu, weight: 4 },
  { id: "completed-result", pattern: /\b(?:final|full time|final score|finishes? second|runner-up)\b/gu, weight: 4 },
  { id: "live-score", pattern: /\bwith seconds remaining\b.{0,90}\bleads?\b/gu, weight: 4 },
  { id: "finalists", pattern: /\bfinal two contestants?\b/gu, weight: 4 },
  { id: "identity", pattern: /\b(?:reveals?|revealed|identified|identifies|turns? out|is actually|masked|secretly)\b/gu, weight: 3.5 },
  { id: "relationship", pattern: /\b(?:siblings?|father|mother|parent|related|relationship|reunites?|breaks? up)\b/gu, weight: 3.5 },
  { id: "finale", pattern: /\bfinale\b/gu, weight: 3 },
  { id: "ending", pattern: /\b(?:at the end|ending|final act|last chapter)\b/gu, weight: 3 },
  { id: "post-credits", pattern: /\bpost[- ]credits?\b/gu, weight: 4 },
  { id: "boss", pattern: /\bfinal boss\b/gu, weight: 4 },
  { id: "confirmed", pattern: /\b(?:confirms?|confirmed|proves?|the truth is|in fact)\b/gu, weight: 3 },
  { id: "concrete-state", pattern: /\b(?:destroys?|leaves? alone|created the disaster|was the prison|holding every missing|opens? .{0,35} where|awake beneath|had been the guide)\b/gu, weight: 3.5 },
  { id: "spoiler-warning", pattern: /\bspoilers?\b/gu, weight: 1 },
];

const COMMON_WORDS = new Set(["bear", "it", "up", "lost", "cars", "frozen", "union", "orbit", "garden", "engine", "thread", "lantern", "static", "silence", "rivers", "forge", "canvas", "pantry", "choir"]);

function overlaps(a: TextMatch, b: TextMatch): boolean { return a.start < b.end && b.start < a.end; }

function collectTopicMatches(text: string, topic: ProtectedTopic): TextMatch[] {
  const terms = [{ label: topic.name, kind: "topic" as const }, ...topic.aliases.map((label) => ({ label, kind: "alias" as const }))]
    .filter((x) => normalizeText(x.label).length >= 2)
    .sort((a, b) => normalizeText(b.label).length - normalizeText(a.label).length);
  const accepted: TextMatch[] = [];
  for (const term of terms) {
    const label = normalizeText(term.label);
    for (const start of findPhraseOccurrences(text, term.label)) {
      const value: TextMatch = { id: `${term.kind}:${label}`, label: term.label, start, end: start + label.length, weight: 3, kind: term.kind };
      if (!accepted.some((x) => overlaps(x, value))) accepted.push(value);
    }
  }
  return accepted.sort((a, b) => a.start - b.start);
}

function collectIndicators(normalized: string): TextMatch[] {
  const values: TextMatch[] = [];
  for (const rule of INDICATORS) {
    rule.pattern.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = rule.pattern.exec(normalized))) {
      const value: TextMatch = { id: rule.id, label: match[0], start: match.index, end: match.index + match[0].length, weight: rule.weight, kind: "indicator" };
      if (!values.some((x) => overlaps(x, value))) values.push(value);
    }
  }
  return values;
}

function uniqueEvidence(matches: TextMatch[]): TextMatch[] { return [...new Map(matches.map((x) => [x.id, x])).values()]; }

export function scoreTextForTopic(text: string, topic: ProtectedTopic, threshold: number = DETECTION_CONSTANTS.threshold): DetectionResult {
  const normalized = normalizeText(text);
  const terms = collectTopicMatches(normalized, topic);
  const rawIndicators = collectIndicators(normalized);
  const scoreline = /\b\d{1,3}\s*[-–—]\s*\d{1,3}\b/u.exec(text);
  if (scoreline) rawIndicators.push({ id: "scoreline", label: scoreline[0], start: scoreline.index, end: scoreline.index + scoreline[0].length, weight: 3, kind: "indicator" });
  const indicators = uniqueEvidence(rawIndicators.filter((indicator) => !terms.some((term) => overlaps(indicator, term))));
  const distinctTerms = new Set(terms.map((x) => x.id));
  const matchedTerms = [...new Set(terms.map((x) => x.label))];
  const matchedIndicators = indicators.map((x) => x.id);
  const revealEvidence = matchedIndicators.filter((id) => id !== "spoiler-warning");
  const benignEvidence: string[] = [];
  const collisionSafeguards: string[] = [];
  const bonuses: Evidence[] = [];
  const adjustments: Evidence[] = [];

  const question = text.includes("?") || /^(?:local post:\s*|news card\s*[—-]\s*)?(?:who|what|when|where|why|how|will|would|could|did|does|do|is|are|was|were)\b/u.test(normalized);
  const conditional = /\b(?:if|imagine if|would|hypothetically|in a hypothetical)\b/u.test(normalized);
  const speculative = /\b(?:i think|i predict|predict(?:s|ed|ion)?|theor(?:y|ize|izes)|might|may|could|guess(?:es|ing)?|rumou?r|odds|favorite|projected|speculat(?:e|ion)|fans? (?:think|guess))\b/u.test(normalized);
  const explicitNegation = /\b(?:no spoilers?|spoiler[- ]free|without spoilers?|no (?:ending|plot|result) details?|confirms? nothing|no result exists|has not started|not a plot summary|debunks?|false rumou?r|no one dies|nobody dies)\b/u.test(normalized);
  const future = /\b(?:upcoming|next (?:week|month|season|tuesday|wednesday|friday)|tonight|tomorrow|preview|prepare for|kickoff|airs?|streaming|begins?|returns?|hosts?|schedule|applications?|projected lineup|questionable for)\b/u.test(normalized);
  const live = /\b(?:with seconds remaining|currently|in progress|at halftime|leads?\s+\w+\s+\d{1,3}[-–—]\d{1,3})\b/u.test(normalized);
  const completed = /\b(?:final:|full time|final score|after the final|final vote|confirmed|confirms|won|defeated|eliminated|became .{0,20} champion|completed the sweep|gave .{0,30} victory|accepted the winners|lifted the trophy|trophy sits|crowns?)\b/u.test(normalized);
  const historical = /\b(?:19\d{2}|20(?:0\d|1\d)|old season|museum exhibit|years ago|historical)\b/u.test(normalized) && !completed;
  const metadata = /\b(?:available|availability|stream|streaming|release date|airs?|schedule|episode titled|casting|applications?|captions|poster|patch|controller|loading times|publication|paperback|audiobook|cover|voice actor|convention)\b/u.test(normalized);
  const review = /\b(?:review|score of \d|out of 10|soundtrack|composer|performance|emotionally|beautifully acted|accessibility|design award|workshop|ending clause)\b/u.test(normalized);

  if (question) benignEvidence.push("question");
  if (conditional) benignEvidence.push("conditional");
  if (speculative) benignEvidence.push("speculation");
  if (explicitNegation) benignEvidence.push("explicit-negation-or-spoiler-free");
  if (future) benignEvidence.push("future-or-preview");
  if (metadata) benignEvidence.push("metadata");
  if (review) benignEvidence.push("review-or-language-context");

  const onlyAmbiguousAlias = terms.length > 0 && terms.every((x) => x.kind === "alias" && (normalizeText(x.label).length <= 3 || COMMON_WORDS.has(normalizeText(x.label))));
  if (onlyAmbiguousAlias) collisionSafeguards.push("short-or-common-word-alias");

  const epistemicStatus = explicitNegation ? "negated" : conditional ? "conditional" : question ? "questioned" : speculative ? "speculative" : "asserted";
  const temporalStatus = completed ? "completed" : live ? "live" : future ? "future" : historical ? "historical" : "unknown";
  const topicRelevance = terms.length === 0 ? "none" : onlyAmbiguousAlias ? "ambiguous-alias" : distinctTerms.size > 1 ? "strong" : "relevant";

  let score = terms.length > 0 ? 3 : 0;
  bonuses.push(...(terms.length > 0 ? [{ id: "protected-term", weight: 3 }] : []));
  if (distinctTerms.size > 1) { score += 4; bonuses.push({ id: "multi-term-context", weight: 4 }); }
  const indicatorScore = Math.min(8, indicators.reduce((sum, x) => sum + x.weight, 0));
  score += indicatorScore;
  if (completed || live) { score += 2; bonuses.push({ id: completed ? "completed-result" : "live-result", weight: 2 }); }
  if (question) adjustments.push({ id: "question-form", weight: -6 });
  if (conditional || speculative) adjustments.push({ id: "hypothetical-or-prediction", weight: -7 });
  if (future && !live) adjustments.push({ id: "future-prediction", weight: -4.5 });
  if (explicitNegation) adjustments.push({ id: "explicit-negation-or-spoiler-free", weight: -8 });
  if (metadata) adjustments.push({ id: "benign-metadata-context", weight: -5 });
  if (review) adjustments.push({ id: "review-or-language-context", weight: -5 });
  if (historical) adjustments.push({ id: "historical-context", weight: -5 });
  if (onlyAmbiguousAlias) adjustments.push({ id: "common-word-alias-collision", weight: -5 });
  for (const adjustment of adjustments) score += adjustment.weight;
  score = Math.max(0, score);

  const asserted = epistemicStatus === "asserted";
  const presupposingQuestion = question && /\b(?:how|why)\b.{0,80}\b(?:won|died|betrayed|was eliminated)\b/u.test(normalized);
  const concreteReveal = revealEvidence.length > 0 && (asserted || presupposingQuestion) && !explicitNegation && !review && !(metadata && !completed) && !(future && !live && !completed);
  const collisionAllowed = !onlyAmbiguousAlias || (completed && indicatorScore >= 4);
  const policyProtect = terms.length > 0 && collisionAllowed && concreteReveal;
  const rulePath = terms.length === 0 ? "no-topic" : !collisionAllowed ? "collision-safeguard" : concreteReveal ? "asserted-reveal" : benignEvidence.length > 0 ? "benign-epistemic-context" : "insufficient-reveal-evidence";
  if (policyProtect && score < DETECTION_CONSTANTS.threshold) score = DETECTION_CONSTANTS.threshold;

  const reasons = [...new Set([
    ...(terms.length ? ["protected term"] : []),
    ...(distinctTerms.size > 1 ? ["multiple protected terms"] : []),
    ...(revealEvidence.length ? ["reveal evidence"] : []),
    ...benignEvidence,
    ...collisionSafeguards,
    rulePath,
  ])];

  return {
    shouldProtect: topic.enabled && policyProtect && score >= threshold,
    score, threshold, topicId: topic.id, topicName: topic.name, matchedTerms, matchedIndicators, reasons,
    explanation: {
      detectorVersion: DETECTOR_VERSION, rulePath,
      termMatches: [...new Map(terms.map((x) => [x.id, { label: x.label, kind: x.kind as "topic" | "alias" }])).values()],
      indicatorMatches: indicators.map((x) => ({ id: x.id, weight: x.weight })),
      bonuses, adjustments, topicRelevance, epistemicStatus, temporalStatus,
      revealEvidence, benignEvidence, collisionSafeguards, indicatorScore, finalScore: score,
    },
  };
}

export function findBestDetection(text: string, topics: ProtectedTopic[], threshold: number = DETECTION_CONSTANTS.threshold): DetectionResult | null {
  return topics.filter((topic) => topic.enabled).map((topic) => scoreTextForTopic(text, topic, threshold)).filter((result) => result.shouldProtect).sort((a, b) => b.score - a.score)[0] ?? null;
}
