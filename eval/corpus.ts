import type { ProtectedTopic } from "../src/shared/topic";

export type CorpusCategory = "tv" | "movie" | "sports" | "game" | "book" | "competition" | "adversarial";
export type CorpusLabel = "spoiler" | "benign";
export type CorpusSplit = "calibration" | "heldout";

export interface CorpusCase {
  id: string;
  topic: ProtectedTopic;
  category: CorpusCategory;
  text: string;
  expected: CorpusLabel;
  difficulty: "standard" | "hard";
  tags: string[];
  rationale: string;
  split: CorpusSplit;
}

type Scenario = [template: string, tags: string[], rationale: string, difficulty?: "standard" | "hard"];
type Frame = [render: (content: string, topic: ProtectedTopic) => string, tags: string[]];

interface CategorySpec {
  category: Exclude<CorpusCategory, "adversarial">;
  topic: ProtectedTopic;
  spoilers: Scenario[];
  benign: Scenario[];
}

const makeTopic = (id: string, name: string, aliases: string[]): ProtectedTopic => ({
  id,
  name,
  aliases,
  enabled: true,
  createdAt: "2026-01-01T00:00:00.000Z",
});

export const CORPUS_TOPICS = {
  tv: makeTopic("eval-tv", "Severance", ["Lumon", "Mark Scout", "Macrodata Refinement"]),
  movie: makeTopic("eval-movie", "Glass Horizon", ["Captain Vale", "The Meridian", "Director Sato"]),
  sports: makeTopic("eval-sports", "Denver Nuggets", ["Nuggets", "Jokic", "Nikola Jokic"]),
  game: makeTopic("eval-game", "Starfall Protocol", ["Astra Vale", "Hollow Regent", "SP"]),
  book: makeTopic("eval-book", "The Silent Archive", ["Archivist Mara", "Jonas Reed", "Silent Archive"]),
  competition: makeTopic("eval-competition", "Master Kitchen", ["Chef Lila", "Lila Chen", "Final Table"]),
  adversarial: makeTopic("eval-adversarial", "The Bear", ["Bear", "Carmy"]),
} as const;

function fill(template: string, topic: ProtectedTopic): string {
  return template
    .replaceAll("{topic}", topic.name)
    .replaceAll("{a0}", topic.aliases[0] ?? topic.name)
    .replaceAll("{a1}", topic.aliases[1] ?? topic.name)
    .replaceAll("{a2}", topic.aliases[2] ?? topic.name);
}

const spoilerFrames: Frame[] = [
  [(content, topic) => `${topic.name} finale recap: ${content}.`, ["headline", "title-present"]],
  [(content, topic) => `SPOILER — ${content} (${topic.name}).`, ["explicit-warning", "title-present"]],
  [(content, topic) => `${topic.aliases[0]} update: ${content}.`, ["alias-only", "title-absent"]],
  [(content, topic) => `Fans discussing ${topic.name} confirmed that ${content}.`, ["social", "title-present"]],
  [(content, topic) => `⚠ recap / ${(topic.aliases[1] ?? topic.aliases[0] ?? topic.name).toUpperCase()} / ${content} — details follow.`, ["heldout-style", "emoji-noise", "alias-only", "title-absent"]],
];

const benignFrames: Frame[] = [
  [(content) => `${content}.`, ["plain"]],
  [(content) => `Entertainment calendar: ${content}.`, ["metadata"]],
  [(content) => `Question from a new viewer: ${content}?`, ["question"]],
  [(content) => `“${content},” said the listings editor.`, ["quoted-statement"]],
  [(content) => `📌 FYI — ${content}; no ending details are included.`, ["heldout-style", "emoji-noise", "benign-alarming-language"]],
];

