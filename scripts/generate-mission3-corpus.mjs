import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const outputPath = resolve(root, "eval/mission3/challenge.json");
const checksumPath = resolve(root, "eval/mission3/challenge.sha256");

const splits = [
  "development",
  "entity-heldout",
  "linguistic-heldout",
  "indirect-reveal",
  "benign-adversarial",
];

const categories = ["tv", "movie", "sports", "game", "book", "competition"];

const splitWords = {
  development: ["Amber", "Brass", "Cinder", "Dawn", "Ember", "Frost", "Gale", "Harbor", "Ivory", "Juniper"],
  "entity-heldout": ["Kestrel", "Lunar", "Morrow", "Nacre", "Opal", "Prairie", "Quartz", "Raven", "Sable", "Thistle"],
  "linguistic-heldout": ["Umber", "Velvet", "Willow", "Xanthe", "Yarrow", "Zephyr", "Alder", "Beryl", "Copper", "Drift"],
  "indirect-reveal": ["Elm", "Flint", "Garnet", "Hollow", "Indigo", "Jasper", "Kindle", "Linden", "Mica", "North"],
  "benign-adversarial": ["Orchid", "Pine", "Quill", "Reed", "Silver", "Tundra", "Ultramar", "Vesper", "Wren", "Yellow"],
};

const categoryNouns = {
  tv: ["Signal", "Parallax", "Station", "Orchard", "Threshold", "Circuit", "Embassy", "Lantern", "Archive", "District"],
  movie: ["Voyage", "Mirror", "Comet", "Monument", "Passage", "Requiem", "Labyrinth", "Beacon", "Current", "Horizon"],
  sports: ["Comets", "Foxes", "Pilots", "Foundry", "Owls", "Rockets", "Marlins", "Cyclones", "Herons", "Voyagers"],
  game: ["Protocol", "Citadel", "Engine", "Frontier", "Rift", "Relic", "Odyssey", "Bastion", "Spiral", "Expanse"],
  book: ["Testament", "Atlas", "Letters", "Garden", "Chronicle", "Library", "Ledger", "Fable", "Codex", "Map"],
  competition: ["Table", "Workshop", "Stage", "Expedition", "Studio", "Arena", "Forge", "Gallery", "Circuit", "Crown"],
};

const givenNames = [
  "Ari", "Bela", "Cato", "Dara", "Eli", "Fara", "Gio", "Hana", "Ivo", "Jori",
  "Kira", "Lio", "Mara", "Niko", "Orla", "Pavi", "Rhea", "Sami", "Tala", "Una",
  "Vero", "Willa", "Xeno", "Yara", "Zane", "Anya", "Bram", "Cleo", "Dev", "Esme",
  "Finn", "Greta", "Hale", "Ines", "Juno", "Kian", "Lena", "Milo", "Nia", "Oren",
  "Pia", "Quin", "Remy", "Sora", "Tobin", "Ula", "Vik", "Wren", "Xara", "Yves",
];

const surnames = [
  "Vale", "Miro", "Senn", "Kade", "Orin", "Pell", "Rook", "Tern", "Voss", "Wynn",
  "Arden", "Bex", "Corin", "Dane", "Elian", "Fenn", "Grey", "Holt", "Ibis", "Jade",
  "Keel", "Lark", "March", "Noll", "Oakes", "Pike", "Quill", "Reeve", "Stone", "Thorne",
  "Umber", "Venn", "West", "Yarrow", "Zell", "Ash", "Bloom", "Crane", "Dusk", "Eyre",
  "Flint", "Grove", "Haze", "Isle", "Jett", "Knox", "Lake", "Moss", "North", "Orr",
];

