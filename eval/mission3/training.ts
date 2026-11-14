import { createHash } from "node:crypto";
import type { ProtectedTopic } from "../../src/shared/topic";
import { formatSemanticInput } from "../../src/semantic/input";

export interface TrainingCase {
  id: string;
  input: string;
  label: 0 | 1;
  split: "training" | "validation";
}

const spoilerTemplates = [
  "Records confirm {a} authored the anonymous threats.",
  "The final testimony names {b} as the person who staged the accident.",
  "{a} crosses the bridge and joins the faction hunting {b}.",
  "The figure behind the glass removes the mask and is {a}.",
  "Only {b}'s name appears on the completed winners list.",
  "The siren ends with {team}'s banner above every other banner.",
  "{place} contains the years that were removed from {a}'s mind.",
  "The inheritance document gives {place} to {b}.",
  "{a} returns the ring and leaves before {b} wakes.",
  "The supposed rescuer has {a}'s fingerprints on the lock.",
  "Every map from the unseen guide is drawn with {b}'s damaged hand.",
  "{a} recognizes their own voice issuing the enemy's commands.",
  "The child in the photograph grows up to be {b}.",
  "The final empty podium is filled by {a}.",
  "No opposing light remains when {team}'s color covers the board.",
  "The room called an archive is where {b}'s borrowed lives are stored.",
  "{a}'s key opens the cell that everyone believed was a chapel.",
  "The two travel bags become one after {b} walks away.",
  "The pulse in the intercepted recording matches {a}.",
  "The signature beneath the order belongs to {b}'s missing parent.",
  "A verified recap says {a} caused the blackout.",
  "The published ending identifies {b} as the hidden patron.",
  "Official results place {team} first after the completed event.",
  "The epilogue confirms {a} never escaped {place}.",
  "A retrospective states that {b} was working for the rival group.",
  "The creators confirm {a} and {b} separate after the confession.",
  "The guidebook identifies {a} as the final opponent.",
  "The last chapter says {b} kept every letter from {a}.",
  "The certified result removes {a} and leaves {b} as the remaining entrant.",
  "The commentary confirms {team} completed the comeback.",
];

const benignTemplates = [
  "A spoiler-free review praises {a}'s quiet acting and omits events.",
  "Could {b} have staged the accident, or is the theory nonsense?",
  "If {a} joined the rival faction, the next season might be chaotic.",
  "The mask worn by {a} is a replica displayed at a convention.",
  "A fantasy contest predicts {b} could finish first next week.",
  "A preview says {team} may lead if tomorrow's strategy succeeds.",
  "An essay compares {place} to a warehouse for forgotten years without revealing the story.",
  "The new edition includes a decorative deed for {place}.",
  "A relationship podcast asks whether {a} should leave {b} and gives no answer.",
  "The prop department discusses how {a}'s fingerprints were printed on glass.",
  "A handwriting tutorial uses {b}'s promotional letters as a visual example.",
  "A fan imagines {a} issuing the commands but labels it speculation.",
  "The photograph of {b} appears in a casting announcement.",
  "A venue map reserves an empty podium for camera equipment.",
  "Fantasy managers are told to consider players from {team} this weekend.",
  "A library exhibit calls ordinary journals archives of borrowed lives.",
  "A collector sells a replica key inspired by {place}.",
  "A travel column uses {a} and {b} in a hypothetical packing example.",
  "The sound team recorded {a}'s pulse for a trailer effect.",
  "Was the signature {b}'s, or did the teaser combine unrelated shots?",
  "The phrase 'caused a blackout' describes {a}'s stage lighting review.",
  "A bookshop event about the ending is scheduled for next month.",
  "Betting projections place {team} first before the event begins.",
  "A review says {place} feels inescapable while withholding all outcomes.",
  "A comedy sketch casts {b} as a rival agent unrelated to the story.",
  "Critics debate whether {a} and {b} have convincing chemistry without describing their outcome.",
  "A controller guide calls {a} the ideal opponent for practice mode.",
  "The publisher displays sample letters from {b} in a typography article.",
  "The next entrant list may remove {a} if the prediction is correct.",
  "A historical article says an older team completed a similar comeback decades ago.",
];

function trainingTopic(index: number): ProtectedTopic {
  const number = String(index + 1).padStart(2, "0");
  return {
    id: `semantic-training-${number}`,
    name: `Fictional Work ${number}`,
    aliases: [`Protagonist ${number}`, `Rival ${number}`, `Team ${number}`],
    enabled: true,
    createdAt: "2026-01-01T00:00:00.000Z",
  };
}

function fill(template: string, topic: ProtectedTopic): string {
  return template
    .replaceAll("{a}", topic.aliases[0] ?? topic.name)
    .replaceAll("{b}", topic.aliases[1] ?? topic.name)
    .replaceAll("{team}", topic.aliases[2] ?? topic.name)
    .replaceAll("{place}", `${topic.name} observatory`);
}

export function buildTrainingCases(): { cases: TrainingCase[]; checksum: string } {
  const cases: TrainingCase[] = [];
  for (let topicIndex = 0; topicIndex < 20; topicIndex += 1) {
    const topic = trainingTopic(topicIndex);
    for (const [label, templates] of [[1, spoilerTemplates], [0, benignTemplates]] as const) {
      templates.forEach((template, templateIndex) => {
        const statement = fill(template, topic);
        const longFrame = templateIndex % 3 === 2;
        const text = longFrame
          ? `${topic.name} discussion begins with visual design and release history. ${statement} The rest of the post discusses pacing without another factual claim.`
          : `${templateIndex % 4 === 0 ? topic.aliases[0] : topic.name}: ${statement}`;
        cases.push({
          id: `train-${topicIndex + 1}-${label}-${templateIndex + 1}`,
          input: formatSemanticInput(text, topic),
          label,
          split: templateIndex % 5 === 4 ? "validation" : "training",
        });
      });
    }
  }
  const checksum = createHash("sha256").update(JSON.stringify(cases)).digest("hex");
  return { cases, checksum };
}