const specs: CategorySpec[] = [
  {
    category: "tv",
    topic: CORPUS_TOPICS.tv,
    spoilers: [
      ["{a1} is killed during the final escape", ["death", "alias"], "A named character death is an outcome spoiler."],
      ["{a0}'s board is revealed to be run by Mark's missing sister", ["identity-reveal", "alias"], "Reveals the hidden identity behind the organization."],
      ["{a1} betrays the {a2} team", ["betrayal", "indirect"], "Discloses a consequential betrayal.", "hard"],
      ["{a1} and Helly end their relationship after the finale", ["relationship-outcome", "indirect"], "Discloses a relationship outcome.", "hard"],
      ["{a2} discovers that {a0} fabricated every memory", ["plot-reveal", "multiple-terms"], "Discloses the central plot reveal."],
    ],
    benign: [
      ["{topic} season one is available to stream", ["streaming-availability", "benign-title-mention"], "Availability information contains no outcome."],
      ["casting news adds a guest actor to {topic}", ["casting-news", "benign-title-mention"], "Casting news is not a narrative outcome."],
      ["the next {topic} episode airs Friday", ["episode-schedule", "benign-title-mention"], "Scheduling information is benign."],
      ["a review praises {topic} production design without discussing plot", ["spoiler-free-review", "negation"], "Explicitly spoiler-free craft discussion."],
      ["I started watching {topic} yesterday", ["benign-title-mention", "short-snippet"], "A viewing-status statement contains no outcome."],
    ],
  },
  {
    category: "movie",
    topic: CORPUS_TOPICS.movie,
    spoilers: [
      ["{a0} dies before the closing scene", ["death", "character-outcome"], "Reveals a character death."],
      ["{a1} is actually a simulation built by {a2}", ["twist", "identity-reveal"], "Reveals the movie's central twist."],
      ["{a0} survives and becomes the new commander", ["survival", "ending"], "Reveals the protagonist's final outcome.", "hard"],
      ["the post-credits scene reveals the missing crew is alive", ["post-credits", "plot-reveal"], "Discloses a post-credits revelation.", "hard"],
      ["{a2} is exposed as the murderer in the final act", ["villain-identity", "ending"], "Identifies the murderer."],
    ],
    benign: [
      ["{topic} opens in theaters next month", ["release-information", "benign-title-mention"], "Release timing is not a spoiler."],
      ["{topic} passed fifty million dollars at the box office", ["box-office", "benign-title-mention"], "Commercial performance is not narrative content."],
      ["{a2} will attend a {topic} festival screening", ["creator-news", "alias"], "A creator appearance is benign."],
      ["the {topic} trailer uses practical miniature effects", ["trailer-craft", "benign-title-mention"], "Craft discussion reveals no outcome."],
      ["a spoiler-free {topic} review praises the score", ["spoiler-free-review", "score-word"], "Score refers to music and the review is spoiler-free."],
    ],
  },
  {
    category: "sports",
    topic: CORPUS_TOPICS.sports,
    spoilers: [
      ["{a0} defeated Boston 118-110", ["final-score", "result"], "Reports a completed game result."],
      ["{a1} hit the winning shot as the {a0} won the championship", ["winner", "championship"], "Reports the champion and decisive play."],
      ["{a0} were eliminated after losing game seven", ["elimination", "result"], "Reports playoff elimination."],
      ["{a2} finished with 42 points in a 101-99 victory", ["final-score", "player-result"], "Reports completed player and team results."],
      ["{a0} lead 96-80 with ten seconds remaining", ["live-game", "score-state"], "Reveals the current live-game state.", "hard"],
    ],
    benign: [
      ["{topic} play Tuesday at 7 PM", ["schedule", "benign-title-mention"], "A future schedule contains no result."],
      ["{a0} completed a trade for a reserve center", ["trade-news", "alias"], "Roster transactions are not game spoilers."],
      ["analysts predict the {a0} will win by six", ["prediction", "hypothetical", "alias"], "A prediction is not a completed outcome."],
      ["{topic} preview lists betting odds and matchup history", ["preview", "betting-prediction"], "Pre-game odds are benign."],
      ["a museum displays a historical {a1} jersey", ["historical-reference", "alias"], "A historical exhibit is unrelated to a current result."],
    ],
  },
  {
    category: "game",
    topic: CORPUS_TOPICS.game,
    spoilers: [
      ["{a1} is the masked final boss", ["boss-identity", "identity-reveal"], "Names the secret final boss."],
      ["{a0} dies in the reactor ending", ["death", "ending"], "Reveals a character death and ending."],
      ["the true ending shows {a0} created the invasion", ["ending", "plot-reveal"], "Reveals the true-ending twist."],
      ["a secret area beneath the observatory contains the lost colony", ["secret-area", "plot-reveal"], "Discloses a hidden narrative area.", "hard"],
      ["{a1} is actually the protagonist's future self", ["identity-reveal", "twist"], "Reveals a major identity twist."],
    ],
    benign: [
      ["{topic} patch 1.4 improves controller support", ["patch-notes", "benign-title-mention"], "Technical patch notes are benign."],
      ["a {topic} tip recommends saving health potions", ["gameplay-tip", "benign-title-mention"], "Non-narrative gameplay advice is benign."],
      ["{topic} launches on console in September", ["release-information", "benign-title-mention"], "Release timing contains no plot outcome."],
      ["{a0}'s voice actor joins a convention panel", ["casting-news", "alias"], "Actor event news is benign."],
      ["a performance review says {topic} holds sixty frames per second", ["technical-review", "abbreviation"], "Performance metrics are not narrative spoilers."],
    ],
  },
  {
    category: "book",
    topic: CORPUS_TOPICS.book,
    spoilers: [
      ["{a0} dies while sealing the final vault", ["death", "ending"], "Reveals a character death."],
      ["{a1} is revealed as Mara's father", ["relation-reveal", "identity-reveal"], "Reveals a hidden family relationship."],
      ["{a0} betrays the council in the last chapter", ["betrayal", "ending"], "Discloses a final-chapter betrayal."],
      ["the archive is a prison for the narrator's memories", ["plot-reveal", "indirect"], "Reveals the book's core premise.", "hard"],
      ["{a1} survives and inherits the archive", ["survival", "ending"], "Reveals the ending disposition.", "hard"],
    ],
    benign: [
      ["{topic} paperback publishes in October", ["publication-information", "benign-title-mention"], "Publication timing is benign."],
      ["the author of {topic} will speak at the library", ["author-discussion", "benign-title-mention"], "An author event contains no outcome."],
      ["a spoiler-free review calls {topic} atmospheric", ["spoiler-free-review", "benign-title-mention"], "The review explicitly avoids plot details."],
      ["{topic} is available as an audiobook", ["availability", "benign-title-mention"], "Format availability is benign."],
      ["a new {topic} cover uses hand-lettered type", ["edition-news", "benign-title-mention"], "Cover design discussion is benign."],
    ],
  },
  {
    category: "competition",
    topic: CORPUS_TOPICS.competition,
    spoilers: [
      ["{a1} wins the final challenge", ["winner", "result"], "Names the competition winner."],
      ["{a0} is eliminated before the finale", ["elimination", "result"], "Reports an elimination."],
      ["{a1} and Mateo are the final two contestants", ["finalist-reveal", "result"], "Reveals the finalists.", "hard"],
      ["{a0} defeats Mateo at the {a2}", ["defeated", "winner"], "Reports the final head-to-head result."],
      ["{a0}'s secret advantage sends Priya home", ["secret-advantage", "elimination"], "Reveals the mechanism and eliminated contestant."],
    ],
    benign: [
      ["{topic} returns Wednesday at 8 PM", ["episode-schedule", "benign-title-mention"], "A broadcast schedule is benign."],
      ["{topic} announces next season's casting call", ["casting-news", "benign-title-mention"], "Casting information contains no outcome."],
      ["{a0} shares a bread recipe", ["contestant-news", "alias"], "Off-show recipe content is benign."],
      ["a {topic} recap discusses the kitchen design without results", ["spoiler-free-review", "negation"], "The recap explicitly omits results."],
      ["fans predict {a1} could reach the {a2}", ["prediction", "hypothetical"], "A fan prediction is not a completed outcome."],
    ],
  },
];