const spoilerFamilies = {
  development: [
    "{person} is exposed as the architect of the disappearances.",
    "The final account confirms that {other} arranged the disaster.",
    "{person} abandons {other} after secretly serving {group}.",
    "The last scene shows {person} returning under a different identity.",
    "{other} takes control after removing {person} from the contest.",
    "The completed result puts {group} ahead after the decisive round.",
    "{person} discovers that {place} was constructed from stolen memories.",
    "The closing chapter leaves {other} in possession of {place}.",
    "{person} and {other} choose separate paths once the truth is public.",
    "The masked figure is {person}, who had guided the group from the start.",
  ],
  "entity-heldout": [
    "{person} is exposed as the source of every forged message.",
    "The final account confirms that {other} arranged the collapse.",
    "{person} abandons {other} after secretly serving {group}.",
    "The last scene shows {person} returning under the rival banner.",
    "{other} takes control after removing {person} from the final round.",
    "The completed result puts {group} ahead after the deciding attempt.",
    "{person} discovers that {place} was built to contain copied memories.",
    "The closing chapter leaves {other} as the owner of {place}.",
    "{person} and {other} part once their shared deception is public.",
    "The hidden caller is {person}, who had issued the orders all along.",
  ],
  "linguistic-heldout": [
    "Every unsigned command carries the cadence of {person}'s private recordings.",
    "Only {other} knew the route that the saboteur used, because it was their route.",
    "When the doors open, {person} is standing with {group}, not against them.",
    "The stranger removes the visor; {other}'s childhood scar is underneath.",
    "One chair remains at the ceremony, and it belongs to {person}.",
    "The scoreboard goes dark with {group}'s colors covering the winning side.",
    "Each room in {place} is assembled from a day that {person} can no longer remember.",
    "The deed to {place} bears {other}'s signature on its final line.",
    "Two train tickets appear, but {person} leaves one on the platform for {other}.",
    "The voice from the helmet repeats the lullaby only {person} knows.",
  ],
  "indirect-reveal": [
    "The orders blamed on a council use {person}'s childhood cipher on every page.",
    "All the letters that led {other} forward were written in {person}'s hand.",
    "At dinner, {person} answers to the name engraved on the enemy's ring.",
    "The empty portrait frame fits {other}'s photograph exactly.",
    "When the votes are unfolded, every ballot except {person}'s bears the same crossed mark.",
    "The horn sounds once while {group}'s flag is the only one still raised.",
    "{place} is not a refuge; its rooms are the memories {person} believed were dreams.",
    "The key {other} has worn since childhood opens the sealed room in {place}.",
    "{person} packs one cup after {other} quietly returns the apartment key.",
    "The recording called the intruder has {person}'s heartbeat beneath the static.",
  ],
  "benign-adversarial": [
    "Archived production notes explicitly identify {person} as the character responsible for the disappearances.",
    "A retrospective account states that {other} caused the central disaster.",
    "The published recap confirms {person} crossed to {group} during the decisive moment.",
    "A post-release interview confirms the stranger was {other}.",
    "The official results list {person} as the sole remaining entrant.",
    "The final record places {group} on the victorious side.",
    "The annotated guide states that {place} contains {person}'s removed memories.",
    "The epilogue record transfers {place} to {other}.",
    "The retrospective says {person} left {other} after the central secret surfaced.",
    "The creators confirm that the hidden voice belonged to {person}.",
  ],
};