function categoryCases(spec: CategorySpec, expected: CorpusLabel, scenarios: Scenario[], frames: Frame[]): CorpusCase[] {
  return frames.flatMap(([renderFrame, frameTags], frameIndex) =>
    scenarios.map(([template, tags, rationale, difficulty], scenarioIndex) => ({
      id: `${spec.category}-${expected}-${String(frameIndex * scenarios.length + scenarioIndex + 1).padStart(2, "0")}`,
      topic: spec.topic,
      category: spec.category,
      text: renderFrame(fill(template, spec.topic), spec.topic),
      expected,
      difficulty: difficulty ?? (frameIndex === 4 ? "hard" : "standard"),
      tags: [...new Set([spec.category, expected, ...tags, ...frameTags])],
      rationale,
      split: frameIndex === 4 ? "heldout" : "calibration",
    })),
  );
}

const adversarial: Array<Scenario & { expected: CorpusLabel }> = [
  Object.assign(["{a1} dies in the restaurant fire", ["death", "alias-only", "title-absent"], "A title-absent alias spoiler reveals a death."] as Scenario, { expected: "spoiler" as const }),
  Object.assign(["{topic} finale reveals {a1} sold the restaurant", ["finale", "plot-reveal"], "Reveals a finale outcome."] as Scenario, { expected: "spoiler" as const }),
  Object.assign(["{a1} betrays Sydney and leaves Chicago", ["betrayal", "alias-only", "title-absent"], "Reveals a betrayal and departure.", "hard"] as Scenario, { expected: "spoiler" as const }),
  Object.assign(["{a1} and Claire reunite in the ending", ["relationship-outcome", "ending"], "Reveals a relationship outcome."] as Scenario, { expected: "spoiler" as const }),
  Object.assign(["{a1}'s brother is revealed as the anonymous investor", ["identity-reveal", "alias-only"], "Reveals a hidden identity."] as Scenario, { expected: "spoiler" as const }),
  Object.assign(["{a1} wins the award after the final service", ["winner", "alias-only"], "Reveals the final award outcome."] as Scenario, { expected: "spoiler" as const }),
  Object.assign(["a brown {a0} died near the national park", ["common-word-collision", "death", "entity-collision"], "Bear refers to an animal, not the protected show.", "hard"] as Scenario, { expected: "benign" as const }),
  Object.assign(["the {a0} market score ended lower today", ["common-word-collision", "score-word", "entity-collision"], "Bear refers to a financial market.", "hard"] as Scenario, { expected: "benign" as const }),
  Object.assign(["no one dies in {topic}; the review only discusses costumes", ["negation", "benign-alarming-language"], "The apparent death claim is explicitly negated.", "hard"] as Scenario, { expected: "benign" as const }),
  Object.assign(["will {a1} win the award next season", ["question", "prediction", "alias-only"], "A question about a future outcome is not a result.", "hard"] as Scenario, { expected: "benign" as const }),
  Object.assign(["if {topic} finale revealed an alien, fans would be surprised", ["hypothetical", "finale", "benign-alarming-language"], "A hypothetical does not assert an outcome.", "hard"] as Scenario, { expected: "benign" as const }),
  Object.assign(["the article debunks the false rumor that {a1} died", ["negation", "quoted-rumor", "alias-only"], "A debunked false rumor should not be treated as an outcome.", "hard"] as Scenario, { expected: "benign" as const }),
];

const adversarialFrames: Frame[] = [
  [(content) => content, ["plain"]],
  [(content) => `Forum post: ${content}.`, ["social"]],
  [(content) => `>>> ${content.toUpperCase()} <<<`, ["casing-variant", "punctuation-variant"]],
  [(content) => `🙂 ${content} #discussion`, ["emoji-noise"]],
  [(content) => `A reader wrote, “${content}.”`, ["heldout-style", "quoted-statement"]],
];

const adversarialCases: CorpusCase[] = adversarialFrames.flatMap(([renderFrame, frameTags], frameIndex) =>
  adversarial.map((scenario, scenarioIndex) => {
    const [template, tags, rationale, difficulty] = scenario;
    return {
      id: `adversarial-${scenario.expected}-${String(frameIndex * adversarial.length + scenarioIndex + 1).padStart(2, "0")}`,
      topic: CORPUS_TOPICS.adversarial,
      category: "adversarial",
      text: renderFrame(fill(template, CORPUS_TOPICS.adversarial), CORPUS_TOPICS.adversarial),
      expected: scenario.expected,
      difficulty: difficulty ?? "hard",
      tags: [...new Set(["adversarial", scenario.expected, ...tags, ...frameTags])],
      rationale,
      split: frameIndex === 4 ? "heldout" : "calibration",
    };
  }),
);

export const CORPUS_CASES: CorpusCase[] = [
  ...specs.flatMap((spec) => [
    ...categoryCases(spec, "spoiler", spec.spoilers, spoilerFrames),
    ...categoryCases(spec, "benign", spec.benign, benignFrames),
  ]),
  ...adversarialCases,
];