const benignFamilies = {
  development: [
    "A spoiler-free review praises {person}'s performance without discussing events.",
    "Could {other} be behind the mystery, or is that theory deliberately absurd?",
    "If {person} joined {group}, the story might become more dramatic.",
    "The phrase 'last scene' describes the final shot completed during production.",
    "{other} joked that winning the costume contest felt like a finale.",
    "A preview predicts {group} may lead after the next round.",
    "{place} is a metaphor for memory in an essay that avoids plot details.",
    "The new edition includes a map of {place} and an author interview.",
    "Fans ask whether {person} and {other} will stay together next season.",
    "A museum display labels {person}'s helmet as a prop replica.",
  ],
  "entity-heldout": [
    "A spoiler-free review praises {person}'s performance without recounting events.",
    "Could {other} be sending the messages, or is that only a fan theory?",
    "If {person} joined {group}, the next installment might change direction.",
    "The phrase 'last scene' refers to the final setup filmed on location.",
    "{other} joked that winning a charity contest felt like a finale.",
    "A preview predicts {group} could lead after tomorrow's round.",
    "{place} is used as a metaphor in a review that withholds story details.",
    "The paperback includes a map of {place} and publication notes.",
    "Readers ask whether {person} and {other} might reconcile in a sequel.",
    "A convention display identifies {person}'s helmet as a replica prop.",
  ],
  "linguistic-heldout": [
    "The review admires how {person} holds a pause; what follows is deliberately not described.",
    "Suppose {other} knew the route: would that make them guilty, or merely prepared?",
    "A comedy sketch puts {person} beside {group} and calls it the least convincing alliance ever.",
    "The production diary counts how many takes were needed before the visor came off.",
    "A seating chart leaves one ceremonial chair blank for camera access.",
    "Fantasy managers are advised to start players from {group} this weekend.",
    "An architecture essay compares {place} to the rooms people build inside memory.",
    "A bookseller displays a decorative key beside the new edition set in {place}.",
    "A relationship column borrows {person} and {other} as fictional examples without recounting their story.",
    "The sound designer explains how a heartbeat was layered beneath radio static.",
  ],
  "indirect-reveal": [
    "A typography review says {person}'s cipher-like handwriting gives the poster a secretive mood.",
    "A fan asks whether the letters might be in {person}'s hand, then calls the idea unsupported.",
    "At a costume event, {person} wears a replica of the enemy's ring for a joke.",
    "The gallery sells an empty frame sized for {other}'s promotional photograph.",
    "A voting tutorial uses {person}'s name on sample ballots that do not represent results.",
    "A preview imagines {group}'s flag being the last one raised if tomorrow goes perfectly.",
    "A design essay calls {place} a refuge built from memory, without describing the story.",
    "The collector's edition includes a decorative key modeled after the doors in {place}.",
    "A therapist's hypothetical about returning an apartment key uses {person} and {other} as invented examples.",
    "The audio team explains how {person}'s recorded heartbeat was used for a trailer effect.",
  ],
  "benign-adversarial": [
    "The phrase 'death of summer' headlines a release-calendar article about the show's autumn return.",
    "A critic says {other}'s joke killed the room, then promises the review contains no story outcomes.",
    "A fan theory predicts {person} could betray {group}, but offers no evidence.",
    "Was the stranger actually {other}, or did the trailer edit unrelated images together?",
    "{person} won a charity bake sale unrelated to the program's competition.",
    "Fantasy-league projections favor {group}; the actual match is tomorrow.",
    "A library display titled 'Buried Memories' promotes the new edition set in {place}.",
    "The author ends a bookstore tour at {place} Books next Friday.",
    "A podcast asks if {person} and {other} should break up, then avoids answering.",
    "The word 'killer' describes {person}'s costume design in a spoiler-free fashion review.",
  ],
};

const rationales = {
  spoiler: "The text asserts a completed fictional fact or relationship that changes understanding of the protected topic.",
  benign: "The text is speculation, craft/metadata discussion, metaphor, or unrelated dramatic language rather than an established topic outcome.",
};

function topicFor(split, category, index) {
  const splitIndex = splits.indexOf(split);
  const categoryIndex = categories.indexOf(category);
  const word = splitWords[split][index];
  const noun = categoryNouns[category][index];
  const personIndex = (splitIndex * 10 + index + categoryIndex * 7) % givenNames.length;
  const otherIndex = (personIndex + 17) % givenNames.length;
  const entityPrefix = `${word} ${category.slice(0, 3).toUpperCase()}`;
  const person = `${entityPrefix} ${givenNames[personIndex]} ${surnames[personIndex]}`;
  const other = `${entityPrefix} ${givenNames[otherIndex]} ${surnames[otherIndex]}`;
  const qualifier = { tv: "Chronicles", movie: "Motion Picture", game: "Quest", book: "Novel", competition: "Challenge" }[category];
  const title = category === "sports" ? `${word} ${noun}` : `The ${word} ${noun}: ${qualifier}`;
  const group = category === "sports" ? `${word} ${noun} Club` : `${word} ${category} Circle`;
  return {
    id: `m3-${split}-${category}-${String(index + 1).padStart(2, "0")}`,
    name: title,
    aliases: [person, other, group],
    enabled: true,
    createdAt: "2026-01-01T00:00:00.000Z",
  };
}

function fill(template, topic, category) {
  return template
    .replaceAll("{topic}", topic.name)
    .replaceAll("{person}", topic.aliases[0])
    .replaceAll("{other}", topic.aliases[1])
    .replaceAll("{group}", topic.aliases[2])
    .replaceAll("{place}", category === "sports" ? `${topic.name} stadium` : `${topic.name} vault`);
}

function frame(statement, topic, index) {
  const aliasOnly = index % 4 === 0;
  if (index < 3) return `${aliasOnly ? topic.aliases[0] : topic.name}: ${statement}`;
  if (index < 5) return `Post about ${aliasOnly ? topic.aliases[1] : topic.name} — ${statement}`;
  return `A local discussion of ${aliasOnly ? topic.aliases[2] : topic.name} begins with its visual style and recurring locations. ${statement} The remainder compares pacing and performances without adding another factual claim.`;
}

const cases = [];
for (const split of splits) {
  for (const category of categories) {
    for (const expected of ["spoiler", "benign"]) {
      const families = expected === "spoiler" ? spoilerFamilies[split] : benignFamilies[split];
      for (let index = 0; index < 10; index += 1) {
        const topic = topicFor(split, category, index);
        const statement = fill(families[index], topic, category);
        const tags = [
          `split:${split}`,
          category,
          expected,
          index < 5 ? "short-context" : "long-context",
          index % 4 === 0 ? "title-absent" : "title-present",
          `${split}-${expected}-family-${String(index + 1).padStart(2, "0")}`,
        ];
        if (expected === "spoiler" && (split === "indirect-reveal" || split === "linguistic-heldout")) tags.push("indirect-reveal");
        if (expected === "benign" && (split === "benign-adversarial" || split === "indirect-reveal" || split === "linguistic-heldout")) tags.push("benign-adversarial");
        cases.push({
          id: `${split}-${category}-${expected}-${String(index + 1).padStart(2, "0")}`,
          topic,
          category,
          text: frame(statement, topic, index),
          expected,
          difficulty: split === "development" ? "standard" : "hard",
          tags,
          rationale: rationales[expected],
          split,
        });
      }
    }
  }
}

const ids = new Set(cases.map((item) => item.id));
if (cases.length !== 600 || ids.size !== cases.length) throw new Error("Mission 3 corpus must contain 600 uniquely identified cases.");
for (const split of splits) {
  const values = cases.filter((item) => item.split === split);
  if (values.length !== 120 || values.filter((item) => item.expected === "spoiler").length !== 60) {
    throw new Error(`Split ${split} is not balanced at 120 cases.`);
  }
}

const document = {
  schemaVersion: 1,
  frozenAt: "2026-08-12T00:00:00.000Z",
  design: "Mission 3 OOD challenge; do not train on these cases.",
  cases,
};
const serialized = `${JSON.stringify(document, null, 2)}\n`;
const checksum = createHash("sha256").update(serialized).digest("hex");

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, serialized, "utf8");
await writeFile(checksumPath, `${checksum}  challenge.json\n`, "utf8");

console.log(`Frozen ${cases.length} Mission 3 OOD cases.`);
console.log(`SHA-256 ${checksum}`);
